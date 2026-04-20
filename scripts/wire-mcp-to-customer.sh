#!/usr/bin/env bash
# wire-mcp-to-customer.sh — install the MCP plugin proxy on a customer's Paperclip instance
# and patch their default agent to use it, so Claude agents can call plugin tools.
#
# Paperclip runs bare-metal (systemd). The proxy is installed directly on the host filesystem.
#
# Usage:
#   PC_PASSWORD=<pw> ./scripts/wire-mcp-to-customer.sh <customer-slug> [agent-id]
#
# If agent-id is omitted, patches all agents found on the instance.
# Reads instance config from customers/<customer-slug>.env.

set -euo pipefail

CUSTOMER="${1:?Usage: $0 <customer-slug> [agent-id]}"
AGENT_ID="${2:-}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV_FILE="$REPO_ROOT/customers/$CUSTOMER.env"
SECRETS_FILE="$REPO_ROOT/customers/$CUSTOMER.secrets"

[[ -f "$ENV_FILE" ]] || { echo "❌ No customer config at $ENV_FILE" >&2; exit 1; }

set -a
source "$ENV_FILE"
[[ -f "$SECRETS_FILE" ]] && source "$SECRETS_FILE"
set +a

[[ -n "${PC_PASSWORD:-}" ]] || { echo "❌ PC_PASSWORD is not set" >&2; exit 1; }

SSH_HOST="${SSH_HOST:?SSH_HOST not set in $ENV_FILE}"
PC_HOST="${PC_HOST:?PC_HOST not set in $ENV_FILE}"
PC_HOST_INTERNAL="http://localhost:3100"
PC_ORIGIN="${PC_ORIGIN:-$PC_HOST}"
PC_EMAIL="${PC_EMAIL:?PC_EMAIL not set in $ENV_FILE}"
PC_COMPANY_ID="${PC_COMPANY_ID:?PC_COMPANY_ID not set in $ENV_FILE}"
PAPERCLIP_DATA="${PAPERCLIP_DATA:-/paperclip-data}"
PROXY_PATH="$PAPERCLIP_DATA/mcp-proxy"
MCP_CONFIG_PATH="$PAPERCLIP_DATA/mcp-proxy-config.json"

CURRENT_USER=$(ssh "$SSH_HOST" "whoami")

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

# ── step 2: copy proxy to server ──────────────────────────────────────────────

info "Installing proxy at $SSH_HOST:$PROXY_PATH..."
ssh "$SSH_HOST" "mkdir -p $PROXY_PATH"
scp -q "$PROXY_SRC/dist/index.js" "$SSH_HOST:$PROXY_PATH/index.js"
scp -q "$PROXY_SRC/package.json" "$SSH_HOST:$PROXY_PATH/package.json"
ssh "$SSH_HOST" "cd $PROXY_PATH && npm install --ignore-scripts" \
  || die "npm install failed for mcp-proxy"
info "Proxy installed at $PROXY_PATH"

# ── step 3: authenticate and resolve agent IDs ───────────────────────────────

info "Authenticating with Paperclip at $PC_HOST..."
_AUTH_B64=$(python3 -c "import json,base64,sys; print(base64.b64encode(json.dumps({'email':sys.argv[1],'password':sys.argv[2]}).encode()).decode())" "$PC_EMAIL" "$PC_PASSWORD")
ssh "$SSH_HOST" "echo $_AUTH_B64 | base64 -d | curl -s -X POST '$PC_HOST/api/auth/sign-in/email' \
  -H 'Content-Type: application/json' \
  -H 'Origin: $PC_ORIGIN' \
  -c /tmp/pc_wire_cookies.txt \
  --data-binary @- > /dev/null"

ALL_AGENT_IDS=()
if [[ -z "$AGENT_ID" ]]; then
  info "No agent-id given — patching ALL agents..."
  mapfile -t ALL_AGENT_IDS < <(ssh "$SSH_HOST" "curl -s '$PC_HOST/api/companies/$PC_COMPANY_ID/agents' \
    -b /tmp/pc_wire_cookies.txt \
    -H 'Origin: $PC_ORIGIN'" \
    | python3 -c "
import sys, json
agents = json.load(sys.stdin)
if not isinstance(agents, list) or not agents:
    print('NO_AGENTS')
else:
    for a in agents:
        print(a['id'])
")
  [[ "${ALL_AGENT_IDS[0]:-}" == "NO_AGENTS" ]] && die "No agents found. Create one in the Paperclip UI first."
  info "Found ${#ALL_AGENT_IDS[@]} agents to patch"
else
  ALL_AGENT_IDS=("$AGENT_ID")
fi

# ── step 4: write MCP config file ────────────────────────────────────────────

info "Writing MCP config to $SSH_HOST:$MCP_CONFIG_PATH..."
MCP_JSON=$(python3 -c "
import json, sys
cfg = {
    'skipDangerousModePermissionPrompt': True,
    'mcpServers': {
        'paperclip-plugins': {
            'type': 'stdio',
            'command': '/usr/local/bin/node',
            'args': [sys.argv[1] + '/index.js'],
            'env': {
                'PC_HOST': sys.argv[2],
                'PC_ORIGIN': sys.argv[7],
                'PC_EMAIL': sys.argv[3],
                'PC_PASSWORD': sys.argv[4],
                'PC_COMPANY_ID': sys.argv[5],
                'PC_AGENT_ID': sys.argv[6],
            }
        }
    }
}
print(json.dumps(cfg, indent=2))
" "$PROXY_PATH" "$PC_HOST_INTERNAL" "$PC_EMAIL" "$PC_PASSWORD" "$PC_COMPANY_ID" "${ALL_AGENT_IDS[0]}" "$PC_ORIGIN")

printf '%s' "$MCP_JSON" | ssh "$SSH_HOST" "cat > $MCP_CONFIG_PATH"
ssh "$SSH_HOST" "chmod 600 $MCP_CONFIG_PATH"
info "Written: $MCP_CONFIG_PATH"

# ── step 5: verify proxy starts ───────────────────────────────────────────────

info "Verifying proxy starts (6s test)..."
_PW_B64=$(printf '%s' "$PC_PASSWORD" | base64)
proxy_out=$(ssh "$SSH_HOST" "
  RUNNER=\$(mktemp /tmp/pc_proxy_test_XXXXXX.sh)
  printf '%s\n' '#!/bin/sh' \
    'export PC_PASSWORD=\$(echo $_PW_B64 | base64 -d)' \
    'export PC_HOST=$PC_HOST_INTERNAL' \
    'export PC_ORIGIN=$PC_ORIGIN' \
    'export PC_EMAIL=$PC_EMAIL' \
    'export PC_COMPANY_ID=$PC_COMPANY_ID' \
    'export PC_AGENT_ID=${ALL_AGENT_IDS[0]}' \
    'exec timeout 6 node $PROXY_PATH/index.js' > \$RUNNER
  chmod +x \$RUNNER
  sh \$RUNNER 2>&1 || true
  rm -f \$RUNNER
" 2>&1 || true)

if echo "$proxy_out" | grep -qi "Missing required env\|Cannot find module\|SyntaxError\|Error:"; then
  echo "$proxy_out"
  die "Proxy failed to start — check output above"
elif echo "$proxy_out" | grep -qi "Loaded.*plugin tools\|plugin proxy running"; then
  echo "  ✅ Proxy started and loaded tools:"
  echo "$proxy_out" | grep -i "Loaded\|plugin proxy running\|WARNING" | sed 's/^/     /'
elif echo "$proxy_out" | grep -qi "WARNING.*0 tools\|returned 0 tools"; then
  echo "  ⚠️  Proxy started but loaded 0 tools — plugins may not be provisioned yet"
  echo "$proxy_out" | tail -6 | sed 's/^/     /'
else
  echo "  proxy output: ${proxy_out:-<no output — likely started OK, timeout killed it>}"
fi

# ── step 6: patch agents ──────────────────────────────────────────────────────

_PATCH_B64=$(python3 -c "import json,base64,sys; print(base64.b64encode(json.dumps({'adapterConfig':{'extraArgs':['--settings',sys.argv[1]]}}).encode()).decode())" "$MCP_CONFIG_PATH")
PATCHED=()
for aid in "${ALL_AGENT_IDS[@]}"; do
  info "Patching agent $aid with extraArgs..."
  PATCH_RESULT=$(ssh "$SSH_HOST" "echo $_PATCH_B64 | base64 -d | curl -s -X PATCH '$PC_HOST/api/agents/$aid' \
    -b /tmp/pc_wire_cookies.txt \
    -H 'Content-Type: application/json' \
    -H 'Origin: $PC_ORIGIN' \
    --data-binary @-")
  echo "$PATCH_RESULT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
cfg = d.get('adapterConfig', {})
extra = cfg.get('extraArgs', 'NOT SET')
print(f'  extraArgs = {extra}')
" 2>/dev/null || echo "  raw: $PATCH_RESULT"
  PATCHED+=("$aid")
done

# ── done ─────────────────────────────────────────────────────────────────────

echo ""
echo "✅ MCP proxy wired to ${#PATCHED[@]} agent(s)"
echo "   Instance: $PC_HOST"
echo "   Config:   $MCP_CONFIG_PATH"
echo ""
echo "   Watch agent use tools:"
echo "   ssh $SSH_HOST 'journalctl -u paperclip -f | grep -i mcp'"
