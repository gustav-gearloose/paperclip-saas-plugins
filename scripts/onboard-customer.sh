#!/usr/bin/env bash
# onboard-customer.sh — interactive wizard to onboard a new Paperclip SaaS customer
#
# Creates customers/<slug>.env, validates SSH + Paperclip connectivity,
# then optionally provisions selected plugins and wires the MCP proxy.
#
# Usage:
#   ./scripts/onboard-customer.sh [<customer-slug>]
#
# If slug is not provided, it is prompted interactively.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── colours ───────────────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "  ${CYAN}→${NC} $*"; }
ok()      { echo -e "  ${GREEN}✅${NC} $*"; }
warn()    { echo -e "  ${YELLOW}⚠️ ${NC} $*"; }
die()     { echo -e "\n  ${RED}❌ $*${NC}" >&2; exit 1; }
ask()     { echo -e -n "  ${CYAN}?${NC}  $* "; }
section() { echo -e "\n${CYAN}── $* ──${NC}"; }

# ── slug ─────────────────────────────────────────────────────────────────────

CUSTOMER="${1:-}"
if [[ -z "$CUSTOMER" ]]; then
  ask "Customer slug (lowercase, no spaces, e.g. acme-corp):"
  read -r CUSTOMER
fi
[[ "$CUSTOMER" =~ ^[a-z0-9][a-z0-9-]*$ ]] || die "Slug must be lowercase alphanumeric + hyphens"

ENV_FILE="$REPO_ROOT/customers/$CUSTOMER.env"
SECRETS_FILE="$REPO_ROOT/customers/$CUSTOMER.secrets"

if [[ -f "$ENV_FILE" ]]; then
  warn "customers/$CUSTOMER.env already exists."
  ask "Overwrite? (y/N):"
  read -r yn
  [[ "$yn" =~ ^[Yy]$ ]] || { info "Keeping existing config. Exiting."; exit 0; }
fi

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Paperclip SaaS Customer Onboarding     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "  Customer: $CUSTOMER"

# ── gather config ─────────────────────────────────────────────────────────────

section "Instance config"

ask "SSH host alias (from ~/.ssh/config, e.g. 'acme-nuc'):"
read -r SSH_HOST

ask "Paperclip admin email:"
read -r PC_EMAIL

ask "Paperclip admin password (not stored in .env, goes to .secrets):"
read -rs PC_PASSWORD
echo ""

ask "Paperclip company UUID (from Settings → General in the UI):"
read -r PC_COMPANY_ID

ask "Paperclip URL as seen from inside the server (default: http://localhost:3100):"
read -r PC_HOST_INPUT
PC_HOST="${PC_HOST_INPUT:-http://localhost:3100}"

CONTAINER="paperclip-deploy-paperclip-1"
ask "Docker container name (default: $CONTAINER):"
read -r CONTAINER_INPUT
[[ -n "$CONTAINER_INPUT" ]] && CONTAINER="$CONTAINER_INPUT"

# ── validate SSH ──────────────────────────────────────────────────────────────

section "Validating SSH connectivity"

if ssh -o ConnectTimeout=8 -o BatchMode=yes "$SSH_HOST" "echo ok" 2>/dev/null | grep -q ok; then
  ok "SSH to $SSH_HOST works"
else
  warn "Cannot reach $SSH_HOST via SSH. Make sure the host alias exists in ~/.ssh/config and you have key-based access."
  ask "Continue anyway? (y/N):"
  read -r yn
  [[ "$yn" =~ ^[Yy]$ ]] || exit 1
fi

# ── validate Docker container ─────────────────────────────────────────────────

section "Validating Docker container"

if ssh "$SSH_HOST" "DOCKER_HOST=unix:///var/run/docker.sock docker inspect $CONTAINER --format '{{.State.Status}}'" 2>/dev/null | grep -q running; then
  ok "Container $CONTAINER is running"
else
  warn "Container $CONTAINER not found or not running on $SSH_HOST."
  ask "Continue anyway? (y/N):"
  read -r yn
  [[ "$yn" =~ ^[Yy]$ ]] || exit 1
fi

# ── validate Paperclip auth ───────────────────────────────────────────────────

section "Validating Paperclip authentication"

AUTH_RESULT=$(ssh "$SSH_HOST" "curl -s -X POST '$PC_HOST/api/auth/sign-in/email' \
  -H 'Content-Type: application/json' \
  -H 'Origin: $PC_HOST' \
  -c /tmp/pc_onboard_cookies_$CUSTOMER.txt \
  -d '{\"email\":\"$PC_EMAIL\",\"password\":\"$PC_PASSWORD\"}'" 2>/dev/null || echo '{"error":"curl failed"}')

if echo "$AUTH_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('user') or d.get('token') or d.get('session') else 1)" 2>/dev/null; then
  ok "Authentication successful"
elif echo "$AUTH_RESULT" | grep -q "session_token"; then
  ok "Authentication successful (session cookie set)"
else
  warn "Auth response: $AUTH_RESULT"
  die "Authentication failed. Check email/password and that Paperclip is running."
fi

# ── validate company ID ───────────────────────────────────────────────────────

COMPANY_CHECK=$(ssh "$SSH_HOST" "curl -s '$PC_HOST/api/companies/$PC_COMPANY_ID' \
  -b /tmp/pc_onboard_cookies_$CUSTOMER.txt \
  -H 'Origin: $PC_HOST'" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('name','?'))" 2>/dev/null || echo "")

if [[ -n "$COMPANY_CHECK" && "$COMPANY_CHECK" != "?" ]]; then
  ok "Company found: $COMPANY_CHECK"
else
  warn "Could not verify company ID $PC_COMPANY_ID (may still be correct)"
fi

# ── write config files ────────────────────────────────────────────────────────

section "Writing customer config"

mkdir -p "$REPO_ROOT/customers/$CUSTOMER"

cat > "$ENV_FILE" <<EOF
# $CUSTOMER — Paperclip SaaS instance config
# Created: $(date -u +%Y-%m-%dT%H:%M:%SZ)
PC_HOST=$PC_HOST
PC_EMAIL=$PC_EMAIL
# PC_PASSWORD — stored in customers/$CUSTOMER.secrets (not committed)
PC_COMPANY_ID=$PC_COMPANY_ID
SSH_HOST=$SSH_HOST
CONTAINER=$CONTAINER
EOF

printf 'PC_PASSWORD=%s\n' "$PC_PASSWORD" > "$SECRETS_FILE"
chmod 600 "$SECRETS_FILE"

ok "Written: customers/$CUSTOMER.env"
ok "Written: customers/$CUSTOMER.secrets (chmod 600)"

# Remind to add .secrets to gitignore
if ! grep -q "*.secrets" "$REPO_ROOT/.gitignore" 2>/dev/null; then
  echo "*.secrets" >> "$REPO_ROOT/.gitignore"
  ok "Added *.secrets to .gitignore"
fi

# ── plugin selection ──────────────────────────────────────────────────────────

section "Plugin selection"

echo "  Available plugins:"
echo "    1) Dinero (accounting — DK)"
echo "    2) Billy (accounting — DK)"
echo "    3) e-conomic (accounting — DK)"
echo "    4) Zendesk (customer support)"
echo "    5) HubSpot (CRM)"
echo "    6) Slack (messaging)"
echo "    7) Google Sheets"
echo "    8) Notion"
echo "    9) Linear (issue tracking)"
echo "   10) Email (IMAP/SMTP)"
echo ""
ask "Which plugins to install? (comma-separated numbers, e.g. 1,2,6 — or 'all' or 'none'):"
read -r PLUGIN_SELECTION

declare -A PLUGIN_DIRS=(
  [1]="packages/plugin-dinero"
  [2]="packages/plugin-billy"
  [3]="packages/plugin-economic"
  [4]="packages/plugin-zendesk"
  [5]="packages/plugin-hubspot"
  [6]="packages/plugin-slack"
  [7]="packages/plugin-google-sheets"
  [8]="packages/plugin-notion"
  [9]="packages/plugin-linear"
  [10]="packages/plugin-email"
)

declare -A PLUGIN_ENV_VARS=(
  [1]="DINEROCLIENTIDREF=<dinero-client-id> DINEROCLIENTSECRETREF=<dinero-client-secret> DINEROAPIKEYREF=<dinero-api-key> PLUGIN_CONFIG_dineroOrgId=<org-id>"
  [2]="ACCESSTOKENREF=<billy-access-token>"
  [3]="APPSECRETTOKENREF=<economic-app-secret-token> AGREEMENTGRANTTOKENREF=<economic-agreement-grant-token>"
  [4]="APITOKENREF=<zendesk-api-token> PLUGIN_CONFIG_subdomain=<zendesk-subdomain> PLUGIN_CONFIG_email=<zendesk-agent-email>"
  [5]="ACCESSTOKENREF=<hubspot-private-app-token>"
  [6]="BOTTOKENREF=<slack-bot-token>"
  [7]="SERVICEACCOUNTJSONREF=<service-account-json-string>"
  [8]="INTEGRATIONTOKENREF=<notion-integration-token>"
  [9]="APIKEYREF=<linear-personal-api-key>"
  [10]="EMAILPASSWORDREF=<imap-smtp-password> PLUGIN_CONFIG_emailUser=<email> PLUGIN_CONFIG_imapHost=<imap-host> PLUGIN_CONFIG_imapPort=993 PLUGIN_CONFIG_smtpHost=<smtp-host> PLUGIN_CONFIG_smtpPort=465"
)

SELECTED_NUMS=()
if [[ "$PLUGIN_SELECTION" == "all" ]]; then
  SELECTED_NUMS=(1 2 3 4 5 6 7 8 9 10)
elif [[ "$PLUGIN_SELECTION" != "none" && -n "$PLUGIN_SELECTION" ]]; then
  IFS=',' read -ra SELECTED_NUMS <<< "$PLUGIN_SELECTION"
fi

# ── wire MCP proxy ────────────────────────────────────────────────────────────

section "MCP proxy wiring"

ask "Wire MCP proxy now? (gives agents access to plugin tools) [Y/n]:"
read -r WIRE_MCP
WIRE_MCP="${WIRE_MCP:-y}"

if [[ "$WIRE_MCP" =~ ^[Yy]$ ]]; then
  info "Running wire-mcp-to-customer.sh..."
  if PC_PASSWORD="$PC_PASSWORD" "$SCRIPT_DIR/wire-mcp-to-customer.sh" "$CUSTOMER"; then
    ok "MCP proxy wired successfully"
  else
    warn "MCP proxy wiring failed — you can retry later with:"
    echo "      PC_PASSWORD=<pw> ./scripts/wire-mcp-to-customer.sh $CUSTOMER"
  fi
fi

# ── provision plugins ──────────────────────────────────────────────────────────

if [[ ${#SELECTED_NUMS[@]} -gt 0 ]]; then
  section "Provisioning plugins"

  for num in "${SELECTED_NUMS[@]}"; do
    num="${num// /}"
    dir="${PLUGIN_DIRS[$num]:-}"
    [[ -z "$dir" ]] && { warn "Unknown plugin number: $num (skipping)"; continue; }
    env_hint="${PLUGIN_ENV_VARS[$num]:-}"
    plugin_name=$(basename "$dir")

    echo ""
    echo -e "  ${CYAN}Plugin: $plugin_name${NC}"
    echo "  Required env vars: $env_hint"
    echo ""
    ask "  Provide credentials now? (y/N):"
    read -r do_provision

    if [[ ! "$do_provision" =~ ^[Yy]$ ]]; then
      info "Skipping $plugin_name. Provision later with:"
      echo "      PC_PASSWORD=<pw> $env_hint \\"
      echo "        ./scripts/provision-plugin.sh $CUSTOMER $dir"
      continue
    fi

    # Collect each env var interactively
    declare -a EXTRA_ENV=()
    for var_pair in $env_hint; do
      var_name="${var_pair%%=*}"
      ask "    $var_name:"
      read -r var_val
      EXTRA_ENV+=("${var_name}=${var_val}")
    done

    info "Provisioning $plugin_name..."
    if env PC_PASSWORD="$PC_PASSWORD" "${EXTRA_ENV[@]}" "$SCRIPT_DIR/provision-plugin.sh" "$CUSTOMER" "$dir"; then
      ok "$plugin_name provisioned"
    else
      warn "$plugin_name provisioning failed. Check output above."
    fi
    unset EXTRA_ENV
  done
fi

# ── summary ───────────────────────────────────────────────────────────────────

section "Done"

echo ""
echo "  Customer '$CUSTOMER' onboarded."
echo ""
echo "  Next steps:"
echo "    • Commit customers/$CUSTOMER.env (and customers/$CUSTOMER/*.json)"
echo "    • Tell the customer to open Paperclip and start a conversation with their agent"
echo "    • Verify tools work: ./scripts/smoke-test-plugins.sh $CUSTOMER"
echo ""
if [[ ${#SELECTED_NUMS[@]} -gt 0 ]]; then
  echo "  Reprovision a plugin later:"
  echo "    PC_PASSWORD=<pw> ./scripts/provision-plugin.sh $CUSTOMER packages/plugin-<name>"
  echo ""
  echo "  Redeploy after a code update:"
  echo "    PC_PASSWORD=<pw> ./scripts/deploy-for-customer.sh $CUSTOMER packages/plugin-<name>"
  echo ""
fi
