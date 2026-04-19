#!/usr/bin/env bash
# deploy-for-customer.sh — deploy a plugin to a specific customer's Paperclip instance
#
# Usage:
#   ./scripts/deploy-for-customer.sh <customer-slug> <plugin-package-dir>
#
# Loads customers/<customer-slug>.env for instance config.
# PC_PASSWORD must be set in env or in customers/<customer-slug>.secrets (not committed).
#
# Example:
#   PC_PASSWORD=secret ./scripts/deploy-for-customer.sh gearloose packages/plugin-email
#   PC_PASSWORD=secret ./scripts/deploy-for-customer.sh acme-corp packages/plugin-dinero

set -euo pipefail

CUSTOMER="${1:?Usage: $0 <customer-slug> <plugin-package-dir>}"
PLUGIN_DIR="${2:?Usage: $0 <customer-slug> <plugin-package-dir>}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV_FILE="$REPO_ROOT/customers/$CUSTOMER.env"
SECRETS_FILE="$REPO_ROOT/customers/$CUSTOMER.secrets"

[[ -f "$ENV_FILE" ]] || { echo "❌ No customer config at $ENV_FILE" >&2; exit 1; }

# Load customer env (skip comment lines)
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
# Load secrets file if it exists (contains PC_PASSWORD etc.)
[[ -f "$SECRETS_FILE" ]] && source "$SECRETS_FILE"
set +a

exec "$SCRIPT_DIR/deploy-plugin.sh" "$PLUGIN_DIR"
