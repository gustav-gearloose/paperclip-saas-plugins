#!/usr/bin/env bash
# run-tool.sh — execute a single plugin tool locally using the SDK test harness
#
# No Paperclip instance required. The worker is imported directly; secrets come
# from environment variables you pass on the command line.
#
# Usage:
#   ./scripts/run-tool.sh <plugin-package-dir> <tool-name> [json-params]
#
# Environment variables:
#   PLUGIN_SECRET_<KEY>=<value>   — actual secret value (KEY = secretRef field name in config)
#   PLUGIN_CONFIG_<KEY>=<value>   — config values (KEY = instanceConfigSchema field name)
#
# Examples:
#   PLUGIN_SECRET_dineroClientIdRef=abc \
#   PLUGIN_SECRET_dineroClientSecretRef=def \
#   PLUGIN_SECRET_dineroApiKeyRef=ghi \
#   PLUGIN_CONFIG_dineroOrgId=12345 \
#   ./scripts/run-tool.sh packages/plugin-dinero dinero_list_contacts '{}'
#
#   PLUGIN_SECRET_accessTokenRef=Bearer_xyz \
#   ./scripts/run-tool.sh packages/plugin-hubspot hubspot_search_contacts '{"limit":5}'

set -euo pipefail

PLUGIN_DIR="${1:?Usage: $0 <plugin-package-dir> <tool-name> [json-params]}"
TOOL_NAME="${2:?Tool name required}"
if [[ $# -ge 3 ]]; then
  TOOL_PARAMS="$3"
else
  TOOL_PARAMS='{}'
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGIN_ABS="$(cd "$REPO_ROOT/$PLUGIN_DIR" 2>/dev/null || cd "$PLUGIN_DIR" && pwd)"

# Require a built dist/
if [[ ! -f "$PLUGIN_ABS/dist/worker.js" || ! -f "$PLUGIN_ABS/dist/manifest.js" ]]; then
  echo "❌ dist/worker.js or dist/manifest.js not found — run: npm run build" >&2
  echo "   in $PLUGIN_ABS" >&2
  exit 1
fi

# Collect env-provided config and secrets into temp JSON files
TMPDIR_RUNNER=$(mktemp -d /tmp/pc-run-tool-XXXXXX)
trap "rm -rf '$TMPDIR_RUNNER'" EXIT

python3 - "$TMPDIR_RUNNER" << 'PYEOF'
import os, json, sys
out = sys.argv[1]
config  = {k[len('PLUGIN_CONFIG_'):]: v for k, v in os.environ.items() if k.startswith('PLUGIN_CONFIG_')}
secrets = {k[len('PLUGIN_SECRET_'):]: v for k, v in os.environ.items() if k.startswith('PLUGIN_SECRET_')}
with open(f'{out}/config.json', 'w') as f:  json.dump(config, f)
with open(f'{out}/secrets.json', 'w') as f: json.dump(secrets, f)
PYEOF

# Write the params to a file to avoid shell quoting issues in the runner
printf '%s' "$TOOL_PARAMS" > "$TMPDIR_RUNNER/params.json"

# Write a self-contained ESM runner
RUNNER="$TMPDIR_RUNNER/runner.mjs"
cat > "$RUNNER" << RUNNER_EOF
import { readFileSync } from "node:fs";
import { createTestHarness } from "$PLUGIN_ABS/node_modules/@paperclipai/plugin-sdk/dist/testing.js";

const config  = JSON.parse(readFileSync("$TMPDIR_RUNNER/config.json",  "utf8"));
const secrets = JSON.parse(readFileSync("$TMPDIR_RUNNER/secrets.json", "utf8"));
const params  = JSON.parse(readFileSync("$TMPDIR_RUNNER/params.json",  "utf8"));

const manifestModule = await import("$PLUGIN_ABS/dist/manifest.js");
const workerModule   = await import("$PLUGIN_ABS/dist/worker.js");

const manifest = manifestModule.default ?? manifestModule.manifest;
// definePlugin returns { definition: { setup, ... } }; default export is that object
const pluginObj = workerModule.default ?? workerModule.plugin;
const setupFn   = pluginObj?.definition?.setup ?? pluginObj?.setup;

if (typeof setupFn !== "function") {
  console.error("❌ Could not find setup function in worker export:", Object.keys(pluginObj ?? {}));
  process.exit(1);
}

const harness = createTestHarness({ manifest, config, capabilities: manifest.capabilities });

// Override secrets.resolve: workers call ctx.secrets.resolve(config.someSecretRef)
// where config.someSecretRef is the ref value stored in config (e.g. a UUID in prod).
// Locally, set PLUGIN_CONFIG_someSecretRef=someSecretRef (use the field name as value)
// and PLUGIN_SECRET_someSecretRef=<actual-secret> — the resolve call returns the secret.
harness.ctx.secrets.resolve = async (ref) => {
  if (secrets[ref] !== undefined) return secrets[ref];
  return ref;
};

await setupFn(harness.ctx);

let result;
try {
  result = await harness.executeTool("$TOOL_NAME", params);
} catch (err) {
  result = { error: err.message };
}

console.log(JSON.stringify(result, null, 2));
RUNNER_EOF

cd "$PLUGIN_ABS"
node "$RUNNER"
