# Paperclip Plugin Development Guide

This is the living reference for building and deploying custom Paperclip plugins as part of the Gearloose SaaS offering. Everything here is battle-tested against a real self-hosted Paperclip instance.

## Quickstart — scaffold a new plugin

```bash
./scripts/new-plugin.sh <name> \
  [--secret <secretRef>]... \
  [--config <key>=<description>]... \
  [--tool <tool_name>]...
```

Example:

```bash
./scripts/new-plugin.sh freshdesk \
  --secret apiTokenRef \
  --config subdomain="Freshdesk subdomain" \
  --tool list_tickets --tool get_ticket --tool create_ticket
```

This generates `packages/plugin-freshdesk/` with all required files pre-wired. Then build and validate:

```bash
cd packages/plugin-freshdesk && npm install && npm run build && cd ../..
./scripts/validate-plugins.sh packages/plugin-freshdesk
```

The rest of this document explains the plugin system in detail — read it to understand what the scaffold generates and how to implement the tool handlers.

---

## Overview

Paperclip plugins are Node.js ESM workers that run inside the Paperclip container process. A plugin registers tools at startup; agents can then call those tools via the Paperclip MCP interface. This is the right primitive for giving Paperclip agents access to external services (Dinero, CRM, etc.) without touching Paperclip core.

---

## Plugin Structure

Every plugin is a flat directory with these four files:

```
plugin-dir/
  manifest.js       # Plugin metadata + config schema (ESM)
  worker.js         # Tool registration + business logic (ESM)
  dinero-client.js  # (optional) extracted API client
  package.json
```

**`package.json` must point to the flat root — not `dist/`:**
```json
{
  "name": "@yourorg/paperclip-plugin-foo",
  "version": "0.1.0",
  "type": "module",
  "paperclipPlugin": {
    "manifest": "./manifest.js",
    "worker": "./worker.js"
  }
}
```

**`manifest.js` entrypoint must also be flat:**
```js
entrypoints: { worker: "./worker.js" }  // NOT "./dist/worker.js"
```

> **Why flat?** Paperclip resolves `entrypoints.worker` relative to the installed plugin directory root. There is no build-step integration — you copy compiled output and fix the paths.

---

## Manifest Rules

```ts
const manifest: PaperclipPluginManifestV1 = {
  id: "yourorg.pluginname",       // reverse-domain, unique
  apiVersion: 1,                  // number, not string
  version: "0.1.0",
  displayName: "Human Name",
  description: "...",
  author: "Yourorg",
  categories: ["connector"],
  capabilities: [                 // non-empty array — all strings must be valid enum values
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "instance.settings.register",
  ],
  entrypoints: { worker: "./worker.js" },
  instanceConfigSchema: { ... },  // JSON Schema for per-instance config
};
```

**Key constraints:**
- `apiVersion` must be the number `1`, not the string `"1"`
- `capabilities` must be a non-empty array of strings from Paperclip's `PLUGIN_CAPABILITIES` enum
- **Tools MUST be declared in BOTH places** (discovered from manifest at activation + invoked from worker at runtime):
  1. In the manifest `tools[]` array (static declarations — host reads these at install time)
  2. In the worker via `ctx.tools.register()` (invocation handlers — called when a tool executes)

> **Critical:** If `tools[]` is omitted from the manifest, the host registers `0` tools at activation and agents cannot call any tools — even though the worker registers them. The manifest is the source of truth for tool *discovery*; the worker handles *invocation*.

---

## Secrets System

Paperclip has a first-class secrets store. Use it for all credentials — never put plaintext secrets in config.

**How it works:**
1. A secret is created in Paperclip and gets a UUID.
2. The plugin's `instanceConfigSchema` declares fields with `format: "secret-ref"`.
3. The admin sets the config with the secret UUIDs (not the values).
4. The worker calls `ctx.secrets.resolve(uuid)` → `Promise<string>` to get the actual value at runtime.

**Schema field for a secret ref:**
```ts
dineroClientIdRef: {
  type: "string",
  format: "secret-ref",           // required for Paperclip's scoping check
  title: "Dinero Client ID",
  description: "UUID of a Paperclip secret holding the Dinero OAuth2 client_id.",
  default: "",
},
```

**Worker resolving secrets:**
```ts
const [clientId, clientSecret, apiKey] = await Promise.all([
  ctx.secrets.resolve(dineroClientIdRef),
  ctx.secrets.resolve(dineroClientSecretRef),
  ctx.secrets.resolve(dineroApiKeyRef),
]);
```

> `ctx.secrets.resolve()` takes a UUID string and returns the secret value. It will throw if the UUID doesn't exist or is out of scope.

---

## Worker Pattern

```ts
import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as MyConfig;

    // 1. Validate config
    if (!config.mySecretRef) {
      ctx.logger.error("mySecretRef is required");
      return;  // returning early stops the worker cleanly
    }

    // 2. Resolve secrets
    const secretValue = await ctx.secrets.resolve(config.mySecretRef);

    // 3. Init API client
    const client = new MyApiClient({ token: secretValue });

    // 4. Register tools
    ctx.tools.register(
      "tool_name",
      {
        displayName: "Tool Name",
        description: "What this tool does.",
        parametersSchema: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "The record ID." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.getRecord(p.id as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      }
    );

    ctx.logger.info("Plugin ready — N tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "Plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
```

**`ToolResult` shape:** `{ content?: string, data?: unknown, error?: string }` — no `isError` field.

---

## Install Procedure (Self-Hosted NUC)

This is the proven procedure for deploying a plugin to a self-hosted Paperclip Docker instance.

### 1. Build TypeScript on your dev machine

```bash
cd packages/plugin-foo
npm run build   # runs tsc
```

`tsconfig.json` must include `"types": ["node"]` and `"rootDir": "./src"`.

### 2. Copy built files to NUC

```bash
scp dist/worker.js dist/manifest.js dist/my-client.js package.json nuc:~/paperclip-plugins-src/plugin-foo/
```

### 3. Fix paths on NUC (dist/ → flat)

```bash
ssh nuc "python3 -c \"
import json
with open('~/paperclip-plugins-src/plugin-foo/package.json') as f: p = json.load(f)
p['paperclipPlugin'] = {'manifest': './manifest.js', 'worker': './worker.js'}
with open('~/paperclip-plugins-src/plugin-foo/package.json', 'w') as f: json.dump(p, f, indent=2)
\""
ssh nuc "sed -i 's|./dist/worker.js|./worker.js|g' ~/paperclip-plugins-src/plugin-foo/manifest.js"
```

### 4. Copy into container and install dependencies

```bash
# Increment v3 → v4 etc. on each deploy — Node caches imports by path
ssh nuc "DOCKER_HOST=unix:///var/run/docker.sock docker cp ~/paperclip-plugins-src/plugin-foo/ paperclipai-docker-server-1:/paperclip-foo-v3"

# Install runtime dependencies INSIDE the container (not from Mac — CJS modules aren't portable)
ssh nuc "DOCKER_HOST=unix:///var/run/docker.sock docker exec paperclipai-docker-server-1 bash -c \
  'cd /paperclip-foo-v3 && npm install --ignore-scripts 2>&1 | tail -5'"

# Symlink the SDK AFTER npm install (npm install would overwrite it)
ssh nuc "DOCKER_HOST=unix:///var/run/docker.sock docker exec paperclipai-docker-server-1 bash -c \
  'rm -rf /paperclip-foo-v3/node_modules/@paperclipai && \
   mkdir -p /paperclip-foo-v3/node_modules/@paperclipai && \
   ln -sfn /app/packages/plugins/sdk /paperclip-foo-v3/node_modules/@paperclipai/plugin-sdk && \
   echo SDK symlinked'"
```

> **Why npm install inside the container?** Transitive CJS dependencies (e.g. imapflow → pino → quick-format-unescaped) are deeply nested and not portable from Mac to Linux. `npm` is available in the container and resolves all transitive deps cleanly. Always symlink the SDK AFTER running npm install, since npm will clear the `@paperclipai` dir.

> **Why increment the path?** Node's dynamic `import()` caches by resolved file path. Redeploying to `/paperclip-foo-v2` after a code change will serve the old cached module. A new path (`v3`, `v4`, ...) forces a fresh import.

### 5. Create secrets in Paperclip

```bash
# Auth first
curl -s -X POST http://HOST:3100/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -c /tmp/paperclip-cookies.txt \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}'

# Create a secret — note the returned UUID
curl -s -X POST "http://HOST:3100/api/companies/COMPANY_ID/secrets" \
  -b /tmp/paperclip-cookies.txt \
  -H "Content-Type: application/json" \
  -H "Origin: http://HOST:3100" \
  -d '{"name":"My Secret Name","value":"the-actual-secret-value"}'
# → {"id":"<uuid>", ...}
```

### 6. Install the plugin

```bash
curl -s -X POST http://HOST:3100/api/plugins/install \
  -b /tmp/paperclip-cookies.txt \
  -H "Content-Type: application/json" \
  -H "Origin: http://HOST:3100" \
  -d '{"packageName":"/paperclip-foo-v3","isLocalPath":true}'
# → {"id":"<plugin-id>", "status":"ready", ...}
```

### 7. Set config (with secret UUIDs, not values)

```bash
curl -s -X POST "http://HOST:3100/api/plugins/PLUGIN_ID/config" \
  -b /tmp/paperclip-cookies.txt \
  -H "Content-Type: application/json" \
  -H "Origin: http://HOST:3100" \
  -d '{
    "configJson": {
      "myOrgId": "12345",
      "mySecretRef": "<uuid-from-step-5>"
    }
  }'
```

### 8. Restart worker (uninstall → reinstall so worker starts with config)

```bash
# purge=false keeps the config
curl -s -X DELETE "http://HOST:3100/api/plugins/PLUGIN_ID?purge=false" \
  -b /tmp/paperclip-cookies.txt -H "Origin: http://HOST:3100"

curl -s -X POST http://HOST:3100/api/plugins/install \
  -b /tmp/paperclip-cookies.txt \
  -H "Content-Type: application/json" \
  -H "Origin: http://HOST:3100" \
  -d '{"packageName":"/paperclip-foo-v3","isLocalPath":true}'
```

### 9. Verify

```bash
curl -s "http://HOST:3100/api/plugins/PLUGIN_ID/health" \
  -b /tmp/paperclip-cookies.txt -H "Origin: http://HOST:3100"
# → {"status":"ready","healthy":true,...}

# Check container logs for tool registration confirmation
ssh nuc "DOCKER_HOST=unix:///var/run/docker.sock docker logs paperclipai-docker-server-1 --tail=20" | grep -i "plugin"
```

---

## API Reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/auth/sign-in/email` | POST | Get session cookie |
| `/api/plugins/install` | POST | Install plugin |
| `/api/plugins` | GET | List installed plugins |
| `/api/plugins/:id` | GET | Get plugin details + lastError |
| `/api/plugins/:id/config` | POST | Set instance config |
| `/api/plugins/:id/health` | GET | Health check |
| `/api/plugins/:id` | DELETE | Uninstall (`?purge=false` keeps config) |
| `/api/companies/:id/secrets` | POST | Create a secret |

**Required headers on all API calls:**
- `Origin: http://HOST:3100` — CSRF protection, must match the instance URL
- Cookie from auth step

---

## Dinero Plugin — Auth Notes

Dinero uses OAuth2 password grant with Basic auth. The correct endpoint is:

```
POST https://authz.dinero.dk/dineroapi/oauth/token
Authorization: Basic base64(clientId:clientSecret)
Content-Type: application/x-www-form-urlencoded

grant_type=password&scope=read+write&username=API_KEY&password=API_KEY
```

The API key is used as both `username` and `password`. The response contains `access_token` which is used as a Bearer token for all `https://api.dinero.dk/v1/{orgId}/...` requests.

**Common mistakes:**
- `authorizationserver.dinero.dk` — **does not resolve** (DNS dead end)
- Passing `client_id`/`client_secret` in the POST body instead of Basic auth header — returns 400
- Wrong scope: `openid email` doesn't work; use `read write`

Credentials come from: email Dinero support for `clientId`/`clientSecret`; create API key in Dinero → Indstillinger → Integrationer → API nøgler.

---

## Scripted Deployment (SaaS workflow)

The manual steps above are fully automated. Use these scripts from the repo root:

### First-time plugin deployment (creates secrets inline)

```bash
# Billy (one secret: Billy API access token)
PC_PASSWORD=<pw> ACCESSTOKENREF=<billy-api-token> \
  ./scripts/provision-plugin.sh gearloose packages/plugin-billy

# Zendesk (one secret + configJson fields)
PC_PASSWORD=<pw> APITOKENREF=<zendesk-api-token> \
PLUGIN_CONFIG_subdomain=mycompany PLUGIN_CONFIG_email=agent@mycompany.com \
  ./scripts/provision-plugin.sh gearloose packages/plugin-zendesk

# e-conomic (two secrets)
PC_PASSWORD=<pw> APPSECRETTOKENREF=<app-secret> AGREEMENTGRANTTOKENREF=<grant-token> \
  ./scripts/provision-plugin.sh gearloose packages/plugin-economic
```

`provision-plugin.sh` will:
1. Authenticate with Paperclip
2. Create each secret via the secrets API (skipping any already recorded in `customers/<slug>/<plugin>.json`)
3. Write `customers/<slug>/<plugin-slug>.json` with the resolved secret UUIDs
4. Run `deploy-plugin.sh` to build, copy, and install the plugin

### Subsequent deploys (secrets already created)

```bash
PC_PASSWORD=<pw> ./scripts/deploy-for-customer.sh gearloose packages/plugin-billy
```

This reads `customers/gearloose/plugin-billy.json` for secret UUIDs — no secrets are created.

### Wire MCP proxy (one-time per instance — gives agents access to plugin tools)

```bash
PC_PASSWORD=<pw> ./scripts/wire-mcp-to-customer.sh gearloose [agent-id]
```

This builds the proxy locally, copies it into the container, writes the MCP config, and patches the CFO agent's `adapterConfig.extraArgs` to load it. If `agent-id` is omitted, it auto-selects the agent named "cfo" or "assistant".

### Customer config files

- `customers/<slug>.env` — non-secret instance config (PC_HOST, PC_EMAIL, PC_COMPANY_ID, SSH_HOST)
- `customers/<slug>.secrets` — PC_PASSWORD (not committed)
- `customers/<slug>/<plugin-slug>.json` — per-customer deploy config with resolved secret UUIDs (safe to commit since UUIDs ≠ secret values)

### Env var naming convention for provision-plugin.sh

| secretRef key in deploy-config.json | Env var to pass |
|---|---|
| `accessTokenRef` | `ACCESSTOKENREF=<value>` |
| `apiTokenRef` | `APITOKENREF=<value>` |
| `appSecretTokenRef` | `APPSECRETTOKENREF=<value>` |
| `agreementGrantTokenRef` | `AGREEMENTGRANTTOKENREF=<value>` |
| `serviceAccountJsonRef` | `SERVICEACCOUNTJSONREF=<value>` |

configJson field overrides: `PLUGIN_CONFIG_<fieldname>=<value>` (e.g. `PLUGIN_CONFIG_subdomain=myco`)

---

## SaaS Notes

- **Path versioning**: `deploy-plugin.sh` auto-increments container path (`/paperclip-email-v1`, `-v2`, ...) on each deploy. Node's module cache is keyed by path, so this forces fresh imports.
- **Secret UUIDs ≠ secret values**: Safe to commit `customers/<slug>/<plugin>.json` — the UUIDs are opaque references, not the actual credentials.
- **SDK symlink**: `deploy-plugin.sh` always symlinks `@paperclipai/plugin-sdk` from the container's `/app/packages/plugins/sdk` after `npm install`. This ensures the plugin uses the same SDK version as Paperclip core.

---

## Customer Onboarding Runbook

Complete procedure for onboarding a new customer to a managed Paperclip SaaS instance.

### Prerequisites

- SSH access to the customer's NUC/VPS (add alias to `~/.ssh/config` as `<slug>`)
- Paperclip instance running on the server with Docker
- Docker container name: `paperclipai-docker-server-1` (standard name from MadeByAdem/paperclipai-docker repo)

### Step 1: Create customer config files

```bash
# Non-secret config (commit this)
cat > customers/<slug>.env <<'EOF'
PC_HOST=http://localhost:3100
PC_EMAIL=<admin-email>
PC_COMPANY_ID=<company-uuid>
SSH_HOST=<slug>
EOF

# Secret file (NEVER commit — add to .gitignore)
echo 'PC_PASSWORD=<their-paperclip-admin-password>' > customers/<slug>.secrets
chmod 600 customers/<slug>.secrets
```

### Step 2: Wire MCP proxy (one-time per instance)

This gives agents access to all installed plugin tools via the Paperclip MCP interface.

```bash
PC_PASSWORD=<pw> ./scripts/wire-mcp-to-customer.sh <slug>
```

On success you'll see `MCP proxy wired` and an agent ID. If the agent is not named "cfo" or "assistant", pass its ID explicitly:

```bash
PC_PASSWORD=<pw> ./scripts/wire-mcp-to-customer.sh <slug> <agent-uuid>
```

### Step 3: Provision plugins (first-time — creates secrets)

Run `provision-plugin.sh` for each plugin you want to install. The env vars carry the actual credential values; the script creates Paperclip secrets from them and writes UUIDs to `customers/<slug>/<plugin>.json`.

The env var name is the secretRef key uppercased. See the table at the end of this section.

```bash
# Dinero (3 secrets + dineroOrgId in configJson)
PC_PASSWORD=<pw> \
  DINEROCLIENTIDREF=<dinero-client-id> \
  DINEROCLIENTSECRETREF=<dinero-client-secret> \
  DINEROAPIKEYREF=<dinero-api-key> \
  PLUGIN_CONFIG_dineroOrgId=<org-id> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-dinero

# Billy (1 secret)
PC_PASSWORD=<pw> ACCESSTOKENREF=<billy-access-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-billy

# e-conomic (2 secrets)
PC_PASSWORD=<pw> \
  APPSECRETTOKENREF=<economic-app-secret-token> \
  AGREEMENTGRANTTOKENREF=<economic-agreement-grant-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-economic

# Zendesk (1 secret + 2 configJson fields)
PC_PASSWORD=<pw> \
  APITOKENREF=<zendesk-api-token> \
  PLUGIN_CONFIG_subdomain=<zendesk-subdomain> \
  PLUGIN_CONFIG_email=<zendesk-agent-email> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-zendesk

# HubSpot (1 secret)
PC_PASSWORD=<pw> ACCESSTOKENREF=<hubspot-private-app-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-hubspot

# Slack (1 secret — bot token starting with xoxb-)
PC_PASSWORD=<pw> BOTTOKENREF=<slack-bot-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-slack

# Google Sheets (1 secret — full service account JSON key)
PC_PASSWORD=<pw> SERVICEACCOUNTJSONREF=<service-account-json-string> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-google-sheets

# Notion (1 secret — internal integration token)
PC_PASSWORD=<pw> INTEGRATIONTOKENREF=<notion-integration-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-notion

# Linear (1 secret — personal API key)
PC_PASSWORD=<pw> APIKEYREF=<linear-personal-api-key> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-linear

# Email (1 secret + configJson fields)
PC_PASSWORD=<pw> \
  EMAILPASSWORDREF=<imap-smtp-password> \
  PLUGIN_CONFIG_emailUser=<email-address> \
  PLUGIN_CONFIG_imapHost=mail.your-server.de \
  PLUGIN_CONFIG_imapPort=993 \
  PLUGIN_CONFIG_smtpHost=mail.your-server.de \
  PLUGIN_CONFIG_smtpPort=465 \
  PLUGIN_CONFIG_displayName=<sender-display-name> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-email

# Microsoft Teams (3 secrets — Azure AD client credentials)
PC_PASSWORD=<pw> \
  TENANTIDREF=<azure-tenant-id> \
  CLIENTIDREF=<azure-client-id> \
  CLIENTSECRETREF=<azure-client-secret> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-teams

# Fortnox (2 secrets — access + refresh token)
PC_PASSWORD=<pw> \
  ACCESSTOKENREF=<fortnox-access-token> \
  REFRESHTOKENREF=<fortnox-refresh-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-fortnox

# Pipedrive (1 secret)
PC_PASSWORD=<pw> APITOKENREF=<pipedrive-api-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-pipedrive

# Intercom (1 secret)
PC_PASSWORD=<pw> ACCESSTOKENREF=<intercom-access-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-intercom

# Jira (1 secret + 2 configJson fields)
PC_PASSWORD=<pw> \
  APITOKENREF=<jira-api-token> \
  PLUGIN_CONFIG_domain=<your-company>.atlassian.net \
  PLUGIN_CONFIG_email=<atlassian-email> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-jira

# GitHub (1 secret + optional owner config)
PC_PASSWORD=<pw> \
  ACCESSTOKENREF=<github-personal-access-token> \
  PLUGIN_CONFIG_defaultOwner=<github-org-or-user> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-github

# Freshdesk (1 secret + 1 configJson field)
PC_PASSWORD=<pw> \
  APIKEYREF=<freshdesk-api-key> \
  PLUGIN_CONFIG_domain=<your-company>.freshdesk.com \
  ./scripts/provision-plugin.sh <slug> packages/plugin-freshdesk

# Stripe (1 secret)
PC_PASSWORD=<pw> APIKEYREF=<stripe-secret-key> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-stripe

# WooCommerce (2 secrets + 1 configJson field)
PC_PASSWORD=<pw> \
  CONSUMERKEYREF=<woocommerce-consumer-key> \
  CONSUMERSECRETREF=<woocommerce-consumer-secret> \
  PLUGIN_CONFIG_siteUrl=https://your-store.com \
  ./scripts/provision-plugin.sh <slug> packages/plugin-woocommerce

# Shopify (1 secret + 1 configJson field)
PC_PASSWORD=<pw> \
  ACCESSTOKENREF=<shopify-admin-api-access-token> \
  PLUGIN_CONFIG_shopDomain=your-store.myshopify.com \
  ./scripts/provision-plugin.sh <slug> packages/plugin-shopify

# monday.com (1 secret)
PC_PASSWORD=<pw> APITOKENREF=<monday-api-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-monday

# Asana (1 secret)
PC_PASSWORD=<pw> ACCESSTOKENREF=<asana-personal-access-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-asana

# Salesforce (4 secrets + 1 configJson field)
# Obtain via Salesforce Connected App OAuth2 flow
PC_PASSWORD=<pw> \
  ACCESSTOKENREF=<salesforce-oauth-access-token> \
  REFRESHTOKENREF=<salesforce-oauth-refresh-token> \
  CLIENTIDREF=<salesforce-connected-app-client-id> \
  CLIENTSECRETREF=<salesforce-connected-app-client-secret> \
  PLUGIN_CONFIG_instanceUrl=https://your-org.my.salesforce.com \
  ./scripts/provision-plugin.sh <slug> packages/plugin-salesforce

# Trello (2 secrets)
PC_PASSWORD=<pw> \
  APIKEYREF=<trello-api-key> \
  APITOKENREF=<trello-api-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-trello

# ClickUp (1 secret)
PC_PASSWORD=<pw> APITOKENREF=<clickup-personal-api-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-clickup

# Todoist (1 secret)
PC_PASSWORD=<pw> APITOKENREF=<todoist-api-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-todoist

# Airtable (1 secret)
PC_PASSWORD=<pw> ACCESSTOKENREF=<airtable-personal-access-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-airtable

# Harvest (1 secret + 1 configJson field)
PC_PASSWORD=<pw> \
  ACCESSTOKENREF=<harvest-access-token> \
  PLUGIN_CONFIG_accountId=<harvest-account-id> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-harvest

# Typeform (1 secret)
PC_PASSWORD=<pw> ACCESSTOKENREF=<typeform-personal-access-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-typeform

# Calendly (1 secret)
PC_PASSWORD=<pw> ACCESSTOKENREF=<calendly-personal-access-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-calendly

# Mailchimp (1 secret + 1 configJson field)
PC_PASSWORD=<pw> \
  APIKEYREF=<mailchimp-api-key> \
  PLUGIN_CONFIG_serverPrefix=us1 \
  ./scripts/provision-plugin.sh <slug> packages/plugin-mailchimp

# ActiveCampaign (1 secret + 1 configJson field)
PC_PASSWORD=<pw> \
  APIKEYREF=<activecampaign-api-key> \
  PLUGIN_CONFIG_baseUrl=https://your-account.api-us1.com \
  ./scripts/provision-plugin.sh <slug> packages/plugin-activecampaign

# Twilio (2 secrets)
PC_PASSWORD=<pw> \
  ACCOUNTSIDREF=<twilio-account-sid> \
  AUTHTOKENREF=<twilio-auth-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-twilio

# Brevo (1 secret)
PC_PASSWORD=<pw> APIKEYREF=<brevo-api-key> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-brevo

# SendGrid (1 secret)
PC_PASSWORD=<pw> APIKEYREF=<sendgrid-api-key> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-sendgrid

# Klaviyo (1 secret)
PC_PASSWORD=<pw> APIKEYREF=<klaviyo-private-api-key> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-klaviyo

# Zoho CRM (1 secret + 1 configJson field)
PC_PASSWORD=<pw> \
  ACCESSTOKENREF=<zoho-oauth-access-token> \
  PLUGIN_CONFIG_domain=zohoapis.com \
  ./scripts/provision-plugin.sh <slug> packages/plugin-zoho-crm

# Mailgun (1 secret + 2 configJson fields)
PC_PASSWORD=<pw> \
  APIKEYREF=<mailgun-private-api-key> \
  PLUGIN_CONFIG_domain=mg.example.com \
  PLUGIN_CONFIG_region=us \
  ./scripts/provision-plugin.sh <slug> packages/plugin-mailgun

# Postmark (1 secret)
PC_PASSWORD=<pw> SERVERTOKENREF=<postmark-server-api-token> \
  ./scripts/provision-plugin.sh <slug> packages/plugin-postmark
```

**Env var → secretRef key mapping** (rule: uppercase the camelCase key):

| Plugin | secretRef key | Env var |
|---|---|---|
| Dinero | `dineroClientIdRef` | `DINEROCLIENTIDREF` |
| Dinero | `dineroClientSecretRef` | `DINEROCLIENTSECRETREF` |
| Dinero | `dineroApiKeyRef` | `DINEROAPIKEYREF` |
| Billy, Fortnox, HubSpot, Intercom, Shopify, Asana, Airtable, Typeform, Calendly | `accessTokenRef` | `ACCESSTOKENREF` |
| e-conomic | `appSecretTokenRef` | `APPSECRETTOKENREF` |
| e-conomic | `agreementGrantTokenRef` | `AGREEMENTGRANTTOKENREF` |
| Zendesk, Pipedrive, Jira, ClickUp, Todoist, monday.com, Trello | `apiTokenRef` | `APITOKENREF` |
| Slack | `botTokenRef` | `BOTTOKENREF` |
| Google Sheets | `serviceAccountJsonRef` | `SERVICEACCOUNTJSONREF` |
| Notion | `integrationTokenRef` | `INTEGRATIONTOKENREF` |
| Linear, Freshdesk, Stripe, Mailchimp, ActiveCampaign, Brevo, SendGrid, Klaviyo, Zoho CRM, Mailgun | `apiKeyRef` | `APIKEYREF` |
| Email | `emailPasswordRef` | `EMAILPASSWORDREF` |
| Teams | `tenantIdRef` | `TENANTIDREF` |
| Teams | `clientIdRef` | `CLIENTIDREF` |
| Teams | `clientSecretRef` | `CLIENTSECRETREF` |
| Fortnox | `refreshTokenRef` | `REFRESHTOKENREF` |
| WooCommerce | `consumerKeyRef` | `CONSUMERKEYREF` |
| WooCommerce | `consumerSecretRef` | `CONSUMERSECRETREF` |
| Twilio | `accountSidRef` | `ACCOUNTSIDREF` |
| Twilio | `authTokenRef` | `AUTHTOKENREF` |
| Trello | `apiKeyRef` | `APIKEYREF` |
| Salesforce | `accessTokenRef` | `ACCESSTOKENREF` |
| Salesforce | `refreshTokenRef` | `REFRESHTOKENREF` |
| Salesforce | `clientIdRef` | `CLIENTIDREF` |
| Salesforce | `clientSecretRef` | `CLIENTSECRETREF` |
| Harvest | `accessTokenRef` | `ACCESSTOKENREF` |
| Mailchimp | `apiKeyRef` | `APIKEYREF` |
| Klaviyo | `apiKeyRef` | `APIKEYREF` |
| Zoho CRM | `accessTokenRef` | `ACCESSTOKENREF` |
| Postmark | `serverTokenRef` | `SERVERTOKENREF` |

After this step, `customers/<slug>/plugin-*.json` files exist with resolved secret UUIDs. Commit them.

### Step 4: Verify all plugins are healthy

```bash
# SSH to server and check all plugin health
ssh <slug> "curl -s -b /tmp/pc_deploy_cookies.txt \
  http://localhost:3100/api/plugins \
  -H 'Origin: http://localhost:3100'" | python3 -m json.tool | grep -E '"id"|"status"'
```

All plugins should show `"status": "ready"`.

### Step 5: Verify agent can see tools

After MCP wiring, open Paperclip in browser and start a conversation with the agent. Ask it to list its available tools or call a simple tool like `linear_list_teams`. Watch server logs:

```bash
ssh <slug> "DOCKER_HOST=unix:///var/run/docker.sock docker logs paperclipai-docker-server-1 --tail=50 2>&1" | grep -i "mcp\|tool\|plugin"
```

### Subsequent deploys

When you update a plugin (bug fix, new tool), no secrets are recreated:

```bash
PC_PASSWORD=<pw> ./scripts/deploy-for-customer.sh <slug> packages/plugin-billy
```

This reads `customers/<slug>/plugin-billy.json` for the existing secret UUIDs.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Plugin installs but `registered.tools = 0` | `tools[]` array missing from manifest | Add tool declarations to manifest `tools[]` (both manifest + worker required) |
| Worker crashes with "secret not found" | Config set but worker started before config was applied | Uninstall with `purge=false`, reinstall — worker reads config on startup |
| `ctx.tools.register()` never fires | Worker returned early due to missing config / secret error | Check container logs for error message before the `ready` log |
| `isRunning` returns false at tool execute | Paperclip server bug (pluginDbId missing) | Reapply patch to `plugin-tool-dispatcher.js` and `plugin-loader.js` (see Bug Patches section) |
| MCP tool names don't appear in agent | MCP proxy not wired or agent `extraArgs` missing `--settings` flag | Re-run `wire-mcp-to-customer.sh` |
| Tool execute returns 401/403 | Session cookie expired | Re-auth: `curl -X POST .../api/auth/sign-in/email` |
| `npm install` fails inside container | Package requires native build tools | Use `--ignore-scripts` flag; most plugins need zero native deps |

---

## Bug Patches (Paperclip Server)

**⚠️ These patches are applied to compiled JS in the container — they will be lost on container image rebuild.**

### pluginDbId missing in tool dispatcher

Root cause: `plugin-loader.js` called `toolDispatcher.registerPluginTools(pluginKey, manifest)` without passing the DB UUID. Workers are keyed by DB UUID in the workers Map, so `workerManager.isRunning(pluginKey)` returned false even for healthy workers — tool execution always failed.

**File:** `/app/server/dist/services/plugin-tool-dispatcher.js` (~line 210)
```js
// Change:
registerPluginTools(pluginId, manifest)
// To:
registerPluginTools(pluginId, manifest, pluginDbId)
// And pass pluginDbId through to registry.registerPlugin(...)
```

**File:** `/app/server/dist/services/plugin-loader.js` (~line 1085)
```js
// Change:
toolDispatcher.registerPluginTools(pluginKey, manifest)
// To:
toolDispatcher.registerPluginTools(pluginKey, manifest, pluginId)
```

Apply with `docker exec paperclipai-docker-server-1 bash -c "..."` or `docker cp` a patched file.
