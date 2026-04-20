#!/usr/bin/env bash
# status.sh — quick health dashboard for a Paperclip customer instance
#
# Usage:
#   ./scripts/status.sh [customer-slug]
#   ./scripts/status.sh              # shows all customers
#   ./scripts/status.sh gearloose
#
# Reads customers/<slug>.env (and .secrets if present).
# Checks (without executing any plugin tools):
#   - Container running
#   - Paperclip /api/health
#   - Installed plugins and their status
#   - Agent adapterConfig (MCP proxy wired?)
#   - /api/plugins/tools count (requires container patches)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✅${NC} $*"; }
warn() { echo -e "  ${YELLOW}⚠️ ${NC} $*"; }
fail() { echo -e "  ${RED}❌${NC} $*"; }
info() { echo -e "  ${CYAN}→${NC} $*"; }

check_customer() {
  local CUSTOMER="$1"
  local ENV_FILE="$REPO_ROOT/customers/$CUSTOMER.env"
  local SECRETS_FILE="$REPO_ROOT/customers/$CUSTOMER.secrets"

  echo ""
  echo -e "${CYAN}════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  Customer: $CUSTOMER${NC}"
  echo -e "${CYAN}════════════════════════════════════════════${NC}"

  [[ -f "$ENV_FILE" ]] || { fail "No env file: $ENV_FILE"; return; }

  set -a
  source "$ENV_FILE"
  [[ -f "$SECRETS_FILE" ]] && source "$SECRETS_FILE"
  set +a

  local PC_HOST="${PC_HOST:-}"
  local PC_ORIGIN="${PC_ORIGIN:-$PC_HOST}"
  local PC_EMAIL="${PC_EMAIL:-}"
  local PC_PASSWORD="${PC_PASSWORD:-}"
  local SSH_HOST="${SSH_HOST:-}"
  local CONTAINER="${CONTAINER:-paperclipai-docker-server-1}"
  local DOCKER="DOCKER_HOST=unix:///var/run/docker.sock docker"

  echo "  SSH:       $SSH_HOST"
  echo "  Host:      $PC_HOST"
  echo "  Origin:    $PC_ORIGIN"
  echo "  Container: $CONTAINER"
  echo ""

  # ── SSH reachable? ────────────────────────────────────────────────────────

  if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "$SSH_HOST" "echo ok" 2>/dev/null | grep -q ok; then
    fail "SSH unreachable: $SSH_HOST"
    return
  fi
  ok "SSH reachable"

  # ── Container running? ────────────────────────────────────────────────────

  CONTAINER_STATUS=$(ssh "$SSH_HOST" "$DOCKER inspect $CONTAINER --format '{{.State.Status}}' 2>/dev/null || echo 'not_found'")
  if [[ "$CONTAINER_STATUS" == "running" ]]; then
    ok "Container $CONTAINER: running"
  else
    fail "Container $CONTAINER: $CONTAINER_STATUS"
    return
  fi

  # ── Paperclip health ──────────────────────────────────────────────────────

  HEALTH=$(ssh "$SSH_HOST" "curl -sf '$PC_HOST/api/health' 2>/dev/null || echo 'fail'")
  if [[ "$HEALTH" != "fail" ]] && echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('status')=='ok' or d.get('healthy') else 1)" 2>/dev/null; then
    ok "Paperclip healthy"
  elif [[ "$HEALTH" != "fail" ]]; then
    warn "Paperclip responded but status unclear: $HEALTH"
  else
    fail "Paperclip /api/health unreachable"
    return
  fi

  # ── Authenticate ──────────────────────────────────────────────────────────

  if [[ -z "$PC_PASSWORD" ]]; then
    warn "PC_PASSWORD not set — skipping API checks (add to customers/$CUSTOMER.secrets)"
    return
  fi

  _AUTH_B64=$(python3 -c "import json,base64,sys; print(base64.b64encode(json.dumps({'email':sys.argv[1],'password':sys.argv[2]}).encode()).decode())" "$PC_EMAIL" "$PC_PASSWORD")
  AUTH_RESP=$(ssh "$SSH_HOST" "echo $_AUTH_B64 | base64 -d | curl -s -X POST '$PC_HOST/api/auth/sign-in/email' \
    -H 'Content-Type: application/json' \
    -H 'Origin: $PC_ORIGIN' \
    -c /tmp/pc_status_cookies_${CUSTOMER}.txt \
    --data-binary @-" 2>/dev/null || echo '{}')

  if echo "$AUTH_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('user') or d.get('token') or d.get('session') else 1)" 2>/dev/null \
     || ssh "$SSH_HOST" "test -f /tmp/pc_status_cookies_${CUSTOMER}.txt && grep -q session_token /tmp/pc_status_cookies_${CUSTOMER}.txt" 2>/dev/null; then
    ok "Authentication OK"
  else
    warn "Authentication failed — check PC_EMAIL/PC_PASSWORD"
    return
  fi

  # ── Installed plugins ─────────────────────────────────────────────────────

  PLUGINS_JSON=$(ssh "$SSH_HOST" "curl -s '$PC_HOST/api/plugins' \
    -b /tmp/pc_status_cookies_${CUSTOMER}.txt \
    -H 'Origin: $PC_ORIGIN'" 2>/dev/null || echo '[]')

  PLUGIN_COUNT=$(echo "$PLUGINS_JSON" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
  TOOL_COUNT_API=$(ssh "$SSH_HOST" "curl -s '$PC_HOST/api/plugins/tools' \
    -b /tmp/pc_status_cookies_${CUSTOMER}.txt \
    -H 'Origin: $PC_ORIGIN'" 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else 0)" 2>/dev/null || echo "?")

  echo ""
  echo "  Plugins: $PLUGIN_COUNT installed, $TOOL_COUNT_API tools visible via /api/plugins/tools"

  if [[ "$TOOL_COUNT_API" == "0" ]] || [[ "$TOOL_COUNT_API" == "?" ]]; then
    warn "0 tools from /api/plugins/tools — container patches may not be applied"
    info "Fix: ./scripts/patch-paperclip-container.sh $CUSTOMER"
  fi

  echo "$PLUGINS_JSON" | python3 -c "
import sys, json
plugins = json.load(sys.stdin)
for p in plugins:
    name = p.get('displayName') or p.get('name') or p.get('id','?')
    status = p.get('status', '?')
    err = p.get('lastError') or ''
    icon = '✅' if status == 'ready' else '⚠️ ' if status in ('installing','loading') else '❌'
    line = f'    {icon} {name} ({status})'
    if err: line += f' — {err[:80]}'
    print(line)
" 2>/dev/null || true

  # ── Agent MCP wiring ──────────────────────────────────────────────────────

  echo ""
  AGENTS_JSON=$(ssh "$SSH_HOST" "curl -s '$PC_HOST/api/agents' \
    -b /tmp/pc_status_cookies_${CUSTOMER}.txt \
    -H 'Origin: $PC_ORIGIN'" 2>/dev/null || echo '[]')

  echo "$AGENTS_JSON" | python3 -c "
import sys, json
agents = json.load(sys.stdin)
if not agents:
    print('  ⚠️  No agents found')
    sys.exit(0)
for a in agents:
    name = a.get('name') or a.get('id','?')
    extra = a.get('adapterConfig', {}).get('extraArgs', [])
    has_mcp = any('mcp' in str(x).lower() or 'settings' in str(x).lower() for x in extra)
    icon = '✅' if has_mcp else '❌'
    status = 'MCP wired' if has_mcp else 'MCP NOT wired'
    print(f'  {icon} Agent: {name} — {status}')
    if has_mcp:
        print(f'       extraArgs: {extra}')
" 2>/dev/null || true

  # ── Provisioned plugin configs ─────────────────────────────────────────────

  CUSTOMER_DIR="$REPO_ROOT/customers/$CUSTOMER"
  if [[ -d "$CUSTOMER_DIR" ]]; then
    config_count=$(ls "$CUSTOMER_DIR"/plugin-*.json 2>/dev/null | wc -l | tr -d ' ')
    echo ""
    echo "  Local plugin configs in customers/$CUSTOMER/: $config_count"
    for f in "$CUSTOMER_DIR"/plugin-*.json; do
      [[ -f "$f" ]] || continue
      echo "    • $(basename "$f")"
    done
  fi

  echo ""
}

# ── main ─────────────────────────────────────────────────────────────────────

if [[ $# -gt 0 ]]; then
  check_customer "$1"
else
  # Show all customers
  found=0
  for env_file in "$REPO_ROOT/customers"/*.env; do
    [[ -f "$env_file" ]] || continue
    slug=$(basename "$env_file" .env)
    [[ "$slug" == "example-customer" ]] && continue
    check_customer "$slug"
    found=$((found + 1))
  done
  if [[ $found -eq 0 ]]; then
    echo "No customers found in customers/*.env (excluding example-customer.env)"
    echo "Run: ./scripts/onboard-customer.sh <customer-slug>"
  fi
fi

echo ""
