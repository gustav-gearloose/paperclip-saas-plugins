# MCP Proxy Wiring Runbook

Goal: make Claude agents in Paperclip automatically have access to plugin tools
(Dinero, Email) via the MCP proxy at /paperclip/mcp-proxy/index.js

## Status before this runbook
- /paperclip/mcp-proxy/index.js copied to container ✅
- npm install done inside container ✅  
- Proxy verified to load 13 tools when run standalone ✅
- Missing: ~/.claude/settings.json inside container pointing to proxy

## Step 1: Write MCP config to /paperclip (persists in volume)

```bash
ssh nuc "DOCKER_HOST=unix:///var/run/docker.sock docker exec paperclip-deploy-paperclip-1 bash -c 'cat > /paperclip/mcp-proxy-config.json << JSONEOF
{\"mcpServers\":{\"paperclip-plugins\":{\"type\":\"stdio\",\"command\":\"/usr/local/bin/node\",\"args\":[\"/paperclip/mcp-proxy/index.js\"],\"env\":{\"PC_HOST\":\"http://100.66.0.88:3100\",\"PC_EMAIL\":\"gustav@gearloose.dk\",\"PC_COMPANY_ID\":\"df675b10-abcb-43e1-9a0c-69a88ccf705c\"}}}}
JSONEOF
echo done'"
```

NOTE: Password is NOT in this file — use CLAUDE_SETTINGS env approach OR patch execute.js
to inject --mcp-config (see Step 3). The proxy needs the password to auth.

Better: write it with password via the NUC's env (secret kept on NUC host):

```bash
ssh nuc 'DOCKER_HOST=unix:///var/run/docker.sock docker exec paperclip-deploy-paperclip-1 bash -c "
mkdir -p /paperclip/mcp-proxy
node -e \"
const cfg = {
  mcpServers: {
    'paperclip-plugins': {
      type: 'stdio',
      command: '/usr/local/bin/node',
      args: ['/paperclip/mcp-proxy/index.js'],
      env: {
        PC_HOST: 'http://100.66.0.88:3100',
        PC_EMAIL: 'gustav@gearloose.dk',
        PC_PASSWORD: process.env.PC_PW,
        PC_COMPANY_ID: 'df675b10-abcb-43e1-9a0c-69a88ccf705c'
      }
    }
  }
};
require('fs').writeFileSync('/paperclip/mcp-proxy-config.json', JSON.stringify(cfg, null, 2));
console.log('written');
\" 
" PC_PW=FILL_IN_HERE'
```

## Step 2: Write ~/.claude/settings.json inside container

This is ephemeral (lost on container restart) but works until then:

```bash
ssh nuc "DOCKER_HOST=unix:///var/run/docker.sock docker exec paperclip-deploy-paperclip-1 bash -c '
mkdir -p /home/gustavemilholmsimonsen/.claude
cat > /home/gustavemilholmsimonsen/.claude/settings.json << EOF
{
  \"skipDangerousModePermissionPrompt\": true,
  \"mcpServers\": {
    \"paperclip-plugins\": {
      \"type\": \"stdio\",
      \"command\": \"/usr/local/bin/node\",
      \"args\": [\"/paperclip/mcp-proxy/index.js\"],
      \"env\": {
        \"PC_HOST\": \"http://100.66.0.88:3100\",
        \"PC_EMAIL\": \"gustav@gearloose.dk\",
        \"PC_PASSWORD\": \"FILL_IN\",
        \"PC_COMPANY_ID\": \"df675b10-abcb-43e1-9a0c-69a88ccf705c\"
      }
    }
  }
}
EOF
echo settings written'"
```

## Step 3 (alternative to Step 2): Patch execute.js to inject --mcp-config

This survives container restarts (we patch the compiled JS).

Find the file:
```bash
ssh nuc "DOCKER_HOST=unix:///var/run/docker.sock docker exec paperclip-deploy-paperclip-1 find /app -name 'execute.js' -path '*/claude-local/*' 2>/dev/null"
```

Look for the line that pushes extraArgs and add --mcp-config before it:
```bash
ssh nuc "DOCKER_HOST=unix:///var/run/docker.sock docker exec paperclip-deploy-paperclip-1 grep -n 'extraArgs' /app/packages/adapters/claude-local/dist/server/execute.js | head -10"
```

The patch: find the `return args` at the end of buildClaudeArgs, and insert:
```javascript
args.push("--mcp-config", "/paperclip/mcp-proxy-config.json");
```

## Step 4: Make ~/.claude/settings.json survive restarts

Add to NUC crontab (@reboot):
```
@reboot sleep 30 && DOCKER_HOST=unix:///var/run/docker.sock /usr/bin/docker exec paperclip-deploy-paperclip-1 bash -c 'mkdir -p /home/gustavemilholmsimonsen/.claude && cat /paperclip/claude-settings.json > /home/gustavemilholmsimonsen/.claude/settings.json' 2>/dev/null
```

Store the settings JSON at /paperclip/claude-settings.json (persists in volume).

## Step 5: Verify

```bash
# Trigger CFO heartbeat
ssh nuc "curl -s -X POST http://localhost:3100/api/companies/df675b10-abcb-43e1-9a0c-69a88ccf705c/agents/c1f1e634-24fe-4e40-b293-3bdc3ef7f8a0/heartbeat \
  -b /tmp/pc_deploy_cookies.txt \
  -H 'Origin: http://100.66.0.88:3100' \
  -H 'Content-Type: application/json'"

# Watch logs for MCP tool calls
ssh nuc "DOCKER_HOST=unix:///var/run/docker.sock docker logs paperclip-deploy-paperclip-1 --since 2m -f 2>&1 | grep -E 'mcp|plugin|tool|dinero' -i"
```
