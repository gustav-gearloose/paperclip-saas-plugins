#!/usr/bin/env bash
# patch-paperclip-container.sh — reapply server-side patches to a Paperclip container
#
# MUST be re-run after every container image rebuild (Paperclip upgrade).
#
# Patches applied:
#   1. plugin-tool-dispatcher.js — pass pluginDbId as 3rd arg to registerPluginTools()
#   2. plugin-loader.js         — call registerPluginTools(pluginKey, manifest, pluginId)
#
# These fix a bug where plugin tools register successfully but tool execution always
# fails with "worker not running" because the workers Map is keyed by DB UUID but
# registerPluginTools was called with the plugin key (e.g. "gearloose.dinero").
#
# Usage:
#   ./scripts/patch-paperclip-container.sh <customer-slug>
#   ./scripts/patch-paperclip-container.sh gearloose

set -euo pipefail

CUSTOMER="${1:?Usage: $0 <customer-slug>}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV_FILE="$REPO_ROOT/customers/$CUSTOMER.env"
[[ -f "$ENV_FILE" ]] || { echo "❌ No customer config at $ENV_FILE" >&2; exit 1; }

set -a
source "$ENV_FILE"
set +a

SSH_HOST="${SSH_HOST:?SSH_HOST not set}"
CONTAINER="${CONTAINER:-paperclipai-docker-server-1}"
DOCKER="DOCKER_HOST=unix:///var/run/docker.sock docker"

info() { echo "→ $*"; }
ok()   { echo "  ✅ $*"; }
fail() { echo "  ❌ $*" >&2; exit 1; }

echo "Patching Paperclip container: $CONTAINER on $SSH_HOST"
echo ""

# ── verify container is running ──────────────────────────────────────────────

STATUS=$(ssh "$SSH_HOST" "$DOCKER inspect $CONTAINER --format '{{.State.Status}}'" 2>/dev/null || echo "not_found")
[[ "$STATUS" == "running" ]] || fail "Container $CONTAINER is not running (status: $STATUS)"
ok "Container is running"

# ── find actual line numbers in compiled JS ──────────────────────────────────

info "Locating registerPluginTools in plugin-tool-dispatcher.js..."
DISPATCHER_LINE=$(ssh "$SSH_HOST" "$DOCKER exec $CONTAINER grep -n 'registerPluginTools' \
  /app/server/dist/services/plugin-tool-dispatcher.js 2>/dev/null | head -5" || echo "")

if [[ -z "$DISPATCHER_LINE" ]]; then
  fail "Could not find registerPluginTools in plugin-tool-dispatcher.js — file may have moved in this Paperclip version"
fi
echo "  Found: $DISPATCHER_LINE"

info "Locating registerPluginTools call in plugin-loader.js..."
LOADER_LINE=$(ssh "$SSH_HOST" "$DOCKER exec $CONTAINER grep -n 'registerPluginTools' \
  /app/server/dist/services/plugin-loader.js 2>/dev/null | head -5" || echo "")

if [[ -z "$LOADER_LINE" ]]; then
  fail "Could not find registerPluginTools in plugin-loader.js"
fi
echo "  Found: $LOADER_LINE"

# ── check if patch already applied ──────────────────────────────────────────

DISPATCHER_ALREADY=$(ssh "$SSH_HOST" "$DOCKER exec $CONTAINER grep -c 'pluginDbId' \
  /app/server/dist/services/plugin-tool-dispatcher.js 2>/dev/null || echo 0")
LOADER_ALREADY=$(ssh "$SSH_HOST" "$DOCKER exec $CONTAINER grep -c 'pluginId.*pluginKey\|pluginKey.*pluginId\|registerPluginTools.*pluginId' \
  /app/server/dist/services/plugin-loader.js 2>/dev/null || echo 0")

if [[ "$DISPATCHER_ALREADY" -gt 0 ]] && [[ "$LOADER_ALREADY" -gt 0 ]]; then
  ok "Patches already applied — nothing to do"
  exit 0
fi

echo ""
info "Applying patches..."

# ── patch 1: plugin-tool-dispatcher.js ───────────────────────────────────────
#
# Find the registerPluginTools function and add pluginDbId as 3rd parameter.
# The function signature looks like:
#   registerPluginTools(pluginId, manifest) {
# We add pluginDbId and pass it through.

ssh "$SSH_HOST" "$DOCKER exec $CONTAINER bash -c '
  set -e
  FILE=/app/server/dist/services/plugin-tool-dispatcher.js

  # Check if already patched
  if grep -q \"pluginDbId\" \"\$FILE\"; then
    echo \"dispatcher: already patched\"
    exit 0
  fi

  # Backup
  cp \"\$FILE\" \"\${FILE}.bak-\$(date +%Y%m%d%H%M%S)\"

  # Patch: add pluginDbId parameter and pass it to registry.registerPlugin
  sed -i \"s/registerPluginTools(pluginId, manifest) {/registerPluginTools(pluginId, manifest, pluginDbId) {/\" \"\$FILE\"
  sed -i \"s/registerPluginTools(pluginId, manifest, \"/registerPluginTools(pluginId, manifest, pluginDbId, \"/\" \"\$FILE\" 2>/dev/null || true

  # Pass pluginDbId to registery call if it exists
  sed -i \"s/this\.registry\.registerPlugin(pluginId,/this.registry.registerPlugin(pluginDbId || pluginId,/\" \"\$FILE\" 2>/dev/null || true

  echo \"dispatcher: patched\"
  grep -n \"registerPluginTools\|registerPlugin\" \"\$FILE\" | head -10
'"

ok "plugin-tool-dispatcher.js patched"

# ── patch 2: plugin-loader.js ─────────────────────────────────────────────────
#
# Find the call site and add pluginId as 3rd argument.
# Call looks like:
#   toolDispatcher.registerPluginTools(pluginKey, manifest)

ssh "$SSH_HOST" "$DOCKER exec $CONTAINER bash -c '
  set -e
  FILE=/app/server/dist/services/plugin-loader.js

  # Check if already patched
  if grep -q \"registerPluginTools.*pluginKey.*manifest.*pluginId\|registerPluginTools(pluginKey, manifest, pluginId\" \"\$FILE\"; then
    echo \"loader: already patched\"
    exit 0
  fi

  # Backup
  cp \"\$FILE\" \"\${FILE}.bak-\$(date +%Y%m%d%H%M%S)\"

  # Add pluginId as 3rd arg
  sed -i \"s/toolDispatcher\.registerPluginTools(pluginKey, manifest)/toolDispatcher.registerPluginTools(pluginKey, manifest, pluginId)/\" \"\$FILE\"

  echo \"loader: patched\"
  grep -n \"registerPluginTools\" \"\$FILE\" | head -5
'"

ok "plugin-loader.js patched"

# ── verify ────────────────────────────────────────────────────────────────────

echo ""
info "Verifying patches..."
DISPATCHER_CHECK=$(ssh "$SSH_HOST" "$DOCKER exec $CONTAINER grep -c 'pluginDbId' \
  /app/server/dist/services/plugin-tool-dispatcher.js 2>/dev/null || echo 0")
LOADER_CHECK=$(ssh "$SSH_HOST" "$DOCKER exec $CONTAINER grep -c 'registerPluginTools.*pluginId' \
  /app/server/dist/services/plugin-loader.js 2>/dev/null || echo 0")

[[ "$DISPATCHER_CHECK" -gt 0 ]] || fail "Dispatcher patch verification failed"
[[ "$LOADER_CHECK" -gt 0 ]] || fail "Loader patch verification failed"

ok "Both patches verified"

echo ""
echo "✅ Container patched successfully"
echo ""
echo "   IMPORTANT: Restart Paperclip to pick up the patches:"
echo "   ssh $SSH_HOST \"$DOCKER restart $CONTAINER\""
echo ""
echo "   Then redeploy all plugins to re-register tools:"
echo "   PC_PASSWORD=<pw> ./scripts/deploy-for-customer.sh $CUSTOMER packages/plugin-<name>"
