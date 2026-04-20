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

### Re-wire MCP proxy after upgrade

`wire-mcp-to-customer.sh` re-copies the proxy and re-npm-installs inside the container. Re-run it after any upgrade:

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
  plugin-dinero/      # Dinero accounting plugin (10 tools)
  plugin-billy/       # Billy accounting plugin (10 tools)
  plugin-economic/    # e-conomic accounting plugin (11 tools)
  plugin-email/       # IMAP/SMTP email plugin (7 tools)
  plugin-google-sheets/ # Google Sheets plugin (6 tools)
  plugin-hubspot/     # HubSpot CRM plugin (14 tools)
  plugin-linear/      # Linear issue tracking plugin (9 tools)
  plugin-notion/      # Notion plugin (9 tools)
  plugin-slack/       # Slack messaging plugin (9 tools)
  plugin-zendesk/     # Zendesk support plugin (10 tools)
  mcp-plugin-proxy/   # MCP server that proxies plugin tools to Claude

scripts/
  setup-vps.sh              # Provision a fresh VPS
  onboard-customer.sh       # Interactive new-customer wizard
  provision-plugin.sh       # First-time plugin deploy (creates secrets)
  deploy-for-customer.sh    # Redeploy a plugin to a customer
  deploy-plugin.sh          # Low-level: build + copy + install one plugin
  wire-mcp-to-customer.sh   # Install MCP proxy + patch agent
  smoke-test-plugins.sh     # Health + tool execution check
  post-upgrade.sh           # Full recovery after Paperclip upgrade
  patch-paperclip-container.sh # Reapply compiled JS bug patches
  validate-plugins.sh       # Local structural validation before deploy

docs/
  plugin-credentials.md   # What credentials each plugin needs and where to find them
  plugin-development.md   # How to build a new plugin from scratch
```

---

## Plugin library

| Plugin | Package | Tools | Auth |
|--------|---------|-------|------|
| Dinero | `plugin-dinero` | 10 | OAuth2 + API key |
| Billy | `plugin-billy` | 10 | API token |
| e-conomic | `plugin-economic` | 11 | App + grant tokens |
| Email | `plugin-email` | 7 | IMAP/SMTP credentials |
| Google Sheets | `plugin-google-sheets` | 6 | Service account JSON |
| HubSpot | `plugin-hubspot` | 14 | Bearer token |
| Linear | `plugin-linear` | 9 | Personal API key |
| Notion | `plugin-notion` | 9 | Integration token |
| Slack | `plugin-slack` | 9 | Bot token |
| Zendesk | `plugin-zendesk` | 10 | Email + API token |

All plugins: zero external npm dependencies (pure fetch + Node builtins + plugin-sdk).

---

## Validate before deploy

Run structural checks on all plugins (TypeScript, manifest, tool parity, no hardcoded secrets):

```bash
./scripts/validate-plugins.sh          # all plugins
./scripts/validate-plugins.sh packages/plugin-dinero  # one plugin
```

---

## Customer secrets policy

- `customers/<slug>.secrets` is gitignored — never committed
- `deploy-config.json` in each plugin uses `REPLACE_WITH_*` placeholders for secret values
- Real secret UUIDs are stored in `customers/<slug>/plugin-<name>.json` (committed — UUIDs are not secrets)
- Actual credential values live only in Paperclip's secrets store (encrypted at rest)
