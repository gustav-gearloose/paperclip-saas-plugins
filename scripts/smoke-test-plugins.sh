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
  ssh "$SSH_HOST" "curl -s -b /tmp/pc_smoke_cookies.txt \
    -H 'Origin: $PC_ORIGIN' $*"
}

pc_post_json() {
  local url="$1"
  local body="$2"
  local b64
  b64=$(printf '%s' "$body" | base64)
  ssh "$SSH_HOST" "echo $b64 | base64 -d | curl -s -b /tmp/pc_smoke_cookies.txt \
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

AGENT_ID=$(pc "'$PC_HOST/api/agents'" \
  | python3 -c "
import sys, json
agents = json.load(sys.stdin)
# pick cfo or first agent
for a in agents:
    if a.get('name','').lower() in ('cfo','assistant','agent'):
        print(a['id']); sys.exit(0)
if agents: print(agents[0]['id'])
" 2>/dev/null || true)

RUN_CONTEXT="{\"agentId\":\"${AGENT_ID:-}\",\"runId\":\"smoke-test\",\"companyId\":\"$PC_COMPANY_ID\"}"

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
  "dinero|dinero_list_contacts|{}"
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

  # 2. Tool smoke test — find matching tool
  TOOL_NAME=""
  TOOL_PARAMS="{}"
  for entry in "${SMOKE_TOOLS[@]}"; do
    pattern="${entry%%|*}"
    rest="${entry#*|}"
    tname="${rest%%|*}"
    tparams="${rest#*|}"
    if echo "$plugin_key" | grep -qi "$pattern"; then
      # Execute API: "pluginKey:toolName" e.g. "gearloose.dinero:dinero_list_contacts"
      TOOL_NAME="${plugin_key}:${tname}"
      TOOL_PARAMS="$tparams"
      break
    fi
  done

  if [[ -z "$TOOL_NAME" ]]; then
    info "No smoke tool configured for plugin key: $plugin_key (skipping tool test)"
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
