#!/usr/bin/env bash
# patch-agent-tool-auth.sh — allow agent JWTs to call plugin tool endpoints
#
# Background:
#   GET /api/plugins/tools and POST /api/plugins/tools/execute are gated with
#   assertBoardOrgAccess(), which calls assertBoard(), which rejects actor.type === "agent".
#   Agents therefore cannot discover or execute plugin tools via the HTTP API.
#
#   Fix: add assertBoardOrAgentOrgAccess() to authz.js that short-circuits for agents,
#   then replace the two tool-route calls in plugins.js with the new function.
#
# Must be re-run after every Paperclip container image rebuild.
#
# Usage:
#   ./scripts/patch-agent-tool-auth.sh <customer-slug>
#   ./scripts/patch-agent-tool-auth.sh gearloose

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

echo "Patching agent-tool-auth for customer: $CUSTOMER"
echo "Container: $CONTAINER on $SSH_HOST"
echo ""

# ── verify container is running ───────────────────────────────────────────────

STATUS=$(ssh "$SSH_HOST" "$DOCKER inspect $CONTAINER --format '{{.State.Status}}'" 2>/dev/null || echo "not_found")
[[ "$STATUS" == "running" ]] || fail "Container $CONTAINER is not running (status: $STATUS)"
ok "Container is running"

# ── locate files ──────────────────────────────────────────────────────────────

AUTHZ_FILE=$(ssh "$SSH_HOST" "$DOCKER exec $CONTAINER find /app/server/dist -name 'authz.js' 2>/dev/null | head -1")
[[ -n "$AUTHZ_FILE" ]] || fail "Could not find authz.js in container"

PLUGINS_FILE=$(ssh "$SSH_HOST" "$DOCKER exec $CONTAINER bash -c '
  for f in \$(find /app/server/dist -name \"plugins.js\" 2>/dev/null); do
    if grep -q \"plugins/tools\" \"\$f\" 2>/dev/null; then echo \"\$f\"; break; fi
  done
'")
[[ -n "$PLUGINS_FILE" ]] || fail "Could not find plugins.js with plugin/tools routes"

echo "  authz.js:   $AUTHZ_FILE"
echo "  plugins.js: $PLUGINS_FILE"

# ── check if already patched ──────────────────────────────────────────────────

ALREADY=$(ssh "$SSH_HOST" "$DOCKER exec $CONTAINER grep -c 'assertBoardOrAgentOrgAccess' '$AUTHZ_FILE' 2>/dev/null || echo 0")
if [[ "$ALREADY" -gt 0 ]]; then
  ok "Already patched — nothing to do"
  exit 0
fi

# ── write patch scripts to container ─────────────────────────────────────────

ssh "$SSH_HOST" "$DOCKER exec $CONTAINER bash -c 'cat > /tmp/patch_authz.py'" << 'PYEOF'
import sys
path = sys.argv[1]
txt = open(path).read()

if "assertBoardOrAgentOrgAccess" in txt:
    print("authz.js: already patched")
    sys.exit(0)

new_fn = """
export function assertBoardOrAgentOrgAccess(req) {
    if (req.actor.type === "agent") {
        return;
    }
    assertBoardOrgAccess(req);
}
"""

marker = "//# sourceMappingURL"
if marker in txt:
    txt = txt.replace(marker, new_fn + marker)
else:
    txt = txt + new_fn

open(path, "w").write(txt)
print("authz.js: assertBoardOrAgentOrgAccess added")
PYEOF

ssh "$SSH_HOST" "$DOCKER exec $CONTAINER bash -c 'cat > /tmp/patch_plugins.py'" << 'PYEOF'
import sys
path = sys.argv[1]
txt = open(path).read()

if "assertBoardOrAgentOrgAccess" in txt:
    print("plugins.js: already patched")
    sys.exit(0)

# Add new function to import
old_import = 'import { assertBoardOrgAccess,'
new_import = 'import { assertBoardOrgAccess, assertBoardOrAgentOrgAccess,'
txt = txt.replace(old_import, new_import, 1)

# Replace assertBoardOrgAccess only on the two tool routes
lines = txt.split("\n")
patched = 0
for i, line in enumerate(lines):
    if ('router.get("/plugins/tools"' in line or 'router.post("/plugins/tools/execute"' in line):
        for j in range(i, min(i + 10, len(lines))):
            if "assertBoardOrgAccess(req)" in lines[j]:
                lines[j] = lines[j].replace("assertBoardOrgAccess(req)", "assertBoardOrAgentOrgAccess(req)")
                patched += 1
                break

open(path, "w").write("\n".join(lines))
print(f"plugins.js: {patched} call(s) replaced on tool routes")
PYEOF

# ── apply patches ─────────────────────────────────────────────────────────────

info "Patching authz.js..."
ssh "$SSH_HOST" "$DOCKER exec $CONTAINER bash -c 'cp $AUTHZ_FILE ${AUTHZ_FILE}.bak-\$(date +%Y%m%d%H%M%S) && python3 /tmp/patch_authz.py $AUTHZ_FILE'"
ok "authz.js patched"

info "Patching plugins.js..."
ssh "$SSH_HOST" "$DOCKER exec $CONTAINER bash -c 'cp $PLUGINS_FILE ${PLUGINS_FILE}.bak-\$(date +%Y%m%d%H%M%S) && python3 /tmp/patch_plugins.py $PLUGINS_FILE'"
ok "plugins.js patched"

# ── verify ────────────────────────────────────────────────────────────────────

AUTHZ_CHECK=$(ssh "$SSH_HOST" "$DOCKER exec $CONTAINER grep -c 'assertBoardOrAgentOrgAccess' '$AUTHZ_FILE' 2>/dev/null || echo 0")
PLUGINS_CHECK=$(ssh "$SSH_HOST" "$DOCKER exec $CONTAINER grep -c 'assertBoardOrAgentOrgAccess' '$PLUGINS_FILE' 2>/dev/null || echo 0")
[[ "$AUTHZ_CHECK" -gt 0 ]] || fail "authz.js patch verification failed"
[[ "$PLUGINS_CHECK" -gt 0 ]] || fail "plugins.js patch verification failed"
ok "Verified: authz.js ($AUTHZ_CHECK), plugins.js ($PLUGINS_CHECK)"

echo ""
echo "✅ Patches applied. Restart Paperclip to activate:"
echo "   ssh $SSH_HOST \"$DOCKER restart $CONTAINER\""
echo ""
echo "   After restart, run smoke test:"
echo "   PC_PASSWORD=<pw> ./scripts/smoke-test-plugins.sh $CUSTOMER"
echo ""
echo "   NOTE: Re-run this script after every Paperclip container rebuild."
