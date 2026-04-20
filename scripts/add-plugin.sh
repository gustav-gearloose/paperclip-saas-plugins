#!/usr/bin/env bash
# add-plugin.sh — add one or more plugins to an already-onboarded customer
#
# Loads customers/<slug>.env (customer must already exist).
# Shows the same plugin menu as onboard-customer.sh and provisions selected plugins.
# Optionally re-wires the MCP proxy so agents see the new tools immediately.
#
# Usage:
#   ./scripts/add-plugin.sh <customer-slug>
#
# Example:
#   PC_PASSWORD=<pw> ./scripts/add-plugin.sh acme-corp
#   # or: store password in customers/acme-corp.secrets

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

# ── load customer ─────────────────────────────────────────────────────────────

CUSTOMER="${1:?Usage: $0 <customer-slug>}"
[[ "$CUSTOMER" =~ ^[a-z0-9][a-z0-9-]*$ ]] || die "Slug must be lowercase alphanumeric + hyphens"

ENV_FILE="$REPO_ROOT/customers/$CUSTOMER.env"
SECRETS_FILE="$REPO_ROOT/customers/$CUSTOMER.secrets"
CUSTOMER_DIR="$REPO_ROOT/customers/$CUSTOMER"

[[ -f "$ENV_FILE" ]] || die "No customer config at $ENV_FILE — run onboard-customer.sh first"

set -a
source "$ENV_FILE"
[[ -f "$SECRETS_FILE" ]] && source "$SECRETS_FILE"
set +a

PC_PASSWORD="${PC_PASSWORD:?PC_PASSWORD not set — export it or add to customers/$CUSTOMER.secrets}"
PC_HOST="${PC_HOST:?PC_HOST not set in $ENV_FILE}"
PC_ORIGIN="${PC_ORIGIN:-$PC_HOST}"
PC_EMAIL="${PC_EMAIL:?PC_EMAIL not set}"
PC_COMPANY_ID="${PC_COMPANY_ID:?PC_COMPANY_ID not set}"
SSH_HOST="${SSH_HOST:?SSH_HOST not set}"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Paperclip SaaS — Add Plugin            ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "  Customer: $CUSTOMER"
echo "  Host:     $PC_HOST via $SSH_HOST"
echo ""

# ── already provisioned ───────────────────────────────────────────────────────

EXISTING_CONFIGS=("$CUSTOMER_DIR"/plugin-*.json)
if [[ ${#EXISTING_CONFIGS[@]} -gt 0 ]] && [[ -f "${EXISTING_CONFIGS[0]}" ]]; then
  echo "  Already provisioned:"
  for f in "${EXISTING_CONFIGS[@]}"; do
    echo "    • $(basename "$f" .json)"
  done
  echo ""
fi

# ── plugin lookup (Bash 3 compatible) ────────────────────────────────────────

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
    20) echo "packages/plugin-shopify" ;;
    21) echo "packages/plugin-monday" ;;
    22) echo "packages/plugin-asana" ;;
    23) echo "packages/plugin-salesforce" ;;
    24) echo "packages/plugin-trello" ;;
    25) echo "packages/plugin-clickup" ;;
    26) echo "packages/plugin-todoist" ;;
    27) echo "packages/plugin-airtable" ;;
    28) echo "packages/plugin-harvest" ;;
    29) echo "packages/plugin-typeform" ;;
    30) echo "packages/plugin-calendly" ;;
    31) echo "packages/plugin-mailchimp" ;;
    32) echo "packages/plugin-activecampaign" ;;
    33) echo "packages/plugin-twilio" ;;
    34) echo "packages/plugin-brevo" ;;
    35) echo "packages/plugin-sendgrid" ;;
    36) echo "packages/plugin-klaviyo" ;;
    37) echo "packages/plugin-zoho-crm" ;;
    38) echo "packages/plugin-mailgun" ;;
    39) echo "packages/plugin-postmark" ;;
    40) echo "packages/plugin-outlook" ;;
    41) echo "packages/plugin-onedrive" ;;
    42) echo "packages/plugin-google-drive" ;;
    43) echo "packages/plugin-confluence" ;;
    44) echo "packages/plugin-dropbox" ;;
    45) echo "packages/plugin-freshsales" ;;
    46) echo "packages/plugin-bamboohr" ;;
    47) echo "packages/plugin-personio" ;;
    48) echo "packages/plugin-podio" ;;
    49) echo "packages/plugin-toggl" ;;
    50) echo "packages/plugin-google-calendar" ;;
    51) echo "packages/plugin-xero" ;;
    52) echo "packages/plugin-visma" ;;
    53) echo "packages/plugin-quickbooks" ;;
    54) echo "packages/plugin-freshbooks" ;;
    55) echo "packages/plugin-sage" ;;
    56) echo "packages/plugin-superoffice" ;;
    57) echo "packages/plugin-planday" ;;
    58) echo "packages/plugin-pleo" ;;
    59) echo "packages/plugin-clockify" ;;
    60) echo "packages/plugin-hibob" ;;
    61) echo "packages/plugin-tripletex" ;;
    62) echo "packages/plugin-recruitee" ;;
    63) echo "packages/plugin-teamtailor" ;;
    64) echo "packages/plugin-workable" ;;
    65) echo "packages/plugin-greenhouse" ;;
    66) echo "__custom__" ;;
    *)  echo "" ;;
  esac
}

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
    20) printf 'ACCESSTOKENREF\nPLUGIN_CONFIG_shopDomain' ;;
    21) printf 'APITOKENREF' ;;
    22) printf 'ACCESSTOKENREF' ;;
    23) printf 'ACCESSTOKENREF\nREFRESHTOKENREF\nCLIENTIDREF\nCLIENTSECRETREF\nPLUGIN_CONFIG_instanceUrl' ;;
    24) printf 'APIKEYREF\nAPITOKENREF' ;;
    25) printf 'APITOKENREF' ;;
    26) printf 'APITOKENREF' ;;
    27) printf 'APIKEYREF' ;;
    28) printf 'APITOKENREF\nPLUGIN_CONFIG_accountId' ;;
    29) printf 'APITOKENREF' ;;
    30) printf 'APITOKENREF' ;;
    31) printf 'APIKEYREF\nPLUGIN_CONFIG_serverPrefix' ;;
    32) printf 'APIKEYREF\nPLUGIN_CONFIG_accountUrl' ;;
    33) printf 'AUTHTOKENREF\nPLUGIN_CONFIG_accountSid' ;;
    34) printf 'APIKEYREF' ;;
    35) printf 'APIKEYREF' ;;
    36) printf 'APIKEYREF' ;;
    37) printf 'ACCESSTOKENREF\nPLUGIN_CONFIG_domain' ;;
    38) printf 'APIKEYREF\nPLUGIN_CONFIG_domain\nPLUGIN_CONFIG_region' ;;
    39) printf 'SERVERTOKENREF' ;;
    40) printf 'CLIENTIDREF\nCLIENTSECRETREF\nPLUGIN_CONFIG_tenantId\nPLUGIN_CONFIG_userPrincipalName' ;;
    41) printf 'CLIENTIDREF\nCLIENTSECRETREF\nPLUGIN_CONFIG_tenantId\nPLUGIN_CONFIG_userPrincipalName' ;;
    42) printf 'SERVICEACCOUNTJSONREF\nPLUGIN_CONFIG_delegatedUser' ;;
    43) printf 'APITOKENREF\nPLUGIN_CONFIG_email\nPLUGIN_CONFIG_domain' ;;
    44) printf 'ACCESSTOKENREF' ;;
    45) printf 'APIKEYREF\nPLUGIN_CONFIG_domain' ;;
    46) printf 'APIKEYREF\nPLUGIN_CONFIG_domain' ;;
    47) printf 'CLIENTIDREF\nCLIENTSECRETREF' ;;
    48) printf 'CLIENTIDREF\nCLIENTSECRETREF\nAPPTOKENREF\nPLUGIN_CONFIG_appId' ;;
    49) printf 'APITOKENREF' ;;
    50) printf 'SERVICEACCOUNTJSONREF\nPLUGIN_CONFIG_calendarId' ;;
    51) printf 'CLIENTIDREF\nCLIENTSECRETREF\nREFRESHTOKENREF\nPLUGIN_CONFIG_tenantId' ;;
    52) printf 'CLIENTIDREF\nCLIENTSECRETREF\nREFRESHTOKENREF' ;;
    53) printf 'CLIENTIDREF\nCLIENTSECRETREF\nREFRESHTOKENREF\nPLUGIN_CONFIG_realmId' ;;
    54) printf 'CLIENTIDREF\nCLIENTSECRETREF\nREFRESHTOKENREF' ;;
    55) printf 'CLIENTIDREF\nCLIENTSECRETREF\nREFRESHTOKENREF' ;;
    56) printf 'CLIENTIDREF\nCLIENTSECRETREF\nREFRESHTOKENREF\nPLUGIN_CONFIG_tenantId' ;;
    57) printf 'CLIENTIDREF\nREFRESHTOKENREF' ;;
    58) printf 'CLIENTIDREF\nCLIENTSECRETREF' ;;
    59) printf 'APIKEYREF' ;;
    60) printf 'SERVICEUSERIDREF\nTOKENREF' ;;
    61) printf 'CONSUMERTOKENREF\nEMPLOYEETOKENREF' ;;
    62) printf 'APITOKENREF\nPLUGIN_CONFIG_companyId' ;;
    63) printf 'APIKEYREF' ;;
    64) printf 'ACCESSTOKENREF\nPLUGIN_CONFIG_subdomain' ;;
    65) printf 'APIKEYREF\nPLUGIN_CONFIG_onBehalfOfUserId' ;;
    66) printf '' ;;  # custom — credentials collected interactively by scaffold sub-flow
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
echo "   20) Shopify (e-commerce orders, products, customers)"
echo "   21) monday.com (boards, items, updates, users)"
echo "   22) Asana (projects, tasks, teams)"
echo "   23) Salesforce (contacts, accounts, opportunities, leads)"
echo "   24) Trello (boards, lists, cards, members, search)"
echo "   25) ClickUp (workspaces, spaces, lists, tasks, search)"
echo "   26) Todoist (projects, tasks, labels, comments)"
echo "   27) Airtable (bases, tables, records — CRUD + search)"
echo "   28) Harvest (time tracking — entries, projects, clients, invoices)"
echo "   29) Typeform (surveys — list forms, read responses, insights)"
echo "   30) Calendly (scheduling — event types, meetings, invitees)"
echo "   31) Mailchimp (email marketing — audiences, members, campaigns)"
echo "   32) ActiveCampaign (CRM & automation — contacts, deals, automations)"
echo "   33) Twilio (SMS & voice — send messages, calls, phone numbers)"
echo "   34) Brevo (email marketing — transactional email, contacts, campaigns)"
echo "   35) SendGrid (email — transactional, marketing contacts, templates, stats)"
echo "   36) Klaviyo (email/SMS marketing — profiles, lists, campaigns, flows, events)"
echo "   37) Zoho CRM (contacts, leads, deals, notes, activities)"
echo "   38) Mailgun (transactional email, events, suppressions, mailing lists)"
echo "   39) Postmark (transactional email, bounce management, templates, streams)"
echo "   40) Microsoft Outlook (email + calendar via Graph API — same Azure app as Teams)"
echo "   41) Microsoft OneDrive (files, folders, SharePoint via Graph API — same Azure app)"
echo "   42) Google Drive (files, folders, upload, share via service account)"
echo "   43) Confluence (pages, spaces, comments — same Atlassian API token as Jira)"
echo "   44) Dropbox (list, read, upload, move, copy, share files via access token)"
echo "   45) Freshsales (CRM — contacts, accounts, deals, notes, tasks, search)"
echo "   46) BambooHR (HR — employee directory, time off, org chart, custom reports)"
echo "   47) Personio (HR — employees, absences, attendance, departments)"
echo "   48) Podio (project management — items, tasks, comments, search)"
echo "   49) Toggl Track (time tracking — entries, projects, clients, reports)"
echo "   50) Google Calendar (events, calendars, free/busy slots)"
echo "   51) Xero (accounting — invoices, contacts, accounts, balance sheet, payments)"
echo "   52) Visma eAccounting (invoices, customers, articles, account balances, vouchers)"
echo "   53) QuickBooks Online (invoices, customers, accounts, P&L report, vendors, bills)"
echo "   54) FreshBooks (invoices, clients, expenses, payments, time entries)"
echo "   55) Sage Business Cloud (invoices, contacts, purchases, ledger accounts, payments)"
echo "   56) SuperOffice CRM (contacts, persons, sales, appointments, projects)"
echo "   57) Planday (workforce management — employees, shifts, departments, punch clock, leave)"
echo "   58) Pleo (expense management — expenses, cards, users, teams, tags, accounting entries)"
echo "   59) Clockify (time tracking — workspaces, projects, clients, users, tags, time entries, reports)"
echo "   60) HiBob (HR — employees, time-off, departments, tasks, who's out, documents)"
echo "   61) Tripletex (Norwegian ERP — invoices, customers, suppliers, projects, timesheet, ledger)"
echo "   62) Recruitee (ATS — job offers, candidates, pipelines, team members, tags)"
echo "   63) Teamtailor (ATS — jobs, candidates, applications, stages, departments, locations)"
echo "   64) Workable (ATS — jobs, candidates, members, stages, departments, locations, requisitions)"
echo "   65) Custom plugin (scaffold a new plugin with new-plugin.sh)"
echo ""
ask "Which plugins to add? (comma-separated numbers, e.g. 1,6 — or 'all' or 'none'):"
read -r PLUGIN_SELECTION

SELECTED_NUMS=()
if [[ "$PLUGIN_SELECTION" == "all" ]]; then
  SELECTED_NUMS=(1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 43 44 45 46 47 48 49 50 51 52 53 54 55 56 57 58 59 60 61 62 63 64)  # 65 (custom) excluded from 'all'
elif [[ "$PLUGIN_SELECTION" != "none" && -n "$PLUGIN_SELECTION" ]]; then
  IFS=',' read -ra SELECTED_NUMS <<< "$PLUGIN_SELECTION"
fi

if [[ ${#SELECTED_NUMS[@]} -eq 0 ]]; then
  info "Nothing selected — exiting."
  exit 0
fi

# ── provision plugins ─────────────────────────────────────────────────────────

section "Provisioning plugins"

PROVISIONED=()

for num in "${SELECTED_NUMS[@]}"; do
  num="${num// /}"
  dir=$(plugin_dir "$num")
  [[ -z "$dir" ]] && { warn "Unknown plugin number: $num (skipping)"; continue; }

  # ── custom plugin scaffold sub-flow ────────────────────────────────────────
  if [[ "$dir" == "__custom__" ]]; then  # slot 62
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
      PROVISIONED+=("plugin-$custom_name")
    else
      warn "plugin-$custom_name provisioning failed. Check output above."
    fi

    for vn in "${custom_env_vars[@]+"${custom_env_vars[@]}"}"; do unset "$vn"; done
    continue
  fi

  plugin_name=$(basename "$dir")
  env_var_names=()
  while IFS= read -r line; do
    [[ -n "$line" ]] && env_var_names+=("$line")
  done < <(plugin_env_vars "$num")

  echo ""
  echo -e "  ${CYAN}Plugin: $plugin_name${NC}"
  if [[ ${#env_var_names[@]} -gt 0 ]]; then
    echo "  Required credentials: ${env_var_names[*]}"
  fi
  echo ""
  ask "  Provide credentials now? (y/N):"
  read -r do_provision

  if [[ ! "$do_provision" =~ ^[Yy]$ ]]; then
    info "Skipping $plugin_name. Provision later with:"
    echo "      PC_PASSWORD=<pw> \\"
    for vn in "${env_var_names[@]+"${env_var_names[@]}"}"; do
      echo "        ${vn}=<value> \\"
    done
    echo "        ./scripts/provision-plugin.sh $CUSTOMER $dir"
    continue
  fi

  for vn in "${env_var_names[@]+"${env_var_names[@]}"}"; do
    if [[ "$vn" == "SERVICEACCOUNTJSONREF" ]]; then
      ask "    $vn — path to service-account-key.json file:"
      read -r json_path
      json_path="${json_path/#\~/$HOME}"
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
  if PC_PASSWORD="$PC_PASSWORD" "$SCRIPT_DIR/provision-plugin.sh" "$CUSTOMER" "$REPO_ROOT/$dir"; then
    ok "$plugin_name provisioned"
    PROVISIONED+=("$plugin_name")
  else
    warn "$plugin_name provisioning failed. Check output above."
  fi

  for vn in "${env_var_names[@]+"${env_var_names[@]}"}"; do unset "$vn"; done
done

# ── re-wire MCP proxy if plugins were added ───────────────────────────────────

if [[ ${#PROVISIONED[@]} -gt 0 ]]; then
  echo ""
  echo "  Provisioned: ${PROVISIONED[*]}"
  echo ""
  section "MCP proxy refresh"
  echo "  The MCP proxy auto-refreshes tools on each agent call — no restart needed."
  echo "  If you want to force a full re-wire (e.g. after changing agent config):"
  echo ""
  echo "    PC_PASSWORD=<pw> ./scripts/wire-mcp-to-customer.sh $CUSTOMER"
  echo ""
  ok "Done. New plugin tools are now available to agents."
else
  echo ""
  info "No plugins provisioned."
fi
