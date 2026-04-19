#!/usr/bin/env bash
# provision-plugin.sh — first-time deploy of a plugin with inline secret creation
#
# Unlike deploy-for-customer.sh (which expects secrets already exist via UUIDs),
# this script accepts secret values via env vars, creates them on the Paperclip
# instance, writes a per-customer config with the resulting UUIDs, then deploys.
#
# Usage:
#   ./scripts/provision-plugin.sh <customer-slug> <plugin-package-dir>
#
# Secret values are passed as env vars named after the secretRef key (uppercased):
#   accessTokenRef  → ACCESSTOKENREF=<value>
#   apiTokenRef     → APITOKENREF=<value>
#   appSecretToken  → APPSECRETTOKEN=<value>
#
# Additional configJson overrides:
#   PLUGIN_CONFIG_subdomain=mycompany  → sets configJson.subdomain
#   PLUGIN_CONFIG_email=agent@co.com   → sets configJson.email
#
# Examples:
#   # Billy (one secret):
#   PC_PASSWORD=pw ACCESSTOKENREF=my-billy-token \
#     ./scripts/provision-plugin.sh gearloose packages/plugin-billy
#
#   # Zendesk (one secret + configJson fields):
#   PC_PASSWORD=pw APITOKENREF=my-zendesk-key \
#   PLUGIN_CONFIG_subdomain=mycompany PLUGIN_CONFIG_email=agent@co.com \
#     ./scripts/provision-plugin.sh gearloose packages/plugin-zendesk
#
# Idempotent: if customers/<slug>/<plugin>.json already has a UUID for a ref key,
# that secret is reused and no new secret is created.

set -euo pipefail

CUSTOMER="${1:?Usage: $0 <customer-slug> <plugin-package-dir>}"
PLUGIN_DIR="${2:?Usage: $0 <customer-slug> <plugin-package-dir>}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGIN_DIR="$(cd "$PLUGIN_DIR" && pwd)"

ENV_FILE="$REPO_ROOT/customers/$CUSTOMER.env"
SECRETS_FILE="$REPO_ROOT/customers/$CUSTOMER.secrets"
DEPLOY_CONFIG="$PLUGIN_DIR/deploy-config.json"
PLUGIN_SLUG=$(basename "$PLUGIN_DIR")
CUSTOMER_DIR="$REPO_ROOT/customers/$CUSTOMER"
CUSTOMER_CONFIG="$CUSTOMER_DIR/$PLUGIN_SLUG.json"

[[ -f "$ENV_FILE" ]] || { echo "❌ No customer config at $ENV_FILE" >&2; exit 1; }
[[ -f "$DEPLOY_CONFIG" ]] || { echo "❌ No deploy-config.json at $DEPLOY_CONFIG" >&2; exit 1; }

set -a
source "$ENV_FILE"
[[ -f "$SECRETS_FILE" ]] && source "$SECRETS_FILE"
set +a

[[ -n "${PC_PASSWORD:-}" ]] || { echo "❌ PC_PASSWORD not set" >&2; exit 1; }

PC_HOST="${PC_HOST:?PC_HOST not set}"
PC_EMAIL="${PC_EMAIL:?PC_EMAIL not set}"
PC_COMPANY_ID="${PC_COMPANY_ID:?PC_COMPANY_ID not set}"
SSH_HOST="${SSH_HOST:?SSH_HOST not set}"

info() { echo "→ $*"; }
die()  { echo "❌ $*" >&2; exit 1; }

mkdir -p "$CUSTOMER_DIR"

# ── step 1: authenticate ─────────────────────────────────────────────────────

info "Authenticating with Paperclip at $PC_HOST..."
ssh "$SSH_HOST" "curl -s -X POST '$PC_HOST/api/auth/sign-in/email' \
  -H 'Content-Type: application/json' \
  -H 'Origin: $PC_HOST' \
  -c /tmp/pc_provision_cookies.txt \
  -d '{\"email\":\"$PC_EMAIL\",\"password\":\"$PC_PASSWORD\"}' > /dev/null"

# ── step 2: create secrets and build customer config ─────────────────────────

info "Resolving secrets for $PLUGIN_SLUG..."

# Collect all env vars as JSON for Python to read
ENV_JSON=$(python3 -c "import os,json; print(json.dumps(dict(os.environ)))")

RESOLVED_CONFIG=$(python3 - "$DEPLOY_CONFIG" "$CUSTOMER_CONFIG" "$SSH_HOST" "$PC_HOST" "$PC_COMPANY_ID" "$ENV_JSON" <<'PYEOF'
import json, sys, subprocess, os, base64

deploy_path, cust_path, ssh_host, pc_host, company_id, env_json = sys.argv[1:]
env = json.loads(env_json)

deploy = json.load(open(deploy_path))
existing = json.load(open(cust_path)) if os.path.isfile(cust_path) else {}

config = {**deploy.get('configJson', {}), **existing.get('configJson', {})}

# Apply PLUGIN_CONFIG_* overrides
for k, v in env.items():
    if k.startswith('PLUGIN_CONFIG_'):
        config[k[len('PLUGIN_CONFIG_'):]] = v

refs_out = {}
for key, spec in deploy.get('secretRefs', {}).items():
    existing_uuid = existing.get('secretRefs', {}).get(key, {}).get('uuid', '')
    if existing_uuid and 'REPLACE_WITH' not in existing_uuid and 'PENDING' not in existing_uuid:
        print(f'  reusing {key} → {existing_uuid}', file=sys.stderr)
        refs_out[key] = {'uuid': existing_uuid}
        continue

    env_key = key.upper()
    secret_value = env.get(env_key, '')
    if not secret_value:
        print(f'ERROR: secret value for "{key}" not provided. Set env var: {env_key}', file=sys.stderr)
        sys.exit(1)

    secret_name = spec.get('name', f'{key}')
    payload = json.dumps({'name': secret_name, 'value': secret_value})
    cmd = (
        f"curl -s -X POST '{pc_host}/api/companies/{company_id}/secrets' "
        f"-H 'Content-Type: application/json' "
        f"-H 'Origin: {pc_host}' "
        f"-b /tmp/pc_provision_cookies.txt "
        f"-d '{payload}'"
    )
    result = subprocess.run(['ssh', ssh_host, cmd], capture_output=True, text=True)
    resp = json.loads(result.stdout)
    uuid = resp.get('id', '')
    if not uuid:
        print(f'ERROR: failed to create secret {key}: {result.stdout}', file=sys.stderr)
        sys.exit(1)
    print(f'  created {key} ({secret_name}) → {uuid}', file=sys.stderr)
    refs_out[key] = {'uuid': uuid}

out = {'configJson': config, 'secretRefs': refs_out}
print(json.dumps(out, indent=2))
PYEOF
)

echo "$RESOLVED_CONFIG" > "$CUSTOMER_CONFIG"
info "Written: $CUSTOMER_CONFIG"

# ── step 3: deploy ────────────────────────────────────────────────────────────

info "Deploying $PLUGIN_SLUG to $CUSTOMER..."
export PC_CUSTOMER_CONFIG="$CUSTOMER_CONFIG"
exec "$SCRIPT_DIR/deploy-plugin.sh" "$PLUGIN_DIR"
