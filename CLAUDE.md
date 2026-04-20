# Paperclip SaaS Plugins — Claude Code Context

## Project purpose

This repo contains custom Paperclip plugins and supporting scripts for Gearloose's paperclip-saas offering:
helping AI-curious Danish SMEs set up a self-hosted Paperclip AI instance with connectors to their business tools
(Dinero, e-conomic, Email, HubSpot, Slack, etc.).

The live field guide for operating the plugin system is **PLUGIN-SYSTEM.md** in this repo.
Everything below is guidance for Claude Code specifically.

---

## Repo layout

```
packages/
  plugin-dinero/          # Dinero accounting connector
  plugin-email/           # IMAP/SMTP email connector
  plugin-economic/        # e-conomic connector
  plugin-hubspot/         # HubSpot CRM connector
  plugin-billy/           # Billy accounting connector
  plugin-zendesk/         # Zendesk support connector
  plugin-slack/           # Slack connector
  plugin-notion/          # Notion connector
  plugin-linear/          # Linear project management connector
  plugin-google-sheets/   # Google Sheets connector
  mcp-plugin-proxy/       # MCP bridge: exposes plugin tools to Claude CLI agents
scripts/
  deploy-plugin.sh        # Full 10-step plugin deploy pipeline
  provision-plugin.sh     # Creates secrets + deploys for a specific customer
  wire-mcp-to-paperclip.sh  # Wires MCP proxy into Paperclip agent on NUC
  patch-paperclip-container.sh  # Re-applies compiled JS patches after image rebuild
  post-upgrade.sh         # Full post-upgrade recovery sequence
customers/
  <slug>/                 # Per-customer config files: plugin-*.json with secret UUIDs
docs/
  plugin-credentials.md   # Where to find credentials for each plugin
```

---

## SDK patterns

Every plugin uses `@paperclipai/plugin-sdk`. Key imports:

```typescript
import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
```

Worker pattern (current, validated):
```typescript
const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as MyConfig;
    const secret = await ctx.secrets.resolve(config.mySecretRef);
    ctx.tools.register("tool_name", { /* schema */ }, async (params): Promise<ToolResult> => {
      try {
        // ...
        return { content: JSON.stringify(data, null, 2) };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });
  },
  async onHealth() { return { status: "ok", message: "..." }; }
});

export default plugin;
runWorker(plugin, import.meta.url);
```

**Critical constraints:**
- No external npm dependencies — only Node.js builtins + `@paperclipai/plugin-sdk`
- `entrypoints.worker` in manifest must be `"./worker.js"` (relative to plugin root, not `src/`)
- `apiVersion` must be a number (`1`), not a string
- Tools must be declared in **both** `manifest.ts tools[]` array AND registered in `worker.ts setup()`
- `ToolResult` shape: `{ content: string }` for success or `{ error: string }` for failure

---

## NUC deploy — Dockerfile COPY pattern

Plugins are baked into the Docker image at versioned root paths. The Dockerfile at `~/paperclip-deploy/Dockerfile` on the NUC:

```dockerfile
FROM ghcr.io/paperclipai/paperclip:latest

COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Increment version suffix (e.g. -v6 → -v7) on breaking changes so
# old DB install records still resolve to the old path during transition.
COPY plugin-dinero-install/ /paperclip-dinero-v6/
COPY plugin-email-install/ /paperclip-email-v6/

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "--import", "./server/node_modules/tsx/dist/loader.mjs", "server/dist/index.js"]
```

The `plugin-dinero-install/` dir (in the NUC build context) contains the compiled dist files:
`manifest.js`, `worker.js`, `package.json`, and any other JS the worker needs.

**When to increment the version suffix:** Any time the plugin's `manifest.js` or `worker.js` changes
in a way that changes tool names, parameters, or config schema. The DB stores the install path;
old path still works until you explicitly re-install pointing at the new path.

**After rebuilding the image:** The container patches (compiled JS fixes for the Paperclip bug)
are lost. Run `post-upgrade.sh` immediately after every image rebuild.

---

## Paperclip admin bootstrap (NUC)

After a DB reset or fresh container, Paperclip starts in `bootstrap_pending` state. To claim admin:

```bash
ssh nuc
docker exec paperclip-deploy-paperclip-1 pnpm paperclipai auth bootstrap-ceo --base-url http://localhost:3100 --force
```

Copy the invite URL, replace `localhost` with `100.66.0.88` (NUC Tailscale IP), open in browser.
Use `--force` to regenerate a new invite if the old one expired.

The running container name is `paperclip-deploy-paperclip-1` (not `paperclipai-docker-server-1`).

---

## API auth pattern (for scripts)

```bash
curl -s -c /tmp/pc_cookies.txt \
  -X POST http://localhost:3100/api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3100' \
  -d '{"email":"...","password":"..."}'
```

The `Origin` header is **required** — Paperclip's CSRF check rejects requests without it.

---

## Dinero API — verified correct URLs (2026-04-20)

Validated against official OpenAPI spec at `https://api.dinero.dk/openapi/index.html`.

| Endpoint | Correct path | Notes |
|----------|-------------|-------|
| List invoices | `GET /v1/{orgId}/invoices` | NOT `/sales/invoices` |
| Get invoice | `GET /v1/{orgId}/invoices/{guid}` | |
| Create invoice | `POST /v1/{orgId}/invoices` | NOT `/sales/invoices` |
| List contacts | `GET /v2/{orgId}/contacts` | **v2**, NOT v1 |
| Create contact | `POST /v1/{orgId}/contacts` | v1 |
| List accounts | `GET /v1/{orgId}/accounts` | |
| Key figures | `GET /v1/{orgId}/keyfigures` | |
| Ledger entries | `GET /v1/{orgId}/entries` | params: `fromDate`, `toDate`, `includePrimo` |
| Entries changes | `GET /v1/{orgId}/entries/changes` | params: `changesFrom`, `changesTo`, `includePrimo` |
| VAT report | `GET /v1/{orgId}/vatreport` | params: `dateFrom`, `dateTo` |
| Products | `GET /v1/{orgId}/products` | |

**Auth:** OAuth2 password grant to `https://authz.dinero.dk/dineroapi/oauth/token`.
- Basic auth: `clientId:clientSecret` base64
- Body: `grant_type=password&scope=read write&username={apiKey}&password={apiKey}`

**Common errors:**
- `404` on `/sales/invoices` → use `/invoices` 
- `401` on `/v1/{orgId}/contacts` → use v2: `https://api.dinero.dk/v2/{orgId}/contacts`
- `/vouchers` does not exist as a list endpoint — use `/entries` for ledger data

The `request()` method in `dinero-client.ts` takes an optional `"v1" | "v2"` argument for the API version:
```typescript
private async request<T>(path: string, options: RequestInit = {}, apiVersion: "v1" | "v2" = "v1"): Promise<T>
```

---

## TypeScript conventions for API clients

- Use typed interfaces for all config, params, and return shapes — no `any`
- `Record<string, unknown>` casts in the worker are OK at tool-boundary (params come in as `unknown`)
- API client methods should use typed interfaces, not `Record<string, unknown>` internally
- Return `unknown` from API methods when the response schema is not owned by us
- Token refresh: check `Date.now() < tokenExpiresAt - 60_000` (60s buffer before actual expiry)
- Use `Promise.allSettled` for composite calls so a partial failure doesn't kill the whole response
- Error pattern: `err instanceof Error ? err.message : String(err)`

---

## Known Paperclip bug (2026-04-20)

`GET /api/plugins/tools` returns 0 tools despite plugin being healthy and installed.

**Root cause:** `plugin-loader.js` calls `toolDispatcher.registerPluginTools(pluginKey, manifest)` 
without passing the DB UUID. Workers are keyed by UUID; lookup fails silently.

**Fix:** Patch the compiled JS files in the running container after every image rebuild:
- `post-upgrade.sh` handles this automatically
- `patch-paperclip-container.sh` applies patches without full redeploy

Until Paperclip ships an upstream fix, this patch is required on every image rebuild.

---

## Greenhouse plugin (pending)

Skeleton built at `packages/plugin-greenhouse/`. Still needs:
- Wiring into `scripts/add-plugin.sh`
- Wiring into `scripts/onboard-customer.sh`
- Wiring into `scripts/smoke-test-plugins.sh`
- Entry in `docs/plugin-credentials.md`
- NUC Dockerfile COPY line + build context dir

Auth: Basic `apiKey:` (colon after key, empty password). `On-Behalf-Of` header for write ops.
Base URL: `https://harvest.greenhouse.io/v1`
