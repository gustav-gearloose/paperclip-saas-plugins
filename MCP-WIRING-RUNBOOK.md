# MCP Proxy Wiring Runbook

**Current approach (as of 2026-04-20):** fully automated via `wire-mcp-to-customer.sh`.
The older manual steps below this section are kept for reference only.

---

## One-command wiring

```bash
PC_PASSWORD=<pw> ./scripts/wire-mcp-to-customer.sh <customer-slug>
# e.g.
PC_PASSWORD=$PC_PASSWORD ./scripts/wire-mcp-to-customer.sh gearloose
```

What the script does:
1. Builds the MCP proxy from `packages/mcp-plugin-proxy/`
2. Copies `index.js` + `package.json` into the container at `/paperclip/mcp-proxy/`
3. Runs `npm install` inside the container
4. Writes `/paperclip/mcp-proxy-config.json` (persists in Docker volume) via `ssh | docker exec -i tee`
5. Authenticates with Paperclip and finds the customer's agent (prefers name containing "cfo" or "assistant")
6. PATCHes the agent with `adapterConfig.extraArgs: ["--settings", "/paperclip/mcp-proxy-config.json"]`

The `--settings` flag is Claude Code's mechanism for loading an MCP server config. Paperclip passes `extraArgs` to the `claude` CLI when spawning agent conversations.

**The config persists in `/paperclip/` (Docker volume) and the agent patch persists in the DB — both survive container restarts.**

---

## Verifying after wiring

```bash
# Check the agent's adapterConfig was patched
ssh <ssh-host> "curl -s 'http://localhost:3100/api/agents' \
  -b /tmp/pc_wire_cookies.txt \
  -H 'Origin: http://localhost:3100'" | python3 -c "
import sys, json
for a in json.load(sys.stdin):
    print(a['name'], a.get('adapterConfig', {}).get('extraArgs', 'NOT SET'))
"

# Watch container logs during a conversation (look for MCP handshake)
ssh <ssh-host> "DOCKER_HOST=unix:///var/run/docker.sock docker logs paperclipai-docker-server-1 --since 1m -f 2>&1 | grep -Ei 'mcp|plugin|tool|dinero|paperclip-plugin'"
```

## Smoke testing all plugins

```bash
./scripts/smoke-test-plugins.sh <customer-slug>
```

Checks health + executes one tool per installed plugin. Exit 0 = all pass.

---

## Re-wiring after a Paperclip upgrade

If the container image is rebuilt (Paperclip upgrade):
1. Re-run `wire-mcp-to-customer.sh` — it will re-copy the proxy and re-npm-install
2. The `adapterConfig` patch on the agent persists in the DB, so step 6 is a no-op (patch is idempotent)
3. Re-run `deploy-for-customer.sh` for any plugins (compiled JS in container is lost on rebuild)

## Known issue: Paperclip plugin-loader bug (patched in compiled JS)

`plugin-loader.js` calls `toolDispatcher.registerPluginTools(pluginKey, manifest)` without passing
the DB UUID → tools stored `pluginDbId = pluginKey` → `workerManager.isRunning()` returns false.

**Patch location:** inside container at:
- `/app/server/dist/services/plugin-tool-dispatcher.js` line ~210
- `/app/server/dist/services/plugin-loader.js` line ~1085

This patch is **lost on container image rebuild**. Must reapply. See `PLUGIN-SYSTEM.md` for details.
