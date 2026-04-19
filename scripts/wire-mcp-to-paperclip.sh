#!/usr/bin/env bash
# Wire the MCP plugin proxy into the Paperclip container so Claude agents
# can call Dinero/Email/etc tools in conversations.
#
# Run this on the NUC host after container is running.
# Usage: PC_PASSWORD=<pw> bash wire-mcp-to-paperclip.sh
set -euo pipefail

CONTAINER="paperclip-deploy-paperclip-1"
DOCKER="DOCKER_HOST=unix:///var/run/docker.sock docker"
PC_HOST="http://100.66.0.88:3100"          # used by this script (external, from NUC host)
PC_HOST_INTERNAL="http://localhost:3100"   # used by proxy inside container
PC_EMAIL="gustav@gearloose.dk"
PC_COMPANY_ID="df675b10-abcb-43e1-9a0c-69a88ccf705c"
CFO_AGENT_ID="c1f1e634-24fe-4e40-b293-3bdc3ef7f8a0"
PROXY_PATH="/paperclip/mcp-proxy"
MCP_CONFIG_PATH="/paperclip/mcp-proxy-config.json"

if [[ -z "${PC_PASSWORD:-}" ]]; then
  echo "ERROR: Set PC_PASSWORD env var before running this script"
  exit 1
fi

echo "=== Step 1: Ensure MCP proxy is in container ==="
eval "$DOCKER exec $CONTAINER ls $PROXY_PATH/index.js" 2>/dev/null \
  && echo "Proxy already at $PROXY_PATH" \
  || {
    eval "$DOCKER exec $CONTAINER mkdir -p $PROXY_PATH"
    eval "$DOCKER cp ~/paperclip-mcp-proxy/index.js $CONTAINER:$PROXY_PATH/index.js"
    eval "$DOCKER cp ~/paperclip-mcp-proxy/package.json $CONTAINER:$PROXY_PATH/package.json"
    eval "$DOCKER exec $CONTAINER bash -c 'cd $PROXY_PATH && npm install --ignore-scripts 2>&1 | tail -3'"
    echo "Proxy installed."
  }

echo ""
echo "=== Step 2: Write MCP config to /paperclip volume (persists across restarts) ==="
# Build config JSON locally then pipe it into the container via tee
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
        "PC_COMPANY_ID": "$PC_COMPANY_ID"
      }
    }
  }
}
MCPEOF
)
echo "$MCP_JSON" | eval "$DOCKER exec -i $CONTAINER tee $MCP_CONFIG_PATH" > /dev/null
echo "Written: $MCP_CONFIG_PATH"

echo ""
echo "=== Step 3: Verify proxy starts inside container ==="
eval "$DOCKER exec -e PC_HOST=$PC_HOST_INTERNAL -e PC_EMAIL=$PC_EMAIL -e PC_PASSWORD=$PC_PASSWORD -e PC_COMPANY_ID=$PC_COMPANY_ID $CONTAINER timeout 6 node $PROXY_PATH/index.js 2>&1" || true

echo ""
echo "=== Step 4: Authenticate with Paperclip API ==="
AUTH_RESP=$(curl -s -X POST "$PC_HOST/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -H "Origin: $PC_HOST" \
  -c /tmp/pc_wire_cookies.txt \
  -d "{\"email\":\"$PC_EMAIL\",\"password\":\"$PC_PASSWORD\"}")
echo "Auth: $(echo "$AUTH_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK, user:', d.get('user',{}).get('email','?'))" 2>/dev/null || echo "$AUTH_RESP")"

echo ""
echo "=== Step 5: Patch CFO agent to add --settings extraArgs ==="
# PATCH /api/agents/:id with adapterConfig.extraArgs array
# Claude CLI --settings flag: loads additional settings (including mcpServers) from a file
PATCH_RESP=$(curl -s -X PATCH "$PC_HOST/api/agents/$CFO_AGENT_ID" \
  -b /tmp/pc_wire_cookies.txt \
  -H "Content-Type: application/json" \
  -H "Origin: $PC_HOST" \
  -d "{\"adapterConfig\":{\"extraArgs\":[\"--settings\",\"$MCP_CONFIG_PATH\"]}}")
echo "Patch result: $(echo "$PATCH_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
cfg = d.get('adapterConfig', {})
print('extraArgs =', cfg.get('extraArgs', 'NOT SET'))
" 2>/dev/null || echo "$PATCH_RESP")"

echo ""
echo "=== Done! ==="
echo "The CFO agent will now pass '--settings $MCP_CONFIG_PATH' to Claude CLI."
echo "This loads the paperclip-plugins MCP server with all Dinero+Email tools."
echo ""
echo "Test: trigger a CFO heartbeat and watch logs:"
echo "  DOCKER_HOST=unix:///var/run/docker.sock docker logs $CONTAINER -f 2>&1 | grep -i 'mcp\\|plugin\\|dinero\\|tool'"
