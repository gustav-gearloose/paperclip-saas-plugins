#!/usr/bin/env bash
# patch-agent-tool-auth.sh — fix assertBoard blocking agents from plugin tool endpoints
#
# Background:
#   GET /api/plugins/tools and POST /api/plugins/tools/execute are gated with
#   assertBoard(), which rejects agent JWTs (actor.type === "agent"). This means
#   agents cannot discover or execute plugin tools via the HTTP API.
#
#   This is upstream bug paperclipai/paperclip#3271 / PR#3272.
#   Until it is merged and deployed, this script applies the same fix to the
#   compiled JS inside the running container.
#
# What this script does:
#   1. Adds assertBoardOrAgent() to authz.js (the compiled JS equivalent)
#   2. Replaces assertBoard() with assertBoardOrAgent() on the two tool endpoints
#      in plugins.js
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

# ── verify container is running ──────────────────────────────────────────────

STATUS=$(ssh "$SSH_HOST" "$DOCKER inspect $CONTAINER --format '{{.State.Status}}'" 2>/dev/null || echo "not_found")
[[ "$STATUS" == "running" ]] || fail "Container $CONTAINER is not running (status: $STATUS)"
ok "Container is running"

# ── locate authz.js ───────────────────────────────────────────────────────────

info "Locating authz.js..."
AUTHZ_FILE=$(ssh "$SSH_HOST" "$DOCKER exec $CONTAINER find /app/server/dist -name 'authz.js' 2>/dev/null | head -1" || echo "")
[[ -n "$AUTHZ_FILE" ]] || fail "Could not find authz.js in container. File may have moved in this Paperclip version."
echo "  Found: $AUTHZ_FILE"

# ── locate plugins.js (routes) ────────────────────────────────────────────────

info "Locating plugins.js (routes)..."
# Look for the file that contains both assertBoard and plugin tool routes
PLUGINS_FILE=$(ssh "$SSH_HOST" "$DOCKER exec $CONTAINER bash -c '
  for f in \$(find /app/server/dist -name \"plugins.js\" 2>/dev/null); do
    if grep -q "plugins/tools" "\$f" 2>/dev/null && grep -q "assertBoard" "\$f" 2>/dev/null; then
      echo "\$f"
      break
    fi
  done
'" || echo "")
[[ -n "$PLUGINS_FILE" ]] || fail "Could not find plugins.js with assertBoard + plugin/tools routes. Check Paperclip version."
echo "  Found: $PLUGINS_FILE"

# ── check current state ───────────────────────────────────────────────────────

AUTHZ_ALREADY=$(ssh "$SSH_HOST" "$DOCKER exec $CONTAINER grep -c 'assertBoardOrAgent' '$AUTHZ_FILE' 2>/dev/null || echo 0")
PLUGINS_ALREADY=$(ssh "$SSH_HOST" "$DOCKER exec $CONTAINER grep -c 'assertBoardOrAgent' '$PLUGINS_FILE' 2>/dev/null || echo 0")

if [[ "$AUTHZ_ALREADY" -gt 0 ]] && [[ "$PLUGINS_ALREADY" -gt 0 ]]; then
  ok "Patches already applied — nothing to do"
  exit 0
fi

# ── probe assertBoard signature in authz.js ──────────────────────────────────

info "Probing assertBoard in authz.js..."
AUTHZ_ASSERTBOARD=$(ssh "$SSH_HOST" "$DOCKER exec $CONTAINER grep -n 'assertBoard' '$AUTHZ_FILE' 2>/dev/null | head -5" || echo "")
echo "  $AUTHZ_ASSERTBOARD"

if [[ -z "$AUTHZ_ASSERTBOARD" ]]; then
  fail "assertBoard not found in authz.js — Paperclip may have restructured auth. Manual inspection required."
fi

# Detect what type of assertion pattern is used (throw vs conditional)
AUTHZ_PATTERN=$(ssh "$SSH_HOST" "$DOCKER exec $CONTAINER grep 'assertBoard' '$AUTHZ_FILE' 2>/dev/null | head -1" || echo "")

# ── probe plugin tool route patterns ─────────────────────────────────────────

info "Probing plugin tool route assertBoard calls in plugins.js..."
ROUTE_ASSERTBOARD=$(ssh "$SSH_HOST" "$DOCKER exec $CONTAINER grep -n 'assertBoard' '$PLUGINS_FILE' 2>/dev/null | head -10" || echo "")
echo "  $ROUTE_ASSERTBOARD"

ROUTE_COUNT=$(echo "$ROUTE_ASSERTBOARD" | grep -c 'assertBoard' || echo 0)

if [[ "$ROUTE_COUNT" -eq 0 ]]; then
  echo ""
  echo "  ⚠️  No assertBoard calls found in plugins.js."
  echo "     Either the bug is already fixed upstream, or the auth pattern changed."
  echo "     Inspect with:"
  echo "     ssh $SSH_HOST \"$DOCKER exec $CONTAINER grep -n 'assertBoard\\|assertBoardOrAgent' $PLUGINS_FILE\""
  exit 0
fi

# Find the line numbers for the two tool-route assertBoard calls
# We need to find the ones near "plugins/tools" paths, not the management routes
TOOL_LIST_LINE=$(ssh "$SSH_HOST" "$DOCKER exec $CONTAINER python3 -c \"
import re, sys
txt = open('$PLUGINS_FILE').read()
lines = txt.split('\n')
for i, line in enumerate(lines):
    if 'plugins/tools' in line or '/tools\"' in line or '/tools\\\")' in line:
        # Search nearby lines for assertBoard
        for j in range(i, min(i+8, len(lines))):
            if 'assertBoard' in lines[j] and 'assertBoardOrAgent' not in lines[j]:
                print(j+1)
                break
        break
\" 2>/dev/null" || echo "")

TOOL_EXEC_LINE=$(ssh "$SSH_HOST" "$DOCKER exec $CONTAINER python3 -c \"
import re, sys
txt = open('$PLUGINS_FILE').read()
lines = txt.split('\n')
found_tools = False
for i, line in enumerate(lines):
    if ('plugins/tools/execute' in line or '/tools/execute' in line):
        found_tools = True
    if found_tools and 'assertBoard' in line and 'assertBoardOrAgent' not in line:
        print(i+1)
        break
\" 2>/dev/null" || echo "")

echo "  Tool list route assertBoard line: ${TOOL_LIST_LINE:-not found}"
echo "  Tool execute route assertBoard line: ${TOOL_EXEC_LINE:-not found}"

# ── apply patches ─────────────────────────────────────────────────────────────

echo ""
info "Applying patches..."

# ── patch 1: add assertBoardOrAgent to authz.js ───────────────────────────────

ssh "$SSH_HOST" "$DOCKER exec $CONTAINER bash -c '
  set -e
  FILE=$AUTHZ_FILE

  if grep -q \"assertBoardOrAgent\" \"\$FILE\"; then
    echo \"authz.js: already patched\"
    exit 0
  fi

  cp \"\$FILE\" \"\${FILE}.bak-\$(date +%Y%m%d%H%M%S)\"

  # Strategy: find the assertBoard function definition and insert assertBoardOrAgent after it.
  # Compiled output is typically one of:
  #   function assertBoard(req) { if (req.actor.type !== "board") throw ... }
  #   exports.assertBoard = function(req) { ... }
  # We append the new function after the first closing brace of assertBoard.

  python3 - \"\$FILE\" <<'"'"'PYEOF'"'"'
import re, sys
path = sys.argv[1]
txt = open(path).read()

# Find assertBoard function body — locate it and insert assertBoardOrAgent after
# Pattern: matches "assertBoard" function in various compiled forms
# We insert the new function right after the assertBoard block ends.

insert_after = None

# Try to find end of assertBoard function by counting braces
m = re.search(r"(function assertBoard\b|assertBoard\s*=\s*function\b|exports\.assertBoard\s*=)", txt)
if not m:
    print("ERROR: could not locate assertBoard function", file=sys.stderr)
    sys.exit(1)

# Walk from match start, find the function body end
start = m.start()
depth = 0
in_func = False
for i in range(start, len(txt)):
    c = txt[i]
    if c == "{":
        depth += 1
        in_func = True
    elif c == "}" and in_func:
        depth -= 1
        if depth == 0:
            insert_after = i + 1
            break

if insert_after is None:
    print("ERROR: could not find end of assertBoard function", file=sys.stderr)
    sys.exit(1)

# Build the new function — mirror exact style of assertBoard
# Extract how assertBoard throws (to match error style)
board_body = txt[m.start():insert_after]

# Detect the forbidden/error call pattern
err_call = ""
em = re.search(r"throw\s+(\w+\([^)]*\))", board_body)
if em:
    err_call = em.group(1)
else:
    err_call = 'new Error("Board or agent access required")'

new_fn = (
    "\n"
    "function assertBoardOrAgent(req) {\n"
    "  if (req.actor.type !== \"board\" && req.actor.type !== \"agent\") {\n"
    "    throw " + err_call.replace("Board access required", "Board or agent access required") + ";\n"
    "  }\n"
    "}\n"
)

# Also export it if assertBoard is exported
if "exports.assertBoard" in txt or "module.exports" in txt:
    new_fn += "exports.assertBoardOrAgent = assertBoardOrAgent;\n"

new_txt = txt[:insert_after] + new_fn + txt[insert_after:]
open(path, "w").write(new_txt)
print("authz.js: assertBoardOrAgent injected after assertBoard at char", insert_after)
PYEOF
'"

ok "authz.js patched (assertBoardOrAgent added)"

# ── patch 2: replace assertBoard → assertBoardOrAgent on tool endpoints ───────

ssh "$SSH_HOST" "$DOCKER exec $CONTAINER bash -c '
  set -e
  FILE=$PLUGINS_FILE

  if grep -q \"assertBoardOrAgent\" \"\$FILE\"; then
    echo \"plugins.js: already patched\"
    exit 0
  fi

  cp \"\$FILE\" \"\${FILE}.bak-\$(date +%Y%m%d%H%M%S)\"

  python3 - \"\$FILE\" <<'"'"'PYEOF'"'"'
import re, sys
path = sys.argv[1]
txt = open(path).read()
lines = txt.split("\n")

# Find lines near plugin tool routes that contain assertBoard
# Strategy: find the /tools route handler block and /tools/execute block,
# replace assertBoard() with assertBoardOrAgent() within those blocks only.

def find_route_assertboard(lines, route_pattern):
    """Find the line index of assertBoard() call within N lines after a route pattern."""
    for i, line in enumerate(lines):
        if re.search(route_pattern, line):
            # Search within next 15 lines for assertBoard
            for j in range(i, min(i + 15, len(lines))):
                if "assertBoard(" in lines[j] and "assertBoardOrAgent" not in lines[j]:
                    return j
    return None

# Match /tools route (but not /tools/execute — we handle that separately)
list_idx = find_route_assertboard(lines, r"[\"'"'"']/plugins/tools[\"'"'"']|router\.(get|post)\s*\(\s*[\"'"'"'][^\"'"'"']*tools[\"'"'"']")
exec_idx = find_route_assertboard(lines, r"[\"'"'"']/plugins/tools/execute[\"'"'"']|tools/execute")

changed = 0
if list_idx is not None:
    lines[list_idx] = lines[list_idx].replace("assertBoard(", "assertBoardOrAgent(")
    changed += 1
    print(f"plugins.js: patched assertBoard→assertBoardOrAgent at line {list_idx+1} (tool list route)")

if exec_idx is not None and exec_idx != list_idx:
    lines[exec_idx] = lines[exec_idx].replace("assertBoard(", "assertBoardOrAgent(")
    changed += 1
    print(f"plugins.js: patched assertBoard→assertBoardOrAgent at line {exec_idx+1} (tool execute route)")

if changed == 0:
    print("WARNING: no assertBoard calls found near tool routes — inspect manually", file=sys.stderr)
    sys.exit(1)

open(path, "w").write("\n".join(lines))
print(f"plugins.js: {changed} assertBoard call(s) replaced")
PYEOF
'"

ok "plugins.js patched (assertBoard→assertBoardOrAgent on tool endpoints)"

# ── verify ────────────────────────────────────────────────────────────────────

echo ""
info "Verifying patches..."

AUTHZ_CHECK=$(ssh "$SSH_HOST" "$DOCKER exec $CONTAINER grep -c 'assertBoardOrAgent' '$AUTHZ_FILE' 2>/dev/null || echo 0")
PLUGINS_CHECK=$(ssh "$SSH_HOST" "$DOCKER exec $CONTAINER grep -c 'assertBoardOrAgent' '$PLUGINS_FILE' 2>/dev/null || echo 0")

[[ "$AUTHZ_CHECK" -gt 0 ]] || fail "authz.js patch verification failed — assertBoardOrAgent not found"
[[ "$PLUGINS_CHECK" -gt 0 ]] || fail "plugins.js patch verification failed — assertBoardOrAgent not found"

ok "authz.js verified ($AUTHZ_CHECK occurrence(s))"
ok "plugins.js verified ($PLUGINS_CHECK occurrence(s))"

# Show what remains as assertBoard in plugins.js (should be management routes only)
REMAINING=$(ssh "$SSH_HOST" "$DOCKER exec $CONTAINER grep -n 'assertBoard(' '$PLUGINS_FILE' 2>/dev/null | grep -v 'assertBoardOrAgent'" || echo "  (none)")
echo ""
echo "  Remaining assertBoard() calls in plugins.js (should be non-tool routes):"
echo "$REMAINING" | sed 's/^/    /'

echo ""
echo "✅ Agent-tool-auth patches applied successfully"
echo ""
echo "   IMPORTANT: Restart Paperclip to pick up the patches:"
echo "   ssh $SSH_HOST \"$DOCKER restart $CONTAINER\""
echo ""
echo "   After restart, verify agents can see tools:"
echo "   PC_PASSWORD=<pw> ./scripts/smoke-test-plugins.sh $CUSTOMER"
echo ""
echo "   NOTE: These patches must be re-applied after every Paperclip upgrade."
echo "   Add to your post-upgrade runbook alongside patch-paperclip-container.sh"
