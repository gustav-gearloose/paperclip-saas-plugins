#!/usr/bin/env bash
# smoke-test-plugins.sh — verify all installed plugins are healthy and tools are callable
#
# Usage:
#   ./scripts/smoke-test-plugins.sh <customer-slug>
#
# Reads customers/<slug>.env (and .secrets if present).
# For each installed plugin:
#   1. Checks health endpoint → must return healthy:true
#   2. Calls one lightweight tool → must return no error field
#
# Exit code: 0 if all pass, 1 if any fail.

set -euo pipefail

CUSTOMER="${1:?Usage: $0 <customer-slug>}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV_FILE="$REPO_ROOT/customers/$CUSTOMER.env"
SECRETS_FILE="$REPO_ROOT/customers/$CUSTOMER.secrets"

[[ -f "$ENV_FILE" ]] || { echo "❌ No customer config at $ENV_FILE" >&2; exit 1; }

set -a
source "$ENV_FILE"
[[ -f "$SECRETS_FILE" ]] && source "$SECRETS_FILE"
set +a

PC_HOST="${PC_HOST:?PC_HOST not set in $ENV_FILE}"
PC_ORIGIN="${PC_ORIGIN:-$PC_HOST}"
PC_EMAIL="${PC_EMAIL:?PC_EMAIL not set}"
PC_PASSWORD="${PC_PASSWORD:?PC_PASSWORD not set}"
PC_COMPANY_ID="${PC_COMPANY_ID:?PC_COMPANY_ID not set}"
SSH_HOST="${SSH_HOST:?SSH_HOST not set}"

PASS=0
FAIL=0
ERRORS=()

info()  { echo "  $*"; }
ok()    { echo "  ✅ $*"; PASS=$((PASS+1)); }
fail()  { echo "  ❌ $*"; FAIL=$((FAIL+1)); ERRORS+=("$*"); }

# Run curl on remote host with session cookie
pc() {
  ssh -n "$SSH_HOST" "curl -s -b /tmp/pc_smoke_cookies.txt \
    -H 'Origin: $PC_ORIGIN' $*"
}

pc_post_json() {
  local url="$1"
  local body="$2"
  local b64
  b64=$(printf '%s' "$body" | base64)
  ssh -n "$SSH_HOST" "echo $b64 | base64 -d | curl -s -b /tmp/pc_smoke_cookies.txt \
    -X POST '$PC_HOST$url' \
    -H 'Content-Type: application/json' \
    -H 'Origin: $PC_ORIGIN' \
    --data-binary @-"
}

echo "Smoke-testing Paperclip plugins for customer: $CUSTOMER"
echo "Host: $PC_HOST via $SSH_HOST"
echo ""

# ── authenticate ──────────────────────────────────────────────────────────────

echo "Authenticating..."
AUTH_B64=$(python3 -c "import json,base64,sys; print(base64.b64encode(json.dumps({'email':sys.argv[1],'password':sys.argv[2]}).encode()).decode())" "$PC_EMAIL" "$PC_PASSWORD")
ssh "$SSH_HOST" "echo $AUTH_B64 | base64 -d | curl -s -X POST '$PC_HOST/api/auth/sign-in/email' \
  -H 'Content-Type: application/json' \
  -H 'Origin: $PC_ORIGIN' \
  -c /tmp/pc_smoke_cookies.txt \
  --data-binary @- > /dev/null"
echo ""

# ── get agent ID (for tool execute context) ───────────────────────────────────

AGENT_ID=$(pc "'$PC_HOST/api/companies/$PC_COMPANY_ID/agents'" \
  | python3 -c "
import sys, json
agents = json.load(sys.stdin)
if not isinstance(agents, list): sys.exit(0)
for a in agents:
    if a.get('name','').lower() in ('cfo','assistant','agent'):
        print(a['id']); sys.exit(0)
if agents: print(agents[0]['id'])
" 2>/dev/null || true)

PROJECT_ID=$(pc "'$PC_HOST/api/companies/$PC_COMPANY_ID/projects'" \
  | python3 -c "
import sys, json
try:
    projects = json.load(sys.stdin)
    if isinstance(projects, list) and projects: print(projects[0]['id'])
except: pass
" 2>/dev/null || true)

RUN_CONTEXT="{\"agentId\":\"${AGENT_ID:-}\",\"runId\":\"smoke-test\",\"companyId\":\"$PC_COMPANY_ID\",\"projectId\":\"${PROJECT_ID:-}\"}"

# ── get available tool names (only custom plugins expose tools here) ───────────

AVAILABLE_TOOLS=$(pc "'$PC_HOST/api/plugins/tools'" | python3 -c "
import sys, json
try:
    tools = json.load(sys.stdin)
    for t in tools: print(t.get('name',''))
except: pass
" 2>/dev/null || true)

# ── get installed plugins ─────────────────────────────────────────────────────

PLUGINS=$(pc "'$PC_HOST/api/plugins'" | python3 -c "
import sys, json
plugins = json.load(sys.stdin)
for p in plugins:
    print(p['id'] + '\t' + p.get('displayName', p.get('name', '?')) + '\t' + p.get('status','?') + '\t' + (p.get('pluginKey') or p.get('id','')))
" 2>/dev/null)

if [[ -z "$PLUGINS" ]]; then
  echo "❌ No plugins found or auth failed"
  exit 1
fi

# ── per-plugin smoke test ─────────────────────────────────────────────────────

# Map: plugin key substring → lightweight tool name + minimal params
SMOKE_TOOLS=(
  "dinero|dinero_get_balance|{}"
  "billy|billy_list_contacts|{}"
  "economic|economic_list_accounts|{}"
  "zendesk|zendesk_list_tickets|{\"page_size\":1}"
  "hubspot|hubspot_search_contacts|{\"limit\":1}"
  "slack|slack_list_channels|{}"
  "notion|notion_search|{\"query\":\"\"}"
  "linear|linear_list_teams|{}"
  "email|email_list_folders|{}"
  "teams|teams_list_teams|{}"
  "fortnox|fortnox_list_customers|{}"
  "pipedrive|pipedrive_list_pipelines|{}"
  "intercom|intercom_list_admins|{}"
  "jira|jira_list_projects|{}"
  "github|github_list_repos|{}"
  "freshdesk|freshdesk_list_agents|{}"
  "stripe|stripe_list_products|{}"
  "woocommerce|woocommerce_list_orders|{\"per_page\":1}"
  "shopify|shopify_get_shop|{}"
  "monday|monday_list_workspaces|{}"
  "asana|asana_list_workspaces|{}"
  "salesforce|salesforce_list_contacts|{}"
  "trello|trello_list_boards|{}"
  "clickup|clickup_list_workspaces|{}"
  "todoist|todoist_list_projects|{}"
  "airtable|airtable_list_bases|{}"
  "harvest|harvest_get_me|{}"
  "typeform|typeform_list_forms|{}"
  "calendly|calendly_get_current_user|{}"
  "mailchimp|mailchimp_get_account_info|{}"
  "activecampaign|activecampaign_list_contacts|{}"
  "twilio|twilio_get_account_info|{}"
  "brevo|brevo_get_account_info|{}"
  "sendgrid|sendgrid_list_lists|{}"
  "klaviyo|klaviyo_list_lists|{}"
  "zoho-crm|zoho_crm_list_users|{}"
  "mailgun|mailgun_list_domains|{}"
  "postmark|postmark_get_server|{}"
  "outlook|outlook_list_folders|{}"
  "onedrive|onedrive_list_items|{}"
  "google-drive|drive_list_files|{}"
  "confluence|confluence_list_spaces|{}"
  "dropbox|dropbox_list_folder|{}"
  "freshsales|freshsales_list_contacts|{}"
  "bamboohr|bamboohr_get_directory|{}"
  "personio|personio_list_employees|{}"
  "podio|podio_get_tasks|{}"
  "toggl|toggl_get_workspaces|{}"
  "google-calendar|calendar_list_calendars|{}"
  "xero|xero_list_accounts|{}"
  "visma|visma_list_fiscal_years|{}"
  "quickbooks|quickbooks_list_accounts|{}"
  "freshbooks|freshbooks_list_clients|{}"
  "sage|sage_list_sales_invoices|{}"
  # google-sheets: all tools require a real spreadsheet_id; health check is sufficient
)

while IFS=$'\t' read -r plugin_id display_name status plugin_key; do
  echo "── $display_name ($plugin_id) ──"

  # 1. Health check
  health=$(pc "'$PC_HOST/api/plugins/$plugin_id/health'" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('healthy','?'), d.get('status','?'))" 2>/dev/null || echo "error ?")
  healthy=$(echo "$health" | awk '{print $1}')
  health_status=$(echo "$health" | awk '{print $2}')

  if [[ "$healthy" == "True" || "$healthy" == "true" ]]; then
    ok "Health: $health_status"
  else
    fail "Health check failed for $display_name: $health"
    echo ""
    continue
  fi

  # 2. Tool smoke test — find a tool for this plugin from available tools list or SMOKE_TOOLS map
  TOOL_NAME=""
  TOOL_PARAMS="{}"

  # Pick a tool from SMOKE_TOOLS map if it exists in AVAILABLE_TOOLS, else first available.
  # Only custom plugins expose tools via /api/plugins/tools — built-ins (Slack etc.) do not.
  TOOL_NAME=""
  TOOL_PARAMS="{}"
  for entry in "${SMOKE_TOOLS[@]}"; do
    pattern="${entry%%|*}"
    rest="${entry#*|}"
    tname="${rest%%|*}"
    tparams="${rest#*|}"
    if echo "$plugin_key" | grep -qi "$pattern"; then
      preferred="${plugin_key}:${tname}"
      if echo "$AVAILABLE_TOOLS" | grep -q "^${preferred}$"; then
        TOOL_NAME="$preferred"
        TOOL_PARAMS="$tparams"
        break
      fi
    fi
  done
  # Fallback: use first available tool for this plugin (with no params)
  if [[ -z "$TOOL_NAME" ]]; then
    TOOL_NAME=$(echo "$AVAILABLE_TOOLS" | grep "^${plugin_key}:" | head -1 || true)
  fi

  if [[ -z "$TOOL_NAME" ]]; then
    info "No custom tools exposed for plugin key: $plugin_key (skipping tool test)"
  else
    EXEC_BODY="{\"tool\":\"$TOOL_NAME\",\"parameters\":$TOOL_PARAMS,\"runContext\":$RUN_CONTEXT}"
    exec_result=$(pc_post_json "/api/plugins/tools/execute" "$EXEC_BODY" \
      2>/dev/null || echo '{"error":"curl failed"}')

    has_error=$(echo "$exec_result" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    r=d.get('result',d)
    err=r.get('error','')
    if err: print('ERROR:',err)
    else: print('OK')
except: print('PARSE_ERROR')
" 2>/dev/null || echo "PARSE_ERROR")

    if [[ "$has_error" == "OK" ]]; then
      ok "Tool execute: $TOOL_NAME"
    else
      fail "Tool execute failed ($TOOL_NAME): $has_error"
    fi
  fi

  echo ""
done <<< "$PLUGINS"

# ── summary ───────────────────────────────────────────────────────────────────

echo "════════════════════════════════"
echo "Results: $PASS passed, $FAIL failed"
if [[ ${#ERRORS[@]} -gt 0 ]]; then
  echo ""
  echo "Failures:"
  for e in "${ERRORS[@]}"; do
    echo "  • $e"
  done
  exit 1
fi
echo "All checks passed ✅"
