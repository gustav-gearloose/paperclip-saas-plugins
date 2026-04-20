#!/usr/bin/env bash
# post-upgrade.sh — full recovery sequence after a Paperclip container image rebuild
#
# Run this whenever Paperclip is upgraded (new Docker image pulled and container recreated).
# It will:
#   1. Apply compiled JS patches (plugin-tool-dispatcher + plugin-loader fixes)
#   2. Restart the container to pick up the patches
#   3. Wait for Paperclip to be healthy
#   4. Redeploy all plugins that have a customer config in customers/<slug>/
#   5. Run smoke tests to confirm tools are callable
#
# Usage:
#   ./scripts/post-upgrade.sh <customer-slug>
#   ./scripts/post-upgrade.sh gearloose
#
# PC_PASSWORD must be set in env or customers/<slug>.secrets.

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
CONTAINER="${CONTAINER:-paperclipai-docker-server-1}"
DOCKER="DOCKER_HOST=unix:///var/run/docker.sock docker"
CUSTOMER_DIR="$REPO_ROOT/customers/$CUSTOMER"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "  ${CYAN}→${NC} $*"; }
ok()      { echo -e "  ${GREEN}✅${NC} $*"; }
warn()    { echo -e "  ${YELLOW}⚠️ ${NC} $*"; }
die()     { echo -e "\n  ${RED}❌ $*${NC}" >&2; exit 1; }
section() { echo -e "\n${CYAN}── $* ──${NC}"; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Paperclip Post-Upgrade Recovery        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "  Customer: $CUSTOMER"
echo "  SSH host: $SSH_HOST"
echo "  Container: $CONTAINER"

# ── step 1: apply compiled JS patches ────────────────────────────────────────

section "Step 1: Apply compiled JS patches"

"$SCRIPT_DIR/patch-paperclip-container.sh" "$CUSTOMER"

# ── step 2: restart container ─────────────────────────────────────────────────

section "Step 2: Restart container"

info "Restarting $CONTAINER..."
ssh "$SSH_HOST" "$DOCKER restart $CONTAINER" > /dev/null
ok "Restart command sent"

# ── step 3: wait for Paperclip to be healthy ─────────────────────────────────

section "Step 3: Waiting for Paperclip to come back up"

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
  die "Paperclip did not come up within 60s. Check container logs: ssh $SSH_HOST \"$DOCKER logs $CONTAINER --tail 50\""
fi
ok "Paperclip is up"

# ── step 4: redeploy all provisioned plugins ──────────────────────────────────

section "Step 4: Redeploy all provisioned plugins"

CUSTOMER_CONFIGS=("$CUSTOMER_DIR"/plugin-*.json)
if [[ ${#CUSTOMER_CONFIGS[@]} -eq 0 ]] || [[ ! -f "${CUSTOMER_CONFIGS[0]}" ]]; then
  warn "No customer plugin configs found in $CUSTOMER_DIR — skipping plugin redeployment"
  warn "Provision plugins first with: PC_PASSWORD=<pw> ./scripts/provision-plugin.sh $CUSTOMER packages/plugin-<name>"
else
  DEPLOY_PASS=0
  DEPLOY_FAIL=0
  for config_file in "$CUSTOMER_DIR"/plugin-*.json; do
    plugin_slug=$(basename "$config_file" .json)          # e.g. plugin-dinero
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
      warn "$plugin_slug deployment failed — check output above"
      echo "$deploy_out" | tail -5
      DEPLOY_FAIL=$((DEPLOY_FAIL + 1))
    fi
  done

  echo ""
  info "Plugin redeployment: $DEPLOY_PASS succeeded, $DEPLOY_FAIL failed"
fi

# ── step 5: smoke test ────────────────────────────────────────────────────────

section "Step 5: Smoke tests"

if ! "$SCRIPT_DIR/smoke-test-plugins.sh" "$CUSTOMER"; then
  warn "Some smoke tests failed — see above"
  echo ""
  echo "  Debug steps:"
  echo "    ssh $SSH_HOST \"$DOCKER logs $CONTAINER --tail 100 2>&1 | grep -i 'plugin\\|tool\\|error'\""
  echo "    ./scripts/patch-paperclip-container.sh $CUSTOMER  # verify patches still applied"
  exit 1
fi

# ── done ─────────────────────────────────────────────────────────────────────

section "Done"

echo ""
echo "  Post-upgrade recovery complete for customer '$CUSTOMER'."
echo ""
echo "  Next: watch agents use tools:"
echo "  ssh $SSH_HOST \"$DOCKER logs $CONTAINER -f 2>&1 | grep -i 'mcp\\|tool\\|plugin'\""
echo ""
