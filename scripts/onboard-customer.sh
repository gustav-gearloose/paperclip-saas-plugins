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

ask "Paperclip company UUID (press Enter to auto-detect after login):"
read -r PC_COMPANY_ID

ask "Paperclip URL as seen from inside the server (default: http://localhost:3100):"
read -r PC_HOST_INPUT
PC_HOST="${PC_HOST_INPUT:-http://localhost:3100}"

CONTAINER="paperclipai-server-1"
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

# ── auto-detect or validate company ID ───────────────────────────────────────

if [[ -z "$PC_COMPANY_ID" ]]; then
  info "Auto-detecting company ID from Paperclip API..."
  DETECTED=$(ssh "$SSH_HOST" "curl -s '$PC_HOST/api/companies' \
    -b /tmp/pc_onboard_cookies_$CUSTOMER.txt \
    -H 'Origin: $PC_HOST'" 2>/dev/null \
    | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if isinstance(data, list) and data:
        print(data[0]['id'] + '|' + data[0].get('name', '?'))
    elif isinstance(data, dict) and data.get('id'):
        print(data['id'] + '|' + data.get('name', '?'))
    else:
        print('')
except Exception:
    print('')
" 2>/dev/null || echo "")

  if [[ -n "$DETECTED" ]]; then
    PC_COMPANY_ID="${DETECTED%%|*}"
    COMPANY_NAME="${DETECTED##*|}"
    ok "Auto-detected company: $COMPANY_NAME ($PC_COMPANY_ID)"
  else
    warn "Could not auto-detect company ID from GET /api/companies"
    ask "Enter company UUID manually (from Paperclip Settings → General):"
    read -r PC_COMPANY_ID
    [[ -n "$PC_COMPANY_ID" ]] || die "Company ID is required"
  fi
else
  COMPANY_CHECK=$(ssh "$SSH_HOST" "curl -s '$PC_HOST/api/companies/$PC_COMPANY_ID' \
    -b /tmp/pc_onboard_cookies_$CUSTOMER.txt \
    -H 'Origin: $PC_HOST'" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('name','?'))" 2>/dev/null || echo "")

  if [[ -n "$COMPANY_CHECK" && "$COMPANY_CHECK" != "?" ]]; then
    ok "Company found: $COMPANY_CHECK"
  else
    warn "Could not verify company ID $PC_COMPANY_ID (may still be correct)"
  fi
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

# ── plugin lookup (Bash 3 compatible — no declare -A) ─────────────────────────

plugin_dir() {
  case "$1" in
    1)  echo "packages/plugin-dinero" ;;
    2)  echo "packages/plugin-billy" ;;
    3)  echo "packages/plugin-economic" ;;
    4)  echo "packages/plugin-zendesk" ;;
    5)  echo "packages/plugin-hubspot" ;;
    6)  echo "packages/plugin-slack" ;;
    7)  echo "packages/plugin-google-sheets" ;;
    8)  echo "packages/plugin-notion" ;;
    9)  echo "packages/plugin-linear" ;;
    10) echo "packages/plugin-email" ;;
    *)  echo "" ;;
  esac
}

# Returns tab-separated list of VAR_NAME entries (one per line) for a plugin
plugin_env_vars() {
  case "$1" in
    1)  printf 'DINEROCLIENTIDREF\nDINEROCLIENTSECRETREF\nDINEROAPIKEYREF\nPLUGIN_CONFIG_dineroOrgId' ;;
    2)  printf 'ACCESSTOKENREF' ;;
    3)  printf 'APPSECRETTOKENREF\nAGREEMENTGRANTTOKENREF' ;;
    4)  printf 'APITOKENREF\nPLUGIN_CONFIG_subdomain\nPLUGIN_CONFIG_email' ;;
    5)  printf 'ACCESSTOKENREF' ;;
    6)  printf 'BOTTOKENREF' ;;
    7)  printf 'SERVICEACCOUNTJSONREF' ;;
    8)  printf 'INTEGRATIONTOKENREF' ;;
    9)  printf 'APIKEYREF' ;;
    10) printf 'EMAILPASSWORDREF\nPLUGIN_CONFIG_emailUser\nPLUGIN_CONFIG_imapHost\nPLUGIN_CONFIG_imapPort\nPLUGIN_CONFIG_smtpHost\nPLUGIN_CONFIG_smtpPort\nPLUGIN_CONFIG_displayName' ;;
    *)  printf '' ;;
  esac
}

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
    dir=$(plugin_dir "$num")
    [[ -z "$dir" ]] && { warn "Unknown plugin number: $num (skipping)"; continue; }
    plugin_name=$(basename "$dir")
    # Bash 3 compatible: read newline-separated output into array
    env_var_names=()
    while IFS= read -r line; do
      [[ -n "$line" ]] && env_var_names+=("$line")
    done < <(plugin_env_vars "$num")

    echo ""
    echo -e "  ${CYAN}Plugin: $plugin_name${NC}"
    echo "  Required credentials: ${env_var_names[*]}"
    echo ""
    ask "  Provide credentials now? (y/N):"
    read -r do_provision

    if [[ ! "$do_provision" =~ ^[Yy]$ ]]; then
      info "Skipping $plugin_name. Provision later with:"
      echo "      PC_PASSWORD=<pw> \\"
      for vn in "${env_var_names[@]}"; do
        echo "        ${vn}=<value> \\"
      done
      echo "        ./scripts/provision-plugin.sh $CUSTOMER $dir"
      continue
    fi

    # Collect credentials interactively; export them so provision-plugin.sh sees them
    for vn in "${env_var_names[@]}"; do
      ask "    $vn:"
      if [[ "$vn" == *PASSWORD* || "$vn" == *SECRET* || "$vn" == *TOKEN* || "$vn" == *KEY* ]]; then
        read -rs vv; echo ""
      else
        read -r vv
      fi
      export "$vn=$vv"
    done

    info "Provisioning $plugin_name..."
    if PC_PASSWORD="$PC_PASSWORD" "$SCRIPT_DIR/provision-plugin.sh" "$CUSTOMER" "$dir"; then
      ok "$plugin_name provisioned"
    else
      warn "$plugin_name provisioning failed. Check output above."
    fi

    # Unset the credential vars we just exported
    for vn in "${env_var_names[@]}"; do
      unset "$vn"
    done
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
