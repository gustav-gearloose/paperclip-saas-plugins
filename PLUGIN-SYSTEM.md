# Paperclip Custom Plugin System — Gearloose Field Guide

Status as of 2026-04-20. Validated on NUC instance (Paperclip self-hosted via Docker).

## What Works End-to-End

| Layer | Status | Notes |
|-------|--------|-------|
| Plugin installation | ✅ | `POST /api/plugins/install` with `isLocalPath: true` |
| Tool declaration | ✅ | Must be in manifest `tools[]` array AND registered in worker |
| Tool execution via API | ✅ | `POST /api/plugins/tools/execute` returns real data |
| MCP proxy (standalone) | ✅ | Refreshes tool list on every ListTools call — picks up new plugins automatically |
| Agent tool use in conversations | 🔄 | Deploy script ready; pending NUC + MCP wiring |

## Architecture

```
Paperclip Agent (CFO, etc.)
    ↓ runs
claude CLI  ←→  MCP proxy (Node.js)
                    ↓ HTTP
                Paperclip API  (/api/plugins/tools/execute)
                    ↓ IPC (JSON-RPC 2.0 over stdio)
                Plugin Worker (Dinero, Email, etc.)
                    ↓ HTTPS
                External API (Dinero API, IMAP, etc.)
```

## Plugin Structure

Every plugin needs:

```
plugin-name/
├── package.json          # "type": "module", no paperclipPlugin field needed
├── manifest.js           # compiled from manifest.ts
└── worker.js             # compiled from worker.ts
```

### manifest.ts skeleton

```typescript
import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.myplugin",   // reverse-domain format
  apiVersion: 1,               // number, not string
  version: "0.1.0",
  displayName: "My Plugin",
  description: "What it does.",
  author: "Gearloose",
  categories: ["connector"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "instance.settings.register",
  ],
  entrypoints: {
    worker: "./worker.js",     // relative to plugin dir root, not src/
  },
  instanceConfigSchema: { /* JSON Schema for plugin settings */ },
  tools: [                     // CRITICAL: tools must be declared here for host discovery
    {
      name: "tool_name",
      displayName: "Tool Name",
      description: "What it does.",
      parametersSchema: {
        type: "object",
        required: ["param1"],
        properties: {
          param1: { type: "string", description: "..." },
        },
      },
    },
  ],
};
export default manifest;
```

### worker.ts skeleton

```typescript
import type { PluginWorkerContext } from "@paperclipai/plugin-sdk";

export default async function worker(ctx: PluginWorkerContext) {
  const config = await ctx.config.get();
  const apiKey = await ctx.secrets.resolve(config.apiKeyRef as string);

  ctx.tools.register("tool_name", {
    description: "What it does.",
    parameters: {
      type: "object",
      required: ["param1"],
      properties: {
        param1: { type: "string" },
      },
    },
  }, async (params: unknown) => {
    const { param1 } = params as { param1: string };
    // ... call external API ...
    return { content: `Result: ${result}` };
  });
}
```

## Known Bugs & Patches

### Bug 1: Plugin tools not visible to agents (Paperclip server bug)

**Symptom:** `GET /api/plugins/tools` returns 0 tools despite plugin being healthy.

**Root cause:** `plugin-loader.js` calls `toolDispatcher.registerPluginTools(pluginKey, manifest)` 
without passing the DB UUID. Workers are keyed by DB UUID; lookup fails.

**Patch** (applied to compiled JS in container — lost on image rebuild):
- `/app/server/dist/services/plugin-tool-dispatcher.js` line ~210: add `pluginDbId` param
- `/app/server/dist/services/plugin-loader.js` line ~1085: pass DB UUID as 3rd arg

**Workaround for rebuild:** Re-apply patch via `docker exec` after every image update.
Track upstream fix: open issue or check Paperclip changelog before each upgrade.

## Install Procedure (Automated)

Use `scripts/deploy-plugin.sh` — handles the full 10-step pipeline:

```bash
cd packages/plugin-dinero  # or plugin-email, etc.
bash ../../scripts/deploy-plugin.sh
```

Requires `deploy-config.json` in the plugin directory.

## MCP Proxy — Wiring Plugin Tools to Claude Agents

The MCP proxy at `packages/mcp-plugin-proxy/` bridges plugin tools into Claude CLI 
conversations via the Model Context Protocol.

### How it works

1. On startup: authenticates with Paperclip, loads all plugin tools via `GET /api/plugins/tools`
2. Exposes them as MCP tools (sanitizing `gearloose.email:email_search` → `gearloose_email_email_search`)
3. When Claude calls a tool: proxies to `POST /api/plugins/tools/execute`

### Wiring to agents

Run `scripts/wire-mcp-to-paperclip.sh` on the NUC (needs `PC_PASSWORD` env var):

```bash
PC_PASSWORD=<pw> bash wire-mcp-to-paperclip.sh
```

This:
1. Ensures proxy is in `/paperclip/mcp-proxy/` (persists in Docker volume)
2. Writes `/paperclip/mcp-proxy-config.json` with MCP server config
3. Patches CFO agent via `PATCH /api/agents/:id` to add `extraArgs: ["--settings", "/paperclip/mcp-proxy-config.json"]`

The `--settings` flag is Claude CLI's way to load additional MCP servers at invocation time.
The config file lives in the Docker volume so it survives container restarts.

### Key API facts for MCP wiring

```
# Update agent adapter config (merge patch):
PATCH /api/agents/:id
Body: { "adapterConfig": { "extraArgs": ["--settings", "/paperclip/mcp-proxy-config.json"] } }

# extraArgs must be a JSON array (not a space-separated string)
# asStringArray() in adapter-utils only accepts real arrays

# Claude CLI settings flag:
--settings <path>   # loads additional settings (mcpServers, etc.) from JSON file
```

## Plugin Library (as of 2026-04-20) — 10 plugins, 95 tools

All built, TypeScript-clean, manifest+worker parity verified by `scripts/validate-plugins.sh`.

| Plugin | Package | Tools | Auth pattern | Deploy status |
|--------|---------|-------|--------------|---------------|
| Dinero | `packages/plugin-dinero` | 10 | OAuth2 PKCE bearer (auto-refresh) | ✅ installed on NUC |
| Email | `packages/plugin-email` | 7 | IMAP/SMTP credentials | ✅ installed on NUC |
| Google Sheets | `packages/plugin-google-sheets` | 6 | Service account JWT (RS256) | 🔄 pending NUC deploy |
| e-conomic | `packages/plugin-economic` | 11 | Dual header (AppSecretToken + GrantToken) | 🔄 pending customer creds |
| HubSpot | `packages/plugin-hubspot` | 14 | Bearer token | 🔄 pending customer creds |
| Billy | `packages/plugin-billy` | 10 | X-Access-Token header | 🔄 pending customer creds |
| Zendesk | `packages/plugin-zendesk` | 10 | Basic auth (email:apikey) | 🔄 pending customer creds |
| Slack | `packages/plugin-slack` | 9 | xoxb-... bot token | 🔄 pending customer creds |
| Notion | `packages/plugin-notion` | 9 | Bearer (internal integration token) | 🔄 pending customer creds |
| Linear | `packages/plugin-linear` | 9 | Bearer (personal API key, GraphQL) | 🔄 pending customer creds |

**Key constraint:** All plugins use zero external npm deps — only Node builtins + `@paperclipai/plugin-sdk`.

## Provisioning Cheatsheet — One Command Per Plugin

All commands use `provision-plugin.sh` which:
1. Creates Paperclip secrets from the env vars you pass
2. Writes `customers/<slug>/plugin-<name>.json` with the resulting UUIDs
3. Deploys the plugin

Run from the repo root. `PC_PASSWORD` always required.

### Billy

```bash
PC_PASSWORD=<pw> \
ACCESSTOKENREF=<billy-api-token> \
  ./scripts/provision-plugin.sh <customer-slug> packages/plugin-billy
```

Get token: Billy → Indstillinger → API → Generate token.

### Dinero

```bash
PC_PASSWORD=<pw> \
DINEROCLIENTIDREF=<client-id> \
DINEROCLIENTSECRETREF=<client-secret> \
DINEROAPIKEYREF=<api-key> \
PLUGIN_CONFIG_dineroOrgId=<org-id> \
  ./scripts/provision-plugin.sh <customer-slug> packages/plugin-dinero
```

Get creds: Dinero → Indstillinger → API → Opret API-adgang. Org ID from the URL (numeric).

### e-conomic

```bash
PC_PASSWORD=<pw> \
APPSECRETTOKENREF=<app-secret-token> \
AGREEMENTGRANTTOKENREF=<agreement-grant-token> \
  ./scripts/provision-plugin.sh <customer-slug> packages/plugin-economic
```

App Secret Token: your developer token from apps.e-conomic.com (reused across customers).
Agreement Grant Token: customer generates from e-conomic → Indstillinger → API-adgang.

### Email (IMAP/SMTP)

```bash
PC_PASSWORD=<pw> \
EMAILPASSWORDREF=<email-password-or-app-password> \
PLUGIN_CONFIG_emailUser=agent@company.com \
PLUGIN_CONFIG_imapHost=imap.gmail.com \
PLUGIN_CONFIG_imapPort=993 \
PLUGIN_CONFIG_smtpHost=smtp.gmail.com \
PLUGIN_CONFIG_smtpPort=587 \
PLUGIN_CONFIG_displayName="Company AI Agent" \
  ./scripts/provision-plugin.sh <customer-slug> packages/plugin-email
```

For Gmail: use App Password (Google Account → Security → 2FA → App passwords).

### Google Sheets

```bash
PC_PASSWORD=<pw> \
SERVICEACCOUNTJSONREF='{"type":"service_account","project_id":"...","private_key":"..."}' \
  ./scripts/provision-plugin.sh <customer-slug> packages/plugin-google-sheets
```

Get JSON key: Google Cloud Console → IAM → Service Accounts → Keys → Add Key → JSON.
Share target spreadsheets with the service account email (Editor role).

### HubSpot

```bash
PC_PASSWORD=<pw> \
ACCESSTOKENREF=<hubspot-private-app-token> \
  ./scripts/provision-plugin.sh <customer-slug> packages/plugin-hubspot
```

Get token: HubSpot → Settings → Integrations → Private Apps → Create → copy Access Token.

### Linear

```bash
PC_PASSWORD=<pw> \
APIKEYREF=<linear-api-key> \
  ./scripts/provision-plugin.sh <customer-slug> packages/plugin-linear
```

Get key: Linear → Settings → API → Personal API keys → Create key.

### Notion

```bash
PC_PASSWORD=<pw> \
INTEGRATIONTOKENREF=<notion-integration-token> \
  ./scripts/provision-plugin.sh <customer-slug> packages/plugin-notion
```

Get token: notion.so → Settings → Connections → Develop or manage integrations → New internal integration → copy the token.
Share each Notion database/page with the integration (page menu → Connect to).

### Slack

```bash
PC_PASSWORD=<pw> \
BOTTOKENREF=<slack-bot-oauth-token> \
  ./scripts/provision-plugin.sh <customer-slug> packages/plugin-slack
```

Get token: api.slack.com/apps → Create App → OAuth & Permissions → Bot Token Scopes:
`channels:read channels:history chat:write files:write reactions:write search:read users:read`.
Install to workspace → copy Bot User OAuth Token (starts with xoxb-).

### Zendesk

```bash
PC_PASSWORD=<pw> \
APITOKENREF=<zendesk-api-token> \
PLUGIN_CONFIG_subdomain=<your-subdomain> \
PLUGIN_CONFIG_email=<admin-email> \
  ./scripts/provision-plugin.sh <customer-slug> packages/plugin-zendesk
```

Get token: Zendesk → Admin → Apps & Integrations → APIs → Zendesk API → Add API token.

### Google Sheets — Setup Notes

Uses Google service account JWT auth (no browser OAuth needed — ideal for headless agents).

**One-time setup per customer:**

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs → Enable **Google Sheets API**
2. IAM → Service Accounts → Create → download JSON key
3. Share the target spreadsheet with the service account email (Editor role)
4. In Paperclip: create a secret with the full JSON key content
5. Configure the plugin with the secret UUID

**Secret format:** Full JSON key file content from Google Cloud Console → Service Accounts → Keys → Add Key → JSON.

**Tools available:**
- `sheets_get_spreadsheet_info` — list sheet names and dimensions
- `sheets_read_range` — read values from A1 range (e.g. `Sheet1!A1:D10`)
- `sheets_write_range` — write values (overwrites)
- `sheets_append_rows` — append rows after last data row
- `sheets_clear_range` — delete values in a range

### e-conomic — Setup Notes

Auth uses two tokens: an **App Secret Token** (your developer credential, same for all customers) and an **Agreement Grant Token** (per-customer, from their e-conomic account).

**One-time setup per customer:**

1. Register as developer at apps.e-conomic.com → get your App Secret Token
2. Customer goes to e-conomic → Indstillinger → API-adgang → generate Agreement Grant Token
3. Store both as Paperclip secrets, update `deploy-config.json` with their UUIDs

**Tools available:**
- `economic_get_company_info` — verify connection, get account info
- `economic_list_invoices` — list booked/draft invoices with date filter
- `economic_get_invoice` — get single invoice by number
- `economic_list_customers` — list customers with name filter
- `economic_get_customer` — get single customer by number
- `economic_list_accounts` — full chart of accounts
- `economic_list_products` — list products/services

## Recurring Maintenance

### After a Paperclip container image rebuild (upgrade)

Run the one-command recovery script:

```bash
PC_PASSWORD=<pw> ./scripts/post-upgrade.sh <customer-slug>
```

This does the full sequence automatically:
1. Re-applies compiled JS patches (`patch-paperclip-container.sh`)
2. Restarts the container
3. Polls until Paperclip is healthy (up to 60s)
4. Redeploys all plugins that have a `customers/<slug>/plugin-*.json` config
5. Runs `smoke-test-plugins.sh` to verify tools are callable

If you only need to reapply the patches without a full redeploy:

```bash
./scripts/patch-paperclip-container.sh <customer-slug>
ssh <ssh-host> "DOCKER_HOST=unix:///var/run/docker.sock docker restart <container>"
```

### After NUC restart (not a container rebuild)

The container restarts automatically via Docker's restart policy. Patches survive a container restart (they're in the container filesystem). Only a *container image rebuild* (Paperclip upgrade) loses the patches.

MCP config at `/paperclip/mcp-proxy-config.json` persists (Docker volume) — no action needed.

### Secrets

Stored as Paperclip secrets, referenced by UUID in `customers/<slug>/plugin-*.json`. Never stored in `deploy-config.json`.

---

## Troubleshooting

### "Plugin status=error after install"

Plugin activated but worker crashed on startup. Check container logs:
```bash
ssh <ssh-host> "DOCKER_HOST=unix:///var/run/docker.sock docker logs paperclipai-docker-server-1 --tail 50 2>&1 | grep -i 'error\|plugin'"
```
Common causes:
- Missing npm dependency: run `npm install --ignore-scripts` inside the container plugin dir
- SDK symlink broken: re-run `ln -sfn /app/packages/plugins/sdk <plugin-path>/node_modules/@paperclipai/plugin-sdk`
- Secret UUID wrong: check `customers/<slug>/plugin-<name>.json` UUIDs match what's in Paperclip Settings

### "Tools visible on /api/plugins/tools but execute returns worker not running"

Container patches not applied. Run:
```bash
./scripts/patch-paperclip-container.sh <customer-slug>
ssh <ssh-host> "DOCKER_HOST=unix:///var/run/docker.sock docker restart paperclipai-docker-server-1"
PC_PASSWORD=<pw> ./scripts/deploy-for-customer.sh <customer-slug> packages/plugin-<name>
```

### "MCP proxy shows 0 tools"

Either the container patches aren't applied, or no plugins are installed. Check:
```bash
# From the NUC:
curl -s http://localhost:3100/api/plugins/tools -b /tmp/pc_deploy_cookies.txt | python3 -c "import sys,json; print(len(json.load(sys.stdin)), 'tools')"
```
Fix: apply patches → redeploy plugins → restart proxy (restart the Claude agent session).

### "smoke-test-plugins.sh: No plugins found or auth failed"

Either auth failed or PC_HOST isn't reachable. Test manually:
```bash
ssh <ssh-host> "curl -s http://localhost:3100/api/health"
```
If health check fails, Paperclip is down — check `docker logs`.

### "provision-plugin.sh: secret value for X not provided"

The env var wasn't exported before running the script. The env var name is the secretRef key UPPERCASED, e.g. `accessTokenRef` → `ACCESSTOKENREF=<value>`.

### "deploy-plugin.sh: Install failed (status=error)"

Check `lastError` field in the curl response. Common: manifest syntax error (apiVersion must be number, not string), missing `capabilities` array, bad `entrypoints.worker` path.

### "Container patches lost after upgrade"

After any `docker pull` + `docker compose up`, the compiled JS is replaced. Always run `post-upgrade.sh` immediately after a Paperclip upgrade:
```bash
PC_PASSWORD=<pw> ./scripts/post-upgrade.sh <customer-slug>
```
