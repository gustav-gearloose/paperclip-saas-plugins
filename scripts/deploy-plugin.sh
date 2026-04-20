#!/usr/bin/env bash
# deploy-plugin.sh — build and deploy a custom Paperclip plugin to a self-hosted instance
#
# Usage:
#   ./scripts/deploy-plugin.sh <plugin-package-dir> [options]
#
# Required env vars (or pass as options):
#   PC_HOST        Paperclip host, e.g. http://localhost:3100
#   PC_EMAIL       Paperclip login email
#   PC_PASSWORD    Paperclip login password
#   PC_COMPANY_ID  Paperclip company UUID
#   SSH_HOST       SSH host for the NUC/server running the container
#   CONTAINER      Docker container name (default: paperclip-deploy-paperclip-1)
#
# Example:
#   PC_HOST=http://localhost:3100 \
#   PC_EMAIL=you@example.com \
#   PC_PASSWORD=secret \
#   PC_COMPANY_ID=df675b10-... \
#   SSH_HOST=nuc \
#   ./scripts/deploy-plugin.sh packages/plugin-email
#
# Config JSON is read from <plugin-dir>/deploy-config.json if it exists.
# Format: {"configJson": {...}, "secretRefs": {"mySecretRef": {"name": "secret-name", "value": "actual-value"}}}

set -euo pipefail

PLUGIN_DIR="${1:?Usage: $0 <plugin-package-dir>}"
PLUGIN_DIR="$(cd "$PLUGIN_DIR" && pwd)"
CONTAINER="${CONTAINER:-paperclip-deploy-paperclip-1}"
DOCKER="DOCKER_HOST=unix:///var/run/docker.sock docker"

# ── helpers ──────────────────────────────────────────────────────────────────

die() { echo "❌ $*" >&2; exit 1; }
info() { echo "→ $*"; }

require_env() {
  for v in PC_HOST PC_EMAIL PC_PASSWORD PC_COMPANY_ID SSH_HOST; do
    [[ -n "${!v:-}" ]] || die "Missing required env var: $v"
  done
}

# Run curl on the remote host, always with the session cookie
pc_curl() {
  ssh "$SSH_HOST" "curl -s -b /tmp/pc_deploy_cookies.txt \
    -H 'Origin: $PC_HOST' \
    -H 'Referer: $PC_HOST/' \
    $*"
}

pc_curl_post() {
  local url="$1"; shift
  ssh "$SSH_HOST" "curl -s -b /tmp/pc_deploy_cookies.txt \
    -X POST '$PC_HOST$url' \
    -H 'Content-Type: application/json' \
    -H 'Origin: $PC_HOST' \
    -H 'Referer: $PC_HOST/' \
    $*"
}

# ── step 1: build ─────────────────────────────────────────────────────────────

require_env

info "Building $PLUGIN_DIR..."
cd "$PLUGIN_DIR"
build_out=$(npm run build 2>&1) || { echo "$build_out"; die "Build failed for $(basename "$PLUGIN_DIR")"; }
echo "$build_out" | tail -5
cd - > /dev/null

# ── step 2: read package metadata ─────────────────────────────────────────────

PACKAGE_NAME=$(node -e "const p=require('$PLUGIN_DIR/package.json'); console.log(p.name)")
VERSION=$(node -e "const p=require('$PLUGIN_DIR/package.json'); console.log(p.version)")
# Slugify for container path: @gearloose/paperclip-plugin-email → paperclip-email
SLUG=$(echo "$PACKAGE_NAME" | sed 's|.*/||; s|paperclip-plugin-||; s|@[^/]*/||')

# Find the next available version path on the container
NEXT_V=1
while ssh "$SSH_HOST" "$DOCKER exec $CONTAINER test -d /paperclip-${SLUG}-v${NEXT_V}" 2>/dev/null; do
  NEXT_V=$((NEXT_V + 1))
done
CONTAINER_PATH="/paperclip-${SLUG}-v${NEXT_V}"

info "Deploying $PACKAGE_NAME@$VERSION → $CONTAINER_PATH"

# ── step 3: prepare flat staging dir ──────────────────────────────────────────

STAGING=$(mktemp -d)
SECRET_UUIDS_FILE=$(mktemp)
trap "rm -rf $STAGING $SECRET_UUIDS_FILE" EXIT

# Copy dist files flat (no dist/ subdir)
cp "$PLUGIN_DIR"/dist/*.js "$STAGING/" 2>/dev/null || true
cp "$PLUGIN_DIR/package.json" "$STAGING/"

# Fix dist/ references in manifest.js and package.json
python3 - "$STAGING" <<'PYEOF'
import pathlib, sys, re
staging = pathlib.Path(sys.argv[1])
for f in staging.glob("*.js"):
    txt = f.read_text()
    # Strip any ./dist/ prefix from relative imports
    fixed = re.sub(r'"\./dist/([^"]+)"', r'"\./\1"', txt)
    fixed = fixed.replace("./dist/worker.js", "./worker.js") \
                 .replace("./dist/manifest.js", "./manifest.js")
    f.write_text(fixed)
for f in staging.glob("*.json"):
    txt = f.read_text()
    fixed = txt.replace("./dist/worker.js", "./worker.js") \
               .replace("./dist/manifest.js", "./manifest.js")
    f.write_text(fixed)
PYEOF

info "Staged files: $(ls $STAGING)"

# ── step 4: copy to NUC and into container ────────────────────────────────────

REMOTE_STAGING="~/paperclip-deploy-staging/$(basename $PLUGIN_DIR)"
ssh "$SSH_HOST" "mkdir -p $REMOTE_STAGING"
scp -q "$STAGING"/* "$SSH_HOST:$REMOTE_STAGING/"

info "Copying into container at $CONTAINER_PATH..."
ssh "$SSH_HOST" "$DOCKER cp $REMOTE_STAGING/ $CONTAINER:$CONTAINER_PATH"

# ── step 5: npm install inside container ──────────────────────────────────────

info "Installing npm dependencies inside container..."
ssh "$SSH_HOST" "$DOCKER exec $CONTAINER bash -c \
  'set -e; cd $CONTAINER_PATH && npm install --ignore-scripts'" \
  || die "npm install inside container failed"

# Symlink SDK (must be AFTER npm install)
ssh "$SSH_HOST" "$DOCKER exec $CONTAINER bash -c \
  'rm -rf $CONTAINER_PATH/node_modules/@paperclipai && \
   mkdir -p $CONTAINER_PATH/node_modules/@paperclipai && \
   ln -sfn /app/packages/plugins/sdk $CONTAINER_PATH/node_modules/@paperclipai/plugin-sdk'"
info "SDK symlinked."

# ── step 6: authenticate with Paperclip ───────────────────────────────────────

info "Authenticating with Paperclip at $PC_HOST..."
ssh "$SSH_HOST" "curl -s -X POST '$PC_HOST/api/auth/sign-in/email' \
  -H 'Content-Type: application/json' \
  -c /tmp/pc_deploy_cookies.txt \
  -d '{\"email\":\"$PC_EMAIL\",\"password\":\"$PC_PASSWORD\"}' > /dev/null"

# ── step 7: create secrets if deploy-config.json has secretRefs ───────────────
# secretRefs format:
#   {"key": {"name": "secret-name", "value": "actual-value"}}  → creates new secret
#   {"key": {"uuid": "existing-uuid"}}                          → reuses existing secret UUID
#
# PC_CUSTOMER_CONFIG may point to a customer-specific JSON that deep-merges
# over deploy-config.json (for per-customer org IDs, secret UUIDs, etc.)

DEPLOY_CONFIG="$PLUGIN_DIR/deploy-config.json"
CUSTOMER_CONFIG="${PC_CUSTOMER_CONFIG:-}"

if [[ -f "$DEPLOY_CONFIG" ]]; then
  info "Processing deploy-config.json secrets..."
  SECRET_REFS=$(python3 -c "
import json, sys, os
cfg = json.load(open('$DEPLOY_CONFIG'))
# Merge customer-specific overrides if provided
cust = os.environ.get('PC_CUSTOMER_CONFIG', '')
if cust and os.path.isfile(cust):
    overlay = json.load(open(cust))
    cfg.get('configJson', {}).update(overlay.get('configJson', {}))
    cfg.get('secretRefs', {}).update(overlay.get('secretRefs', {}))
refs = cfg.get('secretRefs', {})
for key, s in refs.items():
    uuid = s.get('uuid', '')
    name = s.get('name', '')
    value = s.get('value', '')
    print(key + '\t' + uuid + '\t' + name + '\t' + value)
")
  while IFS=$'\t' read -r key uuid name value; do
    [[ -z "$key" ]] && continue
    if [[ -n "$uuid" && "$uuid" != REPLACE_WITH* && "$uuid" != PENDING* ]]; then
      echo "$key=$uuid" >> "$SECRET_UUIDS_FILE"
      info "Reusing existing secret $key → $uuid"
    else
      info "Creating secret '$name'..."
      UUID=$(pc_curl_post "/api/companies/$PC_COMPANY_ID/secrets" \
        "-d '{\"name\":\"$name\",\"value\":\"$value\"}'" \
        | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
      echo "$key=$UUID" >> "$SECRET_UUIDS_FILE"
      info "  → $key = $UUID"
    fi
  done <<< "$SECRET_REFS"
fi

# ── step 8: check if plugin already installed ─────────────────────────────────

EXISTING_ID=$(pc_curl "'$PC_HOST/api/plugins'" \
  | python3 -c "
import sys, json
plugins = json.load(sys.stdin)
for p in plugins:
    if p.get('packagePath','') and '$SLUG' in p.get('packagePath',''):
        print(p['id'])
        break
" 2>/dev/null || true)

if [[ -n "$EXISTING_ID" ]]; then
  info "Uninstalling existing plugin $EXISTING_ID (keeping config)..."
  pc_curl "-X DELETE '$PC_HOST/api/plugins/$EXISTING_ID?purge=false'" > /dev/null
  sleep 1
fi

# ── step 9: install ───────────────────────────────────────────────────────────

info "Installing plugin from $CONTAINER_PATH..."
INSTALL_RESULT=$(pc_curl_post "/api/plugins/install" \
  "-d '{\"packageName\":\"$CONTAINER_PATH\",\"isLocalPath\":true}'")
PLUGIN_ID=$(echo "$INSTALL_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))")
STATUS=$(echo "$INSTALL_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','?'))")
LAST_ERR=$(echo "$INSTALL_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('lastError') or d.get('error',''))")

if [[ "$STATUS" != "ready" ]]; then
  die "Install failed (status=$STATUS): $LAST_ERR"
fi
info "Installed: $PLUGIN_ID (status=$STATUS)"

# ── step 10: set config ───────────────────────────────────────────────────────

if [[ -f "$DEPLOY_CONFIG" ]]; then
  info "Setting plugin config..."
  CONFIG_JSON=$(PC_CUSTOMER_CONFIG="$CUSTOMER_CONFIG" python3 - "$DEPLOY_CONFIG" "$SECRET_UUIDS_FILE" <<'PYEOF2'
import json, sys, os
cfg = json.load(open(sys.argv[1]))
config = cfg.get("configJson", {})
# Apply customer config overlay
cust = os.environ.get('PC_CUSTOMER_CONFIG', '')
if cust and os.path.isfile(cust):
    overlay = json.load(open(cust))
    config.update(overlay.get("configJson", {}))
# Inject resolved secret UUIDs
with open(sys.argv[2]) as f:
    for line in f:
        line = line.strip()
        if '=' in line:
            k, v = line.split('=', 1)
            config[k] = v
print(json.dumps({"configJson": config}))
PYEOF2
  )

  pc_curl_post "/api/plugins/$PLUGIN_ID/config" "-d '$CONFIG_JSON'" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('config set, error:', d.get('error','none'))"

  # Restart worker to pick up config
  info "Restarting worker with new config..."
  pc_curl "-X DELETE '$PC_HOST/api/plugins/$PLUGIN_ID?purge=false'" > /dev/null
  sleep 1
  RESTART_RESULT=$(pc_curl_post "/api/plugins/install" \
    "-d '{\"packageName\":\"$CONTAINER_PATH\",\"isLocalPath\":true}'")
  PLUGIN_ID=$(echo "$RESTART_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id', ''))" 2>/dev/null || echo "$PLUGIN_ID")
  echo "$RESTART_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('restart status:', d.get('status'), d.get('lastError') or '')"
fi

# ── done ─────────────────────────────────────────────────────────────────────

echo ""
echo "✅ Plugin deployed successfully"
echo "   ID:   $PLUGIN_ID"
echo "   Path: $CONTAINER_PATH"
echo "   Check health: curl $PC_HOST/api/plugins/$PLUGIN_ID/health"
