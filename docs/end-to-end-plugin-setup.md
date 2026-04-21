# End-to-End Plugin Setup Guide

How to build, deploy, and wire a custom plugin so agents can call its tools — proven working on bare-metal Paperclip (NUC, 2026-04-21).

---

## Architecture

```
Claude agent
    │  --settings /paperclip-data/mcp-proxy-config.json
    ▼
mcp-plugin-proxy  (stdio MCP server on the VPS)
    │  fetches /api/plugins/tools at startup, re-exposes as MCP tools
    ▼
POST /api/plugins/tools/execute  (Paperclip REST — auth: assertBoardOrAgent)
    ▼
Plugin worker  (Node.js process, /paperclip-plugins/<slug>-vN/)
    │  lazy client init on first call, secrets resolved from DB
    ▼
External service  (IMAP, Dinero API, Slack, etc.)
```

---

## 1. Write the Plugin

### worker.ts — lazy client pattern (REQUIRED)

Tools must **always** be registered in `setup()`, even if config is missing. Check config lazily inside each handler:

```typescript
import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";

const plugin = definePlugin({
  async setup(ctx) {
    let cachedClient: MyClient | null = null;
    let configError: string | null = null;

    async function getClient(): Promise<MyClient | null> {
      if (cachedClient) return cachedClient;
      if (configError) return null;

      const config = await ctx.config.get() as MyPluginConfig;
      if (!config.apiKey) {
        configError = "Plugin not configured — set apiKey in plugin settings.";
        return null;
      }

      const secret = await ctx.secrets.resolve(config.apiKeyRef);
      cachedClient = new MyClient({ apiKey: secret });
      return cachedClient;
    }

    // Tools ALWAYS registered — never return early before this
    ctx.tools.register("my_tool", { /* schema */ }, async (params) => {
      const client = await getClient();
      if (!client) return { error: configError ?? "Not configured." };
      try {
        const result = await client.doSomething(params);
        return { content: JSON.stringify(result, null, 2) };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    ctx.logger.info("My plugin ready — 1 tool registered");
  },

  async onHealth() {
    return { status: "ok", message: "My plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url); // REQUIRED — without this, worker exits immediately
```

**Why the lazy pattern matters:** If `setup()` returns early on missing config, tools appear in `GET /api/plugins/tools` (from the manifest) but `POST /api/plugins/tools/execute` returns "No tool handler registered." The lazy pattern means tools are always callable and return a clear error instead.

### manifest.ts

```typescript
const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.my-plugin",
  displayName: "My Plugin",
  // ...
  tools: [
    {
      name: "my_tool",
      displayName: "My Tool",
      description: "...",
      parametersSchema: { type: "object", properties: { /* ... */ } },
    },
  ],
};
```

### deploy-config.json

```json
{
  "configJson": {
    "apiEndpoint": "https://api.example.com"
  },
  "secretRefs": {
    "apiKeyRef": {
      "uuid": "REPLACE_WITH_SECRET_UUID"
    }
  }
}
```

Per-customer overrides go in `customers/<slug>/plugin-<name>.json`. A customer file with `"secretRefs": {}` **fully replaces** the base secretRefs (not merge).

---

## 2. Deploy to a Customer VPS

```bash
# Set env
set -a
source customers/<slug>.env
source customers/<slug>.secrets
set +a

# Deploy (builds, copies, npm install, installs via API, sets config)
PC_CUSTOMER_CONFIG=customers/<slug>/plugin-<name>.json \
  bash scripts/deploy-plugin.sh packages/plugin-<name>
```

The script:
1. Runs `npm run build` (TypeScript → dist/)
2. Copies dist files flat to `/paperclip-plugins/<slug>-vN/` on the server
3. Runs `npm install --ignore-scripts` on the server
4. Symlinks the SDK: `node_modules/@paperclipai/plugin-sdk → /opt/paperclip/packages/plugins/sdk`
5. Authenticates with Paperclip, creates/reuses secrets, installs via `POST /api/plugins/install`
6. Sets config and restarts worker

**Provisioning a secret for the first time:**

```bash
# Create secret via API (from Mac, tunneled through SSH)
ssh <host> "echo '<base64-json>' | base64 -d | curl -s -X POST 'http://localhost:3100/api/companies/<companyId>/secrets' \
  -H 'Content-Type: application/json' -b /tmp/cookies.txt --data-binary @-"
# Returns: {"id":"<uuid>", ...}

# Then put the UUID in customers/<slug>/plugin-<name>.json:
# "secretRefs": { "mySecretRef": { "uuid": "<uuid>" } }
```

---

## 3. Wire MCP Proxy

Run once per instance to expose all plugin tools to agents:

```bash
bash scripts/wire-mcp-to-customer.sh <customer-slug>
```

This:
1. Builds `packages/mcp-plugin-proxy` locally
2. Copies it to `/paperclip-data/mcp-proxy/` on the VPS
3. Writes `/paperclip-data/mcp-proxy-config.json` (MCP server config with credentials)
4. Patches every agent's `adapterConfig.extraArgs` to `["--settings", "/paperclip-data/mcp-proxy-config.json"]`

Re-run after adding new plugins — the proxy fetches the tool list dynamically at startup, so it picks up new plugins automatically without re-wiring.

---

## 4. Smoke Test

```bash
bash scripts/smoke-test-plugins.sh <customer-slug>
```

Checks every installed plugin:
- Health endpoint → must return `healthy: true`
- Lightweight tool execution → must return no error

Expected output:
```
── Email ── ✅ Health: ready  ✅ Tool execute: email_list_folders
── Dinero ── ✅ Health: ready  ✅ Tool execute: dinero_get_balance
── Test Echo ── ✅ Health: ready  ✅ Tool execute: echo
Results: 6 passed, 0 failed
All checks passed ✅
```

---

## 5. Fork Requirements

Plugins require two patches in `github.com/gustav-gearloose/paperclip` (applied in TypeScript source, not compiled JS):

**patch 1 — `packages/server/src/services/plugin-loader.ts:~1815`**
```typescript
// Before (upstream bug — uses string key instead of DB UUID):
toolDispatcher.registerPluginTools(pluginKey, manifest)
// After:
toolDispatcher.registerPluginTools(pluginId, manifest)
```
Without this, tools are registered under the manifest key string (e.g. `gearloose.email`) but executed by UUID — every tool call fails.

**patch 2 — `packages/server/src/routes/authz.ts` + `plugins.ts`**
```typescript
// Add assertBoardOrAgent() that accepts both board users and agent tokens
// Apply it on POST /plugins/tools/execute routes instead of assertBoard()
```
Without this, agents get 401 when calling plugin tools.

---

## Key Facts

- Plugin workers are long-running Node processes managed by Paperclip's plugin loader
- Tools registered via `ctx.tools.register()` in `setup()` — manifest tools array is metadata only
- Config and secrets live in Paperclip's PostgreSQL DB, resolved at runtime by the worker
- `runWorker(plugin, import.meta.url)` at the end of worker.ts is mandatory — missing it causes worker to exit cleanly and plugin to enter error state
- Tool names in the REST API are `<pluginId>:<toolName>` where pluginId is the DB UUID
