#!/usr/bin/env bash
# post-upgrade.sh — upgrade Paperclip and redeploy all plugins
#
# Upgrades Paperclip on the bare-metal server (git pull + pnpm build + systemctl restart),
# then redeploys all provisioned plugins and smoke-tests them.
#
# No patches to reapply — patches live in the source fork and survive upgrades automatically.
#
# Usage:
#   PC_PASSWORD=<pw> ./scripts/post-upgrade.sh <customer-slug>

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

[[ -n "${PC_PASSWORD:-}" ]] || { echo "❌ PC_PASSWORD not set (pass via env or customers/$CUSTOMER.secrets)" >&2; exit 1; }

SSH_HOST="${SSH_HOST:?SSH_HOST not set}"
PC_HOST="${PC_HOST:?PC_HOST not set}"
PAPERCLIP_DIR="${PAPERCLIP_DIR:-/opt/paperclip}"
CUSTOMER_DIR="$REPO_ROOT/customers/$CUSTOMER"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "  ${CYAN}→${NC} $*"; }
ok()      { echo -e "  ${GREEN}✅${NC} $*"; }
warn()    { echo -e "  ${YELLOW}⚠️ ${NC} $*"; }
die()     { echo -e "\n  ${RED}❌ $*${NC}" >&2; exit 1; }
section() { echo -e "\n${CYAN}── $* ──${NC}"; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Paperclip Post-Upgrade                 ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "  Customer: $CUSTOMER"
echo "  SSH host: $SSH_HOST"
echo "  Paperclip dir: $PAPERCLIP_DIR"

# ── step 1: pull latest Paperclip source ─────────────────────────────────────

section "Step 1: Pull latest Paperclip"

info "git pull in $PAPERCLIP_DIR..."
ssh "$SSH_HOST" "cd $PAPERCLIP_DIR && git pull --ff-only" \
  || die "git pull failed. If there are local changes: ssh $SSH_HOST 'cd $PAPERCLIP_DIR && git status'"
ok "Source updated"

# ── step 2: rebuild ───────────────────────────────────────────────────────────

section "Step 2: Rebuild Paperclip"

info "pnpm install (may be a no-op if lockfile unchanged)..."
ssh "$SSH_HOST" "cd $PAPERCLIP_DIR && pnpm install 2>&1 | tail -3"

info "pnpm build..."
ssh "$SSH_HOST" "cd $PAPERCLIP_DIR && pnpm build 2>&1 | tail -5" \
  || die "pnpm build failed. Check: ssh $SSH_HOST 'cd $PAPERCLIP_DIR && pnpm build'"
ok "Build complete"

# ── step 3: restart paperclip ─────────────────────────────────────────────────

section "Step 3: Restart Paperclip"

info "systemctl restart paperclip..."
ssh "$SSH_HOST" "sudo systemctl restart paperclip"
ok "Restart command sent"

# ── step 4: wait for health ───────────────────────────────────────────────────

section "Step 4: Wait for Paperclip to come back up"

info "Polling $PC_HOST/api/health (up to 60s)..."
ATTEMPTS=0
MAX_ATTEMPTS=20
until ssh "$SSH_HOST" "curl -sf '$PC_HOST/api/health' > /dev/null 2>&1" || [[ $ATTEMPTS -ge $MAX_ATTEMPTS ]]; do
  ATTEMPTS=$((ATTEMPTS + 1))
  echo -n "."
  sleep 3
done
echo ""

if [[ $ATTEMPTS -ge $MAX_ATTEMPTS ]]; then
  die "Paperclip did not come up within 60s. Logs: ssh $SSH_HOST 'journalctl -u paperclip --no-pager -n 50'"
fi
ok "Paperclip is up"

# ── step 5: redeploy all provisioned plugins ──────────────────────────────────

section "Step 5: Redeploy all provisioned plugins"

CUSTOMER_CONFIGS=("$CUSTOMER_DIR"/plugin-*.json)
if [[ ${#CUSTOMER_CONFIGS[@]} -eq 0 ]] || [[ ! -f "${CUSTOMER_CONFIGS[0]}" ]]; then
  warn "No customer plugin configs found in $CUSTOMER_DIR — skipping"
else
  DEPLOY_PASS=0
  DEPLOY_FAIL=0
  for config_file in "$CUSTOMER_DIR"/plugin-*.json; do
    plugin_slug=$(basename "$config_file" .json)
    plugin_dir="$REPO_ROOT/packages/$plugin_slug"

    if [[ ! -d "$plugin_dir" ]]; then
      warn "Plugin dir not found: $plugin_dir (skipping)"
      continue
    fi

    info "Redeploying $plugin_slug..."
    deploy_out=$(PC_PASSWORD="$PC_PASSWORD" PC_CUSTOMER_CONFIG="$config_file" \
      "$SCRIPT_DIR/deploy-plugin.sh" "$plugin_dir" 2>&1) && deploy_ok=1 || deploy_ok=0
    echo "$deploy_out" | grep -E '(✅|❌|→|Error|error)' || true
    if [[ "$deploy_ok" -eq 1 ]]; then
      ok "$plugin_slug redeployed"
      DEPLOY_PASS=$((DEPLOY_PASS + 1))
    else
      warn "$plugin_slug deployment failed"
      echo "$deploy_out" | tail -5
      DEPLOY_FAIL=$((DEPLOY_FAIL + 1))
    fi
  done
  info "Plugin redeployment: $DEPLOY_PASS succeeded, $DEPLOY_FAIL failed"
fi

# ── step 6: rewire MCP proxy ──────────────────────────────────────────────────

section "Step 6: Rewire MCP proxy"

if PC_PASSWORD="$PC_PASSWORD" "$SCRIPT_DIR/wire-mcp-to-customer.sh" "$CUSTOMER"; then
  ok "MCP proxy rewired"
else
  warn "MCP proxy wiring failed — retry with: PC_PASSWORD=<pw> ./scripts/wire-mcp-to-customer.sh $CUSTOMER"
fi

# ── step 7: smoke test ────────────────────────────────────────────────────────

section "Step 7: Smoke tests"

if ! "$SCRIPT_DIR/smoke-test-plugins.sh" "$CUSTOMER"; then
  warn "Some smoke tests failed — see above"
  exit 1
fi

# ── done ─────────────────────────────────────────────────────────────────────

section "Done"

echo ""
echo "  Post-upgrade complete for customer '$CUSTOMER'."
echo "  Logs: ssh $SSH_HOST 'journalctl -u paperclip -f'"
echo ""
