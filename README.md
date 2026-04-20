# Paperclip SaaS — Gearloose Plugin Toolchain

This repo contains the custom plugin library and operator scripts for the Gearloose Paperclip SaaS offering.
One repo serves all customers — customer-specific config lives in `customers/<slug>/`.

## Operator runbook: onboarding a new customer

### Prerequisites

- A VPS running Ubuntu 22.04+ with your SSH public key installed
- A domain pointed at the VPS IP (DNS A record)
- This repo cloned locally

### Step 1 — Provision the VPS

Takes a blank Ubuntu/Debian VPS to a running Paperclip instance with HTTPS:

```bash
./scripts/setup-vps.sh <ssh-host> <domain> [anthropic-api-key]
# e.g.
./scripts/setup-vps.sh root@1.2.3.4 paperclip.acme-corp.com sk-ant-...
```

After it finishes:
1. Add an SSH alias to `~/.ssh/config` (e.g. `Host acme`)
2. Run the interactive onboard command it prints (creates the admin user)
3. Note the container name — almost always `paperclipai-docker-server-1`

### Step 2 — Onboard the customer

Interactive wizard: creates `customers/<slug>.env`, validates connectivity, optionally provisions plugins:

```bash
./scripts/onboard-customer.sh <customer-slug>
# e.g.
./scripts/onboard-customer.sh acme-corp
```

The wizard will ask for:
- SSH host alias (from `~/.ssh/config`)
- Paperclip admin email + password
- Company UUID (auto-detected if omitted)
- Which plugins to install and their API credentials

If you prefer to provision plugins separately (e.g. when gathering credentials takes time), answer `none` and use `provision-plugin.sh` later.

### Step 3 — Wire the MCP proxy (required for agent tool use)

Enables the Paperclip agent to call plugin tools during conversations:

```bash
PC_PASSWORD=<pw> ./scripts/wire-mcp-to-customer.sh <customer-slug>
```

This is idempotent — safe to re-run. The config persists in a Docker volume and survives container restarts.

### Step 4 — Provision plugins (if skipped in step 2)

First-time plugin provisioning (creates secrets + deploys):

```bash
# Pass secret values via env vars — see docs/plugin-credentials.md for exact var names
PC_PASSWORD=<pw> ACCESSTOKENREF=<token> \
  ./scripts/provision-plugin.sh <customer-slug> packages/plugin-billy
```

### Step 5 — Smoke test

Verify all installed plugins are healthy and tools execute:

```bash
./scripts/smoke-test-plugins.sh <customer-slug>
```

Exit 0 = all good. Exit 1 = check the output for which plugin/tool failed.

---

## Day-2 operations

### Quick status check

```bash
./scripts/status.sh <customer-slug>  # one customer
./scripts/status.sh                  # all customers
```

Shows: SSH reachable, container running, Paperclip health, installed plugins + statuses, agent MCP wiring, tool count. No plugin tool execution — safe to run any time.

### Add a plugin to an existing customer

Interactive wizard — same plugin menu as onboarding, but loads the existing customer config:

```bash
PC_PASSWORD=<pw> ./scripts/add-plugin.sh <customer-slug>
```

Shows already-provisioned plugins, lets you pick one or more to add, collects credentials interactively, and provisions them. The MCP proxy auto-refreshes tools on the next agent call — no restart needed.

### Redeploy a plugin after a code update

```bash
PC_PASSWORD=<pw> ./scripts/deploy-for-customer.sh <customer-slug> packages/plugin-<name>
```

### Full recovery after a Paperclip upgrade (container rebuild)

```bash
# 1. Re-apply JS patches + restart container + redeploy all plugins + smoke test
PC_PASSWORD=<pw> ./scripts/post-upgrade.sh <customer-slug>
```

The compiled JS patches (bug fix for tool registration) are lost on container rebuild — `post-upgrade.sh` handles all of it.

### Re-wire MCP proxy (manual)

`post-upgrade.sh` rewires automatically. If you need to re-wire standalone (e.g. after manually changing credentials):

```bash
PC_PASSWORD=<pw> ./scripts/wire-mcp-to-customer.sh <customer-slug>
```

---

## Repo structure

```
customers/
  <slug>.env          # Instance config (committed)
  <slug>.secrets      # PC_PASSWORD — gitignored
  <slug>/
    plugin-dinero.json  # Per-customer secret UUIDs + config overrides (committed)
    plugin-email.json
    ...

packages/
  # Accounting / Finance
  plugin-dinero/        # Dinero accounting (10 tools)
  plugin-billy/         # Billy accounting (10 tools)
  plugin-economic/      # e-conomic accounting (11 tools)
  plugin-fortnox/       # Fortnox accounting (10 tools)
  plugin-stripe/        # Stripe payments (10 tools)
  plugin-harvest/       # Harvest time tracking (10 tools)

  # CRM / Sales
  plugin-hubspot/       # HubSpot CRM (14 tools)
  plugin-pipedrive/     # Pipedrive CRM (11 tools)
  plugin-salesforce/    # Salesforce CRM (10 tools)
  plugin-zoho-crm/      # Zoho CRM (11 tools)

  # Email / Marketing
  plugin-email/         # IMAP/SMTP email (7 tools)
  plugin-brevo/         # Brevo email (10 tools)
  plugin-sendgrid/      # SendGrid email (10 tools)
  plugin-postmark/      # Postmark email (14 tools)
  plugin-mailgun/       # Mailgun email (11 tools)
  plugin-mailchimp/     # Mailchimp marketing (10 tools)
  plugin-klaviyo/       # Klaviyo marketing (10 tools)
  plugin-activecampaign/ # ActiveCampaign marketing (10 tools)

  # Communication / Collaboration
  plugin-slack/         # Slack messaging (9 tools)
  plugin-teams/         # Microsoft Teams (8 tools)
  plugin-twilio/        # Twilio SMS/voice (10 tools)

  # Project Management
  plugin-notion/        # Notion (9 tools)
  plugin-linear/        # Linear issues (9 tools)
  plugin-jira/          # Jira issues (10 tools)
  plugin-asana/         # Asana tasks (10 tools)
  plugin-monday/        # monday.com (10 tools)
  plugin-clickup/       # ClickUp (10 tools)
  plugin-todoist/       # Todoist tasks (10 tools)
  plugin-trello/        # Trello boards (10 tools)
  plugin-airtable/      # Airtable bases (10 tools)

  # Customer Support
  plugin-zendesk/       # Zendesk support (10 tools)
  plugin-freshdesk/     # Freshdesk support (10 tools)
  plugin-intercom/      # Intercom (10 tools)

  # Developer / Data
  plugin-github/        # GitHub (10 tools)
  plugin-google-sheets/ # Google Sheets (6 tools)
  plugin-typeform/      # Typeform forms (10 tools)
  plugin-calendly/      # Calendly scheduling (10 tools)

  # eCommerce
  plugin-shopify/       # Shopify (10 tools)
  plugin-woocommerce/   # WooCommerce (10 tools)

  mcp-plugin-proxy/     # MCP server that proxies plugin tools to Claude

scripts/
  setup-vps.sh              # Provision a fresh VPS
  onboard-customer.sh       # Interactive new-customer wizard
  add-plugin.sh             # Add a plugin to an already-onboarded customer
  status.sh                 # Quick health dashboard (no tool execution)
  provision-plugin.sh       # First-time plugin deploy (creates secrets)
  deploy-for-customer.sh    # Redeploy a plugin to a customer
  deploy-plugin.sh          # Low-level: build + copy + install one plugin
  wire-mcp-to-customer.sh   # Install MCP proxy + patch agent
  smoke-test-plugins.sh     # Health + tool execution check
  post-upgrade.sh           # Full recovery after Paperclip upgrade
  patch-paperclip-container.sh # Reapply compiled JS bug patches
  new-plugin.sh             # Scaffold a new plugin skeleton from CLI flags
  validate-plugins.sh       # Local structural validation before deploy
  run-tool.sh               # Execute a single plugin tool locally (no Paperclip instance needed)

docs/
  plugin-credentials.md   # What credentials each plugin needs and where to find them
  plugin-development.md   # How to build a new plugin from scratch
```

---

## Plugin library

**39 plugins / ~390 tools** — all validate clean with zero external npm dependencies.

### Accounting / Finance
| Plugin | Package | Tools | Auth |
|--------|---------|-------|------|
| Dinero | `plugin-dinero` | 10 | OAuth2 PKCE + refresh |
| Billy | `plugin-billy` | 10 | X-Access-Token |
| e-conomic | `plugin-economic` | 11 | Dual header (app + grant token) |
| Fortnox | `plugin-fortnox` | 10 | OAuth2 + refresh rotation |
| Stripe | `plugin-stripe` | 10 | Bearer token |
| Harvest | `plugin-harvest` | 10 | Bearer token |

### CRM / Sales
| Plugin | Package | Tools | Auth |
|--------|---------|-------|------|
| HubSpot | `plugin-hubspot` | 14 | Bearer token |
| Pipedrive | `plugin-pipedrive` | 11 | API token query param |
| Salesforce | `plugin-salesforce` | 10 | Bearer (OAuth2 access token) |
| Zoho CRM | `plugin-zoho-crm` | 11 | Zoho-oauthtoken + domain config |

### Email / Marketing
| Plugin | Package | Tools | Auth |
|--------|---------|-------|------|
| Email | `plugin-email` | 7 | IMAP/SMTP credentials |
| Brevo | `plugin-brevo` | 10 | api-key header |
| SendGrid | `plugin-sendgrid` | 10 | Bearer token |
| Postmark | `plugin-postmark` | 14 | X-Postmark-Server-Token |
| Mailgun | `plugin-mailgun` | 11 | Basic auth (api:key) + domain |
| Mailchimp | `plugin-mailchimp` | 10 | Bearer token |
| Klaviyo | `plugin-klaviyo` | 10 | Klaviyo-API-Key header |
| ActiveCampaign | `plugin-activecampaign` | 10 | Api-Token header + base URL |

### Communication / Collaboration
| Plugin | Package | Tools | Auth |
|--------|---------|-------|------|
| Slack | `plugin-slack` | 9 | Bot token |
| Microsoft Teams | `plugin-teams` | 8 | Azure AD client credentials |
| Twilio | `plugin-twilio` | 10 | Basic auth (accountSid:authToken) |

### Project Management
| Plugin | Package | Tools | Auth |
|--------|---------|-------|------|
| Notion | `plugin-notion` | 9 | Bearer (integration token) |
| Linear | `plugin-linear` | 9 | Bearer (personal API key) |
| Jira | `plugin-jira` | 10 | Basic auth (email + API token) |
| Asana | `plugin-asana` | 10 | Bearer token |
| monday.com | `plugin-monday` | 10 | Authorization: token (no Bearer) |
| ClickUp | `plugin-clickup` | 10 | Bearer token |
| Todoist | `plugin-todoist` | 10 | Bearer token |
| Trello | `plugin-trello` | 10 | API key + token query params |
| Airtable | `plugin-airtable` | 10 | Bearer token |

### Customer Support
| Plugin | Package | Tools | Auth |
|--------|---------|-------|------|
| Zendesk | `plugin-zendesk` | 10 | Basic auth (email/token:apikey) |
| Freshdesk | `plugin-freshdesk` | 10 | Basic auth (apiKey:X) + domain |
| Intercom | `plugin-intercom` | 10 | Bearer token |

### Developer / Data / Other
| Plugin | Package | Tools | Auth |
|--------|---------|-------|------|
| GitHub | `plugin-github` | 10 | Bearer token |
| Google Sheets | `plugin-google-sheets` | 6 | Service account JWT (RS256) |
| Typeform | `plugin-typeform` | 10 | Bearer token |
| Calendly | `plugin-calendly` | 10 | Bearer token |

### eCommerce
| Plugin | Package | Tools | Auth |
|--------|---------|-------|------|
| Shopify | `plugin-shopify` | 10 | X-Shopify-Access-Token + shop domain |
| WooCommerce | `plugin-woocommerce` | 10 | Basic auth (consumerKey:secret) + site URL |

All plugins: zero external npm dependencies (pure fetch + Node builtins + plugin-sdk).

---

## Building a new plugin

Scaffold a new plugin skeleton in one command:

```bash
./scripts/new-plugin.sh <name> \
  [--secret <secretRef>]... \
  [--config <key>=<description>]... \
  [--tool <tool_name>]...
```

Example — a Freshdesk support integration:

```bash
./scripts/new-plugin.sh freshdesk \
  --secret apiTokenRef \
  --config subdomain="Freshdesk subdomain" \
  --config email="Agent email address" \
  --tool list_tickets --tool get_ticket --tool create_ticket
```

This creates `packages/plugin-freshdesk/` with all required files pre-wired:
- `tsconfig.json`, `package.json`, `deploy-config.json`
- `src/manifest.ts` — manifest with tool declarations and config schema
- `src/worker.ts` — `definePlugin` + `ctx.tools.register` stubs per tool

Then build, validate, and provision:

```bash
cd packages/plugin-freshdesk && npm install && npm run build
cd ../..
./scripts/validate-plugins.sh packages/plugin-freshdesk
PC_PASSWORD=<pw> APITOKENREF=<token> \
  PLUGIN_CONFIG_subdomain=<subdomain> \
  PLUGIN_CONFIG_email=<email> \
  ./scripts/provision-plugin.sh <customer-slug> packages/plugin-freshdesk
```

See `docs/plugin-development.md` for the full plugin API reference.

---

## Validate before deploy

Run structural checks on all plugins (TypeScript, manifest, tool parity, no hardcoded secrets):

```bash
./scripts/validate-plugins.sh          # all plugins
./scripts/validate-plugins.sh packages/plugin-dinero  # one plugin
```

---

## Local tool execution (no Paperclip instance needed)

Test a plugin tool locally against the real external API using the SDK test harness.
No VPS or Paperclip container required — only the plugin's built `dist/` and real credentials.

```bash
# Pattern: set PLUGIN_CONFIG_<field>=<value> and PLUGIN_SECRET_<secretRefField>=<actual-secret>
# The secretRef field name in PLUGIN_CONFIG_* must match what the worker reads from config.

PLUGIN_CONFIG_dineroOrgId=123456 \
PLUGIN_CONFIG_dineroClientIdRef=dineroClientIdRef \
PLUGIN_CONFIG_dineroClientSecretRef=dineroClientSecretRef \
PLUGIN_CONFIG_dineroApiKeyRef=dineroApiKeyRef \
PLUGIN_SECRET_dineroClientIdRef=<your-dinero-client-id> \
PLUGIN_SECRET_dineroClientSecretRef=<your-dinero-client-secret> \
PLUGIN_SECRET_dineroApiKeyRef=<your-dinero-api-key> \
./scripts/run-tool.sh packages/plugin-dinero dinero_list_contacts '{}'

# HubSpot example (single bearer token):
PLUGIN_CONFIG_accessTokenRef=accessTokenRef \
PLUGIN_SECRET_accessTokenRef=pat-eu1-xxxx \
./scripts/run-tool.sh packages/plugin-hubspot hubspot_search_contacts '{"limit":3}'
```

The plugin must be built first: `cd packages/plugin-<name> && npm run build`

**How it works:** The SDK exports `createTestHarness` (`dist/testing.js`) which instantiates
an in-memory host that enforces declared capabilities. `PLUGIN_SECRET_<key>` values are
returned when the worker calls `ctx.secrets.resolve(config.<key>)`. Real HTTP calls are made
via `ctx.http.fetch` — so you see real API responses and errors.

---

## Customer secrets policy

- `customers/<slug>.secrets` is gitignored — never committed
- `deploy-config.json` in each plugin uses `REPLACE_WITH_*` placeholders for secret values
- Real secret UUIDs are stored in `customers/<slug>/plugin-<name>.json` (committed — UUIDs are not secrets)
- Actual credential values live only in Paperclip's secrets store (encrypted at rest)
