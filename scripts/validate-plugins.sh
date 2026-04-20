#!/usr/bin/env bash
# validate-plugins.sh — local structural validation of all plugins before deployment
#
# Checks each plugin for:
#   1. TypeScript compiles without errors
#   2. Manifest has required fields (apiVersion:1, capabilities[], tools[])
#   3. Worker has matching ctx.tools.register() calls for each manifest tool
#   4. deploy-config.json has no hardcoded secrets (only REPLACE_WITH_* placeholders)
#
# Usage:
#   ./scripts/validate-plugins.sh [plugin-package-dir...]
#   ./scripts/validate-plugins.sh               # validates all packages/plugin-*/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PASS=0
FAIL=0
ERRORS=()

ok()   { echo "  ✅ $*"; }
fail() { echo "  ❌ $*"; FAIL=$((FAIL+1)); ERRORS+=("$(basename "$PLUGIN_DIR"): $*"); }
info() { echo "  → $*"; }

if [[ $# -gt 0 ]]; then
  PLUGIN_DIRS=("$@")
else
  PLUGIN_DIRS=()
  for d in "$REPO_ROOT"/packages/plugin-*/; do
    PLUGIN_DIRS+=("$d")
  done
fi

for PLUGIN_DIR in "${PLUGIN_DIRS[@]}"; do
  PLUGIN_DIR="$(cd "$PLUGIN_DIR" && pwd)"
  name=$(basename "$PLUGIN_DIR")
  echo ""
  echo "── $name ──"

  # ── 1. TypeScript compile ────────────────────────────────────────────────────

  if [[ ! -f "$PLUGIN_DIR/tsconfig.json" ]]; then
    fail "No tsconfig.json"
    continue
  fi

  tsc_out=$(cd "$PLUGIN_DIR" && npx tsc --noEmit 2>&1 || true)
  if [[ -n "$tsc_out" ]]; then
    fail "TypeScript errors: $tsc_out"
  else
    ok "TypeScript clean"
    PASS=$((PASS+1))
  fi

  # ── 2. Manifest structure checks ─────────────────────────────────────────────

  MANIFEST_SRC="$PLUGIN_DIR/src/manifest.ts"
  if [[ ! -f "$MANIFEST_SRC" ]]; then
    fail "src/manifest.ts not found"
    continue
  fi

  # apiVersion must be number 1 (not string "1")
  if grep -q 'apiVersion: 1,' "$MANIFEST_SRC"; then
    ok "apiVersion: 1 (number)"
    PASS=$((PASS+1))
  elif grep -q 'apiVersion:' "$MANIFEST_SRC"; then
    fail "apiVersion present but may not be number 1 — check it's not a string"
  else
    fail "apiVersion missing from manifest"
  fi

  # capabilities must be non-empty array
  if grep -q 'capabilities:' "$MANIFEST_SRC" && grep -q '"agent.tools.register"' "$MANIFEST_SRC"; then
    ok "capabilities includes agent.tools.register"
    PASS=$((PASS+1))
  else
    fail "manifest missing capabilities or agent.tools.register"
  fi

  # tools array must exist and be non-empty
  manifest_tool_count=$(grep -c 'name: "' "$MANIFEST_SRC" 2>/dev/null || echo 0)
  # subtract 1 for the plugin's own name-like fields if any; use heuristic of counting tool-like names
  manifest_tools=$(grep -c '      name: "' "$MANIFEST_SRC" 2>/dev/null || echo 0)
  if [[ "$manifest_tools" -gt 0 ]]; then
    ok "manifest tools[]: $manifest_tools tool entries"
    PASS=$((PASS+1))
  else
    fail "manifest tools[] array empty or missing"
  fi

  # entrypoints.worker referencing ./dist/ is normal — deploy script patches it
  if grep -q 'worker: "./dist/' "$MANIFEST_SRC"; then
    info "entrypoints.worker uses ./dist/ (deploy script will fix at copy time)"
  fi

  # ── 3. Worker tool count parity ──────────────────────────────────────────────

  WORKER_SRC="$PLUGIN_DIR/src/worker.ts"
  if [[ ! -f "$WORKER_SRC" ]]; then
    fail "src/worker.ts not found"
    continue
  fi

  worker_tool_count=$(grep -c 'ctx\.tools\.register(' "$WORKER_SRC" 2>/dev/null || echo 0)
  if [[ "$manifest_tools" -eq "$worker_tool_count" ]]; then
    ok "Tool count parity: manifest=$manifest_tools worker=$worker_tool_count"
    PASS=$((PASS+1))
  else
    fail "Tool count mismatch: manifest=$manifest_tools worker=$worker_tool_count — check for missing register() calls or manifest entries"
  fi

  # Tool name parity (compiled dist — catches manifest/worker name divergence)
  if [[ -f "$PLUGIN_DIR/dist/manifest.js" && -f "$PLUGIN_DIR/dist/worker.js" ]]; then
    manifest_names=$(node -e "import('$PLUGIN_DIR/dist/manifest.js').then(m => (m.default.tools||[]).forEach(t => console.log(t.name))).catch(()=>{})" 2>/dev/null | sort)
    worker_names=$(grep -o 'ctx\.tools\.register("[^"]*"' "$PLUGIN_DIR/dist/worker.js" 2>/dev/null | grep -o '"[^"]*"' | tr -d '"' | sort)
    if [[ "$manifest_names" = "$worker_names" ]]; then
      ok "Tool name parity: all names match between manifest and worker"
      PASS=$((PASS+1))
    else
      fail "Tool name mismatch between manifest and worker:"
      diff <(echo "$manifest_names") <(echo "$worker_names") | grep '^[<>]' | sed 's/^< /  manifest-only: /; s/^> /  worker-only: /'
    fi
  else
    info "Skipping tool name parity (dist not built — run npm run build first)"
  fi

  # Worker must call runWorker at the end
  if grep -q 'runWorker(plugin' "$WORKER_SRC"; then
    ok "runWorker() present"
    PASS=$((PASS+1))
  else
    fail "runWorker(plugin, import.meta.url) missing from worker"
  fi

  # ── 4. deploy-config.json checks ─────────────────────────────────────────────

  DEPLOY_CONFIG="$PLUGIN_DIR/deploy-config.json"
  if [[ ! -f "$DEPLOY_CONFIG" ]]; then
    fail "deploy-config.json missing"
    continue
  fi

  # No hardcoded secret values (only REPLACE_WITH_* or UUIDs from customers/ overlay)
  # A UUID pattern in deploy-config is suspicious — should only be in customers/<slug>/<plugin>.json
  if python3 -c "
import json, sys, re
cfg = json.load(open('$DEPLOY_CONFIG'))
refs = cfg.get('secretRefs', {})
bad = []
for k, v in refs.items():
    uuid = v.get('uuid', '')
    val = v.get('value', '')
    # UUIDs or non-REPLACE values in deploy-config are suspicious
    if uuid and 'REPLACE_WITH' not in uuid and 'PENDING' not in uuid:
        bad.append(f'{k}.uuid={uuid}')
    if val and 'REPLACE_WITH' not in val:
        bad.append(f'{k}.value=<redacted>')
if bad:
    print('HARDCODED: ' + ', '.join(bad))
    sys.exit(1)
" 2>&1; then
    ok "deploy-config.json: no hardcoded secrets"
    PASS=$((PASS+1))
  else
    fail "deploy-config.json has hardcoded secret values — move to customers/<slug>/<plugin>.json"
  fi

  # configJson should not contain real org IDs / emails (only REPLACE_WITH_ or generic defaults)
  suspicious=$(python3 -c "
import json, sys, re
cfg = json.load(open('$DEPLOY_CONFIG'))
config = cfg.get('configJson', {})
bad = []
for k, v in config.items():
    if isinstance(v, str):
        # Flag things that look like real emails, numeric org IDs, or domain names
        if re.match(r'^[^@]+@[^@]+\.[^@]+$', v):  # email
            bad.append(f'{k}={v}')
        elif re.match(r'^\d{6,}$', v):  # numeric ID like 564267
            bad.append(f'{k}={v}')
        elif 'REPLACE_WITH' not in v and v not in ('DKK', 'da', 'en', '') and len(v) > 20:
            bad.append(f'{k}={v[:30]}...')
if bad: print(','.join(bad))
" 2>/dev/null || true)
  if [[ -n "$suspicious" ]]; then
    fail "deploy-config.json configJson may contain real customer data: $suspicious — move to customers/<slug>/<plugin>.json"
  else
    ok "deploy-config.json configJson: no suspicious values"
    PASS=$((PASS+1))
  fi

done

# ── summary ─────────────────────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════"
echo "Checks passed: $PASS | Failed: $FAIL"
if [[ ${#ERRORS[@]} -gt 0 ]]; then
  echo ""
  echo "Issues:"
  for e in "${ERRORS[@]}"; do
    echo "  • $e"
  done
  exit 1
fi
echo "All plugins valid ✅"
