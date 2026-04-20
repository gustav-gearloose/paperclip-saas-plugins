#!/usr/bin/env bash
# wire-mcp-to-customer.sh — install the MCP plugin proxy on a customer's Paperclip instance
# and patch their default agent to use it, so Claude agents can call plugin tools.
#
# Usage:
#   PC_PASSWORD=<pw> ./scripts/wire-mcp-to-customer.sh <customer-slug> [agent-id]
#
# If agent-id is omitted, patches the first agent found on the instance.
# Reads instance config from customers/<customer-slug>.env.
#
# Prerequisites:
#   - Paperclip instance is running and accessible via SSH_HOST
#   - Plugin proxy built at packages/mcp-plugin-proxy/
#   - PC_PASSWORD set in env (or customers/<customer-slug>.secrets)

set -euo pipefail

CUSTOMER="${1:?Usage: $0 <customer-slug> [agent-id]}"
AGENT_ID="${2:-}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV_FILE="$REPO_ROOT/customers/$CUSTOMER.env"
SECRETS_FILE="$REPO_ROOT/customers/$CUSTOMER.secrets"

[[ -f "$ENV_FILE" ]] || { echo "❌ No customer config at $ENV_FILE" >&2; exit 1; }

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
[[ -f "$SECRETS_FILE" ]] && source "$SECRETS_FILE"
set +a

[[ -n "${PC_PASSWORD:-}" ]] || { echo "❌ PC_PASSWORD is not set" >&2; exit 1; }

CONTAINER="${CONTAINER:-paperclip-deploy-paperclip-1}"
SSH_HOST="${SSH_HOST:?SSH_HOST not set in $ENV_FILE}"
PC_HOST="${PC_HOST:?PC_HOST not set in $ENV_FILE}"        # external, used by this script
PC_HOST_INTERNAL="http://localhost:3100"                   # used by proxy inside container
PC_EMAIL="${PC_EMAIL:?PC_EMAIL not set in $ENV_FILE}"
PC_COMPANY_ID="${PC_COMPANY_ID:?PC_COMPANY_ID not set in $ENV_FILE}"
DOCKER="DOCKER_HOST=unix:///var/run/docker.sock docker"
PROXY_PATH="/paperclip/mcp-proxy"
MCP_CONFIG_PATH="/paperclip/mcp-proxy-config.json"

info() { echo "→ $*"; }
die()  { echo "❌ $*" >&2; exit 1; }

# ── step 1: build proxy locally ────────────────────────────────────────────────

PROXY_SRC="$REPO_ROOT/packages/mcp-plugin-proxy"
[[ -d "$PROXY_SRC" ]] || die "Proxy source not found at $PROXY_SRC"

info "Building MCP proxy..."
cd "$PROXY_SRC"
install_out=$(npm install --ignore-scripts 2>&1) || { echo "$install_out"; die "npm install failed for mcp-plugin-proxy"; }
build_out=$(npm run build 2>&1) || { echo "$build_out"; die "npm build failed for mcp-plugin-proxy"; }
echo "$build_out" | tail -2
cd "$REPO_ROOT"

# ── step 2: copy proxy into container ─────────────────────────────────────────

info "Copying proxy into container at $PROXY_PATH..."
ssh "$SSH_HOST" "$DOCKER exec $CONTAINER mkdir -p $PROXY_PATH"
scp -q "$PROXY_SRC/dist/index.js" "$SSH_HOST:~/mcp-proxy-index.js"
scp -q "$PROXY_SRC/package.json" "$SSH_HOST:~/mcp-proxy-package.json"
ssh "$SSH_HOST" "$DOCKER cp ~/mcp-proxy-index.js $CONTAINER:$PROXY_PATH/index.js && \
                  $DOCKER cp ~/mcp-proxy-package.json $CONTAINER:$PROXY_PATH/package.json && \
                  rm ~/mcp-proxy-index.js ~/mcp-proxy-package.json"
ssh "$SSH_HOST" "$DOCKER exec $CONTAINER bash -c 'set -e; cd $PROXY_PATH && npm install --ignore-scripts'" \
  || die "npm install inside container failed for mcp-proxy"
info "Proxy installed at $PROXY_PATH"

# ── step 3: authenticate and resolve agent ID ─────────────────────────────────
# Do this before writing MCP config so we can include PC_AGENT_ID in the env block.

info "Authenticating with Paperclip at $PC_HOST..."
ssh "$SSH_HOST" "curl -s -X POST '$PC_HOST/api/auth/sign-in/email' \
  -H 'Content-Type: application/json' \
  -H 'Origin: $PC_HOST' \
  -c /tmp/pc_wire_cookies.txt \
  -d '{\"email\":\"$PC_EMAIL\",\"password\":\"$PC_PASSWORD\"}' > /dev/null"

if [[ -z "$AGENT_ID" ]]; then
  info "No agent-id given — looking up agents..."
  AGENT_ID=$(ssh "$SSH_HOST" "curl -s '$PC_HOST/api/agents' \
    -b /tmp/pc_wire_cookies.txt \
    -H 'Origin: $PC_HOST'" \
    | python3 -c "
import sys, json
agents = json.load(sys.stdin)
if not agents:
    print('NO_AGENTS')
else:
    # Prefer an agent with 'cfo' or 'assistant' in the name
    for a in agents:
        name = (a.get('name') or '').lower()
        if 'cfo' in name or 'assistant' in name:
            print(a['id'])
            break
    else:
        print(agents[0]['id'])
")
  [[ "$AGENT_ID" == "NO_AGENTS" ]] && die "No agents found on this instance. Create one in the Paperclip UI first."
  info "Using agent: $AGENT_ID"
fi

# ── step 4: write MCP config to /paperclip volume ────────────────────────────

info "Writing MCP config to $MCP_CONFIG_PATH..."
# Build JSON locally, pipe into container via ssh+tee (avoids Node require/ESM issues)
MCP_JSON=$(cat <<MCPEOF
{
  "skipDangerousModePermissionPrompt": true,
  "mcpServers": {
    "paperclip-plugins": {
      "type": "stdio",
      "command": "/usr/local/bin/node",
      "args": ["$PROXY_PATH/index.js"],
      "env": {
        "PC_HOST": "$PC_HOST_INTERNAL",
        "PC_EMAIL": "$PC_EMAIL",
        "PC_PASSWORD": "$PC_PASSWORD",
        "PC_COMPANY_ID": "$PC_COMPANY_ID",
        "PC_AGENT_ID": "$AGENT_ID"
      }
    }
  }
}
MCPEOF
)
echo "$MCP_JSON" | ssh "$SSH_HOST" "$DOCKER exec -i $CONTAINER tee $MCP_CONFIG_PATH" > /dev/null
info "Written: $MCP_CONFIG_PATH"

# ── step 5: verify proxy starts ───────────────────────────────────────────────

info "Verifying proxy starts inside container (6s test)..."
proxy_out=$(ssh "$SSH_HOST" "PC_PW='$PC_PASSWORD' $DOCKER exec \
  -e PC_HOST=$PC_HOST_INTERNAL \
  -e PC_EMAIL=$PC_EMAIL \
  -e PC_PASSWORD=\$PC_PW \
  -e PC_COMPANY_ID=$PC_COMPANY_ID \
  -e PC_AGENT_ID=$AGENT_ID \
  $CONTAINER timeout 6 node $PROXY_PATH/index.js 2>&1" || true)
if echo "$proxy_out" | grep -qi "Missing required env\|Cannot find module\|SyntaxError\|Error:"; then
  echo "$proxy_out"
  die "Proxy failed to start — check output above"
else
  echo "  proxy stderr: ${proxy_out:-<no output — likely started OK>}"
fi

# ── step 6: patch agent ────────────────────────────────────────────────────────

info "Patching agent $AGENT_ID with extraArgs..."
PATCH_RESULT=$(ssh "$SSH_HOST" "curl -s -X PATCH '$PC_HOST/api/agents/$AGENT_ID' \
  -b /tmp/pc_wire_cookies.txt \
  -H 'Content-Type: application/json' \
  -H 'Origin: $PC_HOST' \
  -d '{\"adapterConfig\":{\"extraArgs\":[\"--settings\",\"$MCP_CONFIG_PATH\"]}}'")

echo "$PATCH_RESULT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
cfg = d.get('adapterConfig', {})
extra = cfg.get('extraArgs', 'NOT SET')
print(f'  extraArgs = {extra}')
" 2>/dev/null || echo "  raw: $PATCH_RESULT"

# ── done ─────────────────────────────────────────────────────────────────────

echo ""
echo "✅ MCP proxy wired to agent $AGENT_ID"
echo "   Instance: $PC_HOST"
echo "   Config:   $MCP_CONFIG_PATH"
echo ""
echo "   Watch agent use tools:"
echo "   ssh $SSH_HOST \"DOCKER_HOST=unix:///var/run/docker.sock docker logs $CONTAINER -f 2>&1 | grep -i 'mcp\\\\|tool\\\\|plugin'\""
