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

ask "Public HTTPS URL (e.g. https://paperclip.acme.com — leave empty for NUC/LAN installs):"
read -r PC_ORIGIN_INPUT
# PC_ORIGIN defaults to PC_HOST. For VPS installs behind Caddy, set to the public domain
# so the MCP proxy sends the correct Origin header matching Paperclip's CSRF check.
PC_ORIGIN="${PC_ORIGIN_INPUT:-$PC_HOST}"

CONTAINER="paperclipai-docker-server-1"
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

_AUTH_B64=$(python3 -c "import json,base64,sys; print(base64.b64encode(json.dumps({'email':sys.argv[1],'password':sys.argv[2]}).encode()).decode())" "$PC_EMAIL" "$PC_PASSWORD")
AUTH_RESULT=$(ssh "$SSH_HOST" "echo $_AUTH_B64 | base64 -d | curl -s -X POST '$PC_HOST/api/auth/sign-in/email' \
  -H 'Content-Type: application/json' \
  -H 'Origin: $PC_ORIGIN' \
  -c /tmp/pc_onboard_cookies_$CUSTOMER.txt \
  --data-binary @-" 2>/dev/null || echo '{"error":"curl failed"}')

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
    -H 'Origin: $PC_ORIGIN'" 2>/dev/null \
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
    -H 'Origin: $PC_ORIGIN'" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('name','?'))" 2>/dev/null || echo "")

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
# PC_ORIGIN: public URL sent as Origin header by the MCP proxy.
# Must match PAPERCLIP_PUBLIC_URL so Paperclip's CSRF check passes.
# For NUC/LAN installs this equals PC_HOST. For VPS+Caddy installs set the HTTPS domain.
PC_ORIGIN=$PC_ORIGIN
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

# ── apply container patches ──────────────────────────────────────────────────
#
# The pluginDbId bug in Paperclip's compiled JS causes all plugin tool calls to
# fail with "worker not running". patch-paperclip-container.sh fixes it.
# Must be applied (and container restarted) before provisioning plugins.

section "Container patches (required for plugin tools)"

ask "Apply Paperclip container patches now? Fixes pluginDbId bug — required for tools to work. [Y/n]:"
read -r DO_PATCH
DO_PATCH="${DO_PATCH:-y}"

if [[ "$DO_PATCH" =~ ^[Yy]$ ]]; then
  info "Running patch-paperclip-container.sh $CUSTOMER..."
  if "$SCRIPT_DIR/patch-paperclip-container.sh" "$CUSTOMER"; then
    ok "Container patches applied (or already present / upstream-fixed)"
    info "Restarting container to pick up patches..."
    if ssh "$SSH_HOST" "DOCKER_HOST=unix:///var/run/docker.sock docker restart $CONTAINER" 2>/dev/null; then
      ok "Container restarted"
      # Wait up to 45 s for Paperclip to come back healthy
      ATTEMPTS=0
      while ! ssh "$SSH_HOST" "curl -sf $PC_HOST/api/health > /dev/null 2>&1"; do
        ATTEMPTS=$((ATTEMPTS + 1))
        [[ $ATTEMPTS -ge 15 ]] && break
        echo -n "."; sleep 3
      done
      echo ""
      if [[ $ATTEMPTS -lt 15 ]]; then
        ok "Paperclip healthy after restart"
      else
        warn "Health check timed out — Paperclip may still be starting. Wait a moment and verify."
      fi
    else
      warn "Container restart failed — run manually: ssh $SSH_HOST 'docker restart $CONTAINER'"
    fi
  else
    warn "Patch script exited with error — you can retry later:"
    warn "  ./scripts/patch-paperclip-container.sh $CUSTOMER"
    warn "Plugin tools will NOT work until patches are applied and container restarted."
  fi
else
  info "Skipping patches."
  warn "Plugin tools will NOT work until patches are applied and container restarted."
  warn "  ./scripts/patch-paperclip-container.sh $CUSTOMER && ssh $SSH_HOST 'docker restart $CONTAINER'"
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
    11) echo "packages/plugin-teams" ;;
    12) echo "packages/plugin-fortnox" ;;
    13) echo "packages/plugin-pipedrive" ;;
    14) echo "packages/plugin-intercom" ;;
    15) echo "packages/plugin-jira" ;;
    16) echo "packages/plugin-github" ;;
    17) echo "packages/plugin-freshdesk" ;;
    18) echo "packages/plugin-stripe" ;;
    19) echo "packages/plugin-woocommerce" ;;
    20) echo "__custom__" ;;
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
    11) printf 'CLIENTIDREF\nCLIENTSECRETREF\nPLUGIN_CONFIG_tenantId' ;;
    12) printf 'ACCESSTOKENREF\nREFRESHTOKENREF\nCLIENTIDREF\nCLIENTSECRETREF' ;;
    13) printf 'APITOKENREF' ;;
    14) printf 'ACCESSTOKENREF' ;;
    15) printf 'APITOKENREF\nPLUGIN_CONFIG_email\nPLUGIN_CONFIG_domain' ;;
    16) printf 'TOKENREF\nPLUGIN_CONFIG_owner' ;;
    17) printf 'APIKEYREF\nPLUGIN_CONFIG_domain' ;;
    18) printf 'SECRETKEYREF' ;;
    19) printf 'CONSUMERKEYREF\nCONSUMERSECRETREF\nPLUGIN_CONFIG_siteUrl' ;;
    20) printf '' ;;  # custom — credentials collected interactively by scaffold sub-flow
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
echo "   11) Microsoft Teams"
echo "   12) Fortnox (accounting — SE)"
echo "   13) Pipedrive (CRM)"
echo "   14) Intercom (customer messaging)"
echo "   15) Jira (issue tracking)"
echo "   16) GitHub (repositories, issues, PRs, code search)"
echo "   17) Freshdesk (customer support)"
echo "   18) Stripe (payments, subscriptions, invoices)"
echo "   19) WooCommerce (e-commerce orders, products, customers)"
echo "   20) Custom plugin (scaffold a new plugin with new-plugin.sh)"
echo ""
ask "Which plugins to install? (comma-separated numbers, e.g. 1,2,6 — or 'all' or 'none'):"
read -r PLUGIN_SELECTION

SELECTED_NUMS=()
if [[ "$PLUGIN_SELECTION" == "all" ]]; then
  SELECTED_NUMS=(1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19)  # 20 (custom) excluded from 'all'
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

    # ── custom plugin scaffold sub-flow ───────────────────────────────────────
    if [[ "$dir" == "__custom__" ]]; then
      echo ""
      echo -e "  ${CYAN}Custom plugin scaffold${NC}"
      ask "  Plugin name (short, e.g. 'freshdesk' or 'fortnox'):"
      read -r custom_name
      [[ -z "$custom_name" ]] && { warn "No plugin name given — skipping custom plugin"; continue; }

      custom_dir="$REPO_ROOT/packages/plugin-$custom_name"
      if [[ -d "$custom_dir" ]]; then
        warn "  $custom_dir already exists — skipping scaffold (will provision existing)"
      else
        ask "  Secret refs (space-separated, e.g. 'apiTokenRef accessKeyRef' — or leave empty):"
        read -r custom_secrets_raw
        ask "  Config fields (space-separated key=desc pairs, e.g. 'subdomain=Subdomain email=Email' — or empty):"
        read -r custom_configs_raw
        ask "  Tool names (space-separated, e.g. 'list_tickets get_ticket' — or empty):"
        read -r custom_tools_raw

        scaffold_args=("$custom_name")
        for s in $custom_secrets_raw; do
          scaffold_args+=(--secret "$s")
        done
        for kv in $custom_configs_raw; do
          scaffold_args+=(--config "$kv")
        done
        for t in $custom_tools_raw; do
          scaffold_args+=(--tool "$t")
        done

        info "  Scaffolding plugin-$custom_name..."
        if ! "$SCRIPT_DIR/new-plugin.sh" "${scaffold_args[@]}"; then
          warn "  Scaffold failed — skipping plugin-$custom_name"; continue
        fi

        info "  Building plugin-$custom_name (npm install + tsc)..."
        build_out=$( (cd "$custom_dir" && npm install --ignore-scripts && npm run build) 2>&1) || {
          echo "$build_out"
          warn "  Build failed — skipping plugin-$custom_name"; continue
        }

        info "  Validating plugin-$custom_name..."
        "$SCRIPT_DIR/validate-plugins.sh" "$custom_dir" || warn "  Validation warnings above — continuing anyway"
      fi

      # collect credentials for the custom plugin: ask for each secret ref and config key
      custom_env_vars=()
      secret_refs_in_dir=()
      config_keys_in_dir=()
      if [[ -f "$custom_dir/deploy-config.json" ]]; then
        while IFS= read -r line; do
          key=$(echo "$line" | sed 's/.*"//;s/".*//')
          [[ -n "$key" ]] && secret_refs_in_dir+=("$key")
        done < <(python3 -c "
import json, sys
d=json.load(open(sys.argv[1]))
for k in d.get('secretRefs',{}): print(k)
" "$custom_dir/deploy-config.json" 2>/dev/null || true)
        while IFS= read -r line; do
          [[ -n "$line" ]] && config_keys_in_dir+=("$line")
        done < <(python3 -c "
import json, sys
d=json.load(open(sys.argv[1]))
for k in d.get('configJson',{}): print(k)
" "$custom_dir/deploy-config.json" 2>/dev/null || true)
      fi

      echo ""
      for sr in "${secret_refs_in_dir[@]+"${secret_refs_in_dir[@]}"}"; do
        var_name="$(echo "$sr" | tr '[:lower:]' '[:upper:]')"
        ask "    $var_name (credential value for secret ref '$sr'):"
        read -rs vv; echo ""
        export "$var_name=$vv"
        custom_env_vars+=("$var_name")
      done
      for ck in "${config_keys_in_dir[@]+"${config_keys_in_dir[@]}"}"; do
        ask "    PLUGIN_CONFIG_$ck:"
        read -r vv
        export "PLUGIN_CONFIG_$ck=$vv"
        custom_env_vars+=("PLUGIN_CONFIG_$ck")
      done

      info "  Provisioning plugin-$custom_name..."
      if PC_PASSWORD="$PC_PASSWORD" "$SCRIPT_DIR/provision-plugin.sh" "$CUSTOMER" "$custom_dir"; then
        ok "plugin-$custom_name provisioned"
      else
        warn "plugin-$custom_name provisioning failed. Check output above."
      fi

      for vn in "${custom_env_vars[@]+"${custom_env_vars[@]}"}"; do unset "$vn"; done
      continue
    fi

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
      if [[ "$vn" == "SERVICEACCOUNTJSONREF" ]]; then
        # Multi-line JSON — read from file path to avoid pasting issues
        ask "    $vn — path to service-account-key.json file:"
        read -r json_path
        json_path="${json_path/#\~/$HOME}"   # expand leading ~
        if [[ ! -f "$json_path" ]]; then
          warn "File not found: $json_path — skipping $plugin_name"
          continue 2
        fi
        vv="$(cat "$json_path")"
      elif [[ "$vn" == *PASSWORD* || "$vn" == *SECRET* || "$vn" == *TOKEN* || "$vn" == *KEY* ]]; then
        ask "    $vn:"
        read -rs vv; echo ""
      else
        ask "    $vn:"
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
