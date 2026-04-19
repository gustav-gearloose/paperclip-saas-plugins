#!/usr/bin/env bash
# DEPRECATED — use wire-mcp-to-customer.sh instead.
# This script was hardcoded to the Gearloose instance and ran on the NUC itself.
# The new script runs from the Mac and handles any customer.
#
# Usage (from Mac repo root):
#   PC_PASSWORD=<pw> ./scripts/wire-mcp-to-customer.sh gearloose [agent-id]

echo "→ Delegating to wire-mcp-to-customer.sh gearloose ..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ -z "${PC_PASSWORD:-}" ]]; then
  echo "ERROR: Set PC_PASSWORD env var before running this script"
  exit 1
fi

exec "$SCRIPT_DIR/wire-mcp-to-customer.sh" gearloose "$@"
