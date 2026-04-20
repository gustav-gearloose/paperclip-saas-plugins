#!/usr/bin/env bash
# new-plugin.sh — scaffold a new Paperclip plugin from a template
#
# Usage:
#   ./scripts/new-plugin.sh <plugin-name> [--secret <ref-name>]... [--config <key>=<description>]...
#
# Arguments:
#   plugin-name            Short name, e.g. "freshdesk" or "fortnox"
#                          Creates packages/plugin-<name>/
#
# Options:
#   --secret <ref-name>    Add a secretRef (repeatable). e.g. --secret apiTokenRef
#   --config <k>=<desc>    Add a configJson field (repeatable). e.g. --config subdomain="Zendesk subdomain"
#   --tool <name>          Add a placeholder tool (repeatable). e.g. --tool list_tickets
#   --author <name>        Plugin author (default: Gearloose)
#   --id <plugin-id>       Override plugin ID (default: gearloose.<name>)
#
# Examples:
#   ./scripts/new-plugin.sh freshdesk --secret apiTokenRef --config subdomain="Freshdesk subdomain" \
#     --tool list_tickets --tool get_ticket --tool create_ticket
#
#   ./scripts/new-plugin.sh fortnox --secret accessTokenRef --tool list_invoices --tool create_invoice

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✅${NC} $*"; }
info() { echo -e "  ${CYAN}→${NC} $*"; }
die()  { echo -e "\n  ${RED}❌ $*${NC}" >&2; exit 1; }

# ── parse args ────────────────────────────────────────────────────────────────

PLUGIN_NAME="${1:-}"
[[ -z "$PLUGIN_NAME" ]] && { echo "Usage: $0 <plugin-name> [options]"; echo "Run with --help for full usage."; exit 1; }
[[ "$PLUGIN_NAME" == "--help" || "$PLUGIN_NAME" == "-h" ]] && { sed -n '2,30p' "$0"; exit 0; }
shift

SECRETS=()
CONFIG_KEYS=()
CONFIG_DESCS=()
TOOLS=()
AUTHOR="Gearloose"
PLUGIN_ID="gearloose.${PLUGIN_NAME}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --secret)  SECRETS+=("$2");                           shift 2 ;;
    --config)
      key="${2%%=*}"; desc="${2#*=}"
      CONFIG_KEYS+=("$key"); CONFIG_DESCS+=("$desc");    shift 2 ;;
    --tool)    TOOLS+=("$2");                             shift 2 ;;
    --author)  AUTHOR="$2";                               shift 2 ;;
    --id)      PLUGIN_ID="$2";                            shift 2 ;;
    *) die "Unknown option: $1" ;;
  esac
done

PLUGIN_DIR="$REPO_ROOT/packages/plugin-$PLUGIN_NAME"
[[ -d "$PLUGIN_DIR" ]] && die "Directory already exists: $PLUGIN_DIR"

DISPLAY_NAME="$(echo "$PLUGIN_NAME" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1))substr($i,2)}1')"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Paperclip Plugin Scaffold               ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "  Plugin:    $PLUGIN_NAME"
echo "  ID:        $PLUGIN_ID"
echo "  Dir:       packages/plugin-$PLUGIN_NAME/"
echo "  Secrets:   ${SECRETS[*]:-none}"
echo "  Config:    ${CONFIG_KEYS[*]:-none}"
echo "  Tools:     ${TOOLS[*]:-<none — add with --tool>}"
echo ""

# ── create directory structure ────────────────────────────────────────────────

mkdir -p "$PLUGIN_DIR/src"
info "Created packages/plugin-$PLUGIN_NAME/src/"

# ── tsconfig.json (identical across all plugins) ──────────────────────────────

cat > "$PLUGIN_DIR/tsconfig.json" <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"]
}
EOF
ok "tsconfig.json"

# ── package.json ──────────────────────────────────────────────────────────────

cat > "$PLUGIN_DIR/package.json" <<EOF
{
  "name": "@gearloose/paperclip-plugin-$PLUGIN_NAME",
  "version": "0.1.0",
  "description": "$DISPLAY_NAME integration for Paperclip AI",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "paperclipPlugin": {
    "manifest": "./dist/manifest.js",
    "worker": "./dist/worker.js"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  },
  "dependencies": {
    "@paperclipai/plugin-sdk": "^2026.416.0"
  }
}
EOF
ok "package.json"

# ── deploy-config.json ────────────────────────────────────────────────────────

# Build secretRefs block
SECRET_REFS_JSON=""
for ref in "${SECRETS[@]+"${SECRETS[@]}"}"; do
  SECRET_REFS_JSON+="    \"$ref\": { \"uuid\": \"REPLACE_WITH_SECRET_UUID\" },"$'\n'
done
SECRET_REFS_JSON="${SECRET_REFS_JSON%,$'\n'}"  # strip trailing comma+newline

# Build configJson block
CONFIG_JSON_BLOCK=""
for key in "${CONFIG_KEYS[@]+"${CONFIG_KEYS[@]}"}"; do
  CONFIG_JSON_BLOCK+="    \"$key\": \"\","$'\n'
done
CONFIG_JSON_BLOCK="${CONFIG_JSON_BLOCK%,$'\n'}"

cat > "$PLUGIN_DIR/deploy-config.json" <<EOF
{
  "configJson": {
$(printf '%s' "$CONFIG_JSON_BLOCK")
  },
  "secretRefs": {
$(printf '%s' "$SECRET_REFS_JSON")
  }
}
EOF
ok "deploy-config.json"

# ── src/manifest.ts ───────────────────────────────────────────────────────────

# Build instanceConfigSchema properties
SCHEMA_PROPS=""
for ref in "${SECRETS[@]+"${SECRETS[@]}"}"; do
  SCHEMA_PROPS+="      $ref: {
        type: \"string\",
        format: \"secret-ref\",
        title: \"$DISPLAY_NAME API secret (ref)\",
        description: \"UUID of a Paperclip secret holding your $DISPLAY_NAME credential.\",
        default: \"\",
      },"$'\n'
done
_ci=0
for key in "${CONFIG_KEYS[@]+"${CONFIG_KEYS[@]}"}"; do
  desc="${CONFIG_DESCS[$_ci]:-}"
  _ci=$((_ci+1))
  SCHEMA_PROPS+="      $key: {
        type: \"string\",
        title: \"$desc\",
        description: \"$desc\",
        default: \"\",
      },"$'\n'
done

# Build required array
REQUIRED_FIELDS=""
for ref in "${SECRETS[@]+"${SECRETS[@]}"}"; do
  REQUIRED_FIELDS+="\"$ref\", "
done
for key in "${CONFIG_KEYS[@]+"${CONFIG_KEYS[@]}"}"; do
  REQUIRED_FIELDS+="\"$key\", "
done
REQUIRED_FIELDS="${REQUIRED_FIELDS%, }"

# Build tools array
TOOLS_BLOCK=""
for tool in "${TOOLS[@]+"${TOOLS[@]}"}"; do
  tool_display="$(echo "$tool" | sed 's/_/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1))substr($i,2)}1')"
  TOOLS_BLOCK+="    {
      name: \"${PLUGIN_NAME//-/_}_$tool\",
      displayName: \"$tool_display\",
      description: \"TODO: describe what $tool does.\",
      parametersSchema: {
        type: \"object\",
        properties: {},
      },
    },"$'\n'
done

cat > "$PLUGIN_DIR/src/manifest.ts" <<EOF
import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "$PLUGIN_ID",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "$DISPLAY_NAME",
  description: "TODO: describe what this plugin does.",
  author: "$AUTHOR",
  categories: ["connector"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "instance.settings.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
$(printf '%s' "$SCHEMA_PROPS")
    },
    required: [$REQUIRED_FIELDS],
  },
  tools: [
$(printf '%s' "$TOOLS_BLOCK")
  ],
};

export default manifest;
EOF
ok "src/manifest.ts"

# ── src/worker.ts ─────────────────────────────────────────────────────────────

# Build config interface fields
CONFIG_IFACE=""
for ref in "${SECRETS[@]+"${SECRETS[@]}"}"; do
  CONFIG_IFACE+="  $ref?: string;"$'\n'
done
for key in "${CONFIG_KEYS[@]+"${CONFIG_KEYS[@]}"}"; do
  CONFIG_IFACE+="  $key?: string;"$'\n'
done

# Build secret resolution block
SECRET_RESOLVE=""
for ref in "${SECRETS[@]+"${SECRETS[@]}"}"; do
  SECRET_RESOLVE+="
    if (!config.$ref) {
      ctx.logger.error(\"$PLUGIN_NAME plugin: $ref is required\");
      return;
    }
    let ${ref%Ref}Token: string;
    try {
      ${ref%Ref}Token = await ctx.secrets.resolve(config.$ref);
    } catch (err) {
      ctx.logger.error(\`$PLUGIN_NAME plugin: failed to resolve $ref: \${err instanceof Error ? err.message : String(err)}\`);
      return;
    }"
done

# Build config validation block
CONFIG_VALIDATE=""
for key in "${CONFIG_KEYS[@]+"${CONFIG_KEYS[@]}"}"; do
  CONFIG_VALIDATE+="
    if (!config.$key) {
      ctx.logger.error(\"$PLUGIN_NAME plugin: $key is required\");
      return;
    }"
done

# Build tool handlers
TOOL_HANDLERS=""
for tool in "${TOOLS[@]+"${TOOLS[@]}"}"; do
  tool_display="$(echo "$tool" | sed 's/_/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1))substr($i,2)}1')"
  tool_name="${PLUGIN_NAME//-/_}_$tool"
  TOOL_HANDLERS+="
    ctx.tools.register(
      \"$tool_name\",
      {
        displayName: \"$tool_display\",
        description: \"TODO: describe what $tool does.\",
        parametersSchema: { type: \"object\", properties: {} },
      },
      async (_params): Promise<ToolResult> => {
        try {
          // TODO: implement $tool
          return { content: JSON.stringify({ todo: \"implement $tool\" }, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );
"
done

cat > "$PLUGIN_DIR/src/worker.ts" <<EOF
import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";

interface ${DISPLAY_NAME// /}PluginConfig {
$(printf '%s' "$CONFIG_IFACE")
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as ${DISPLAY_NAME// /}PluginConfig;
$(printf '%s' "$CONFIG_VALIDATE")$(printf '%s' "$SECRET_RESOLVE")

    ctx.logger.info("$PLUGIN_NAME plugin: registering tools");
$(printf '%s' "$TOOL_HANDLERS")
  },
});

runWorker(plugin, import.meta.url);
EOF
ok "src/worker.ts"

# ── done ─────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Plugin scaffolded successfully!         ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "  Next steps:"
echo ""
echo "  1. Fill in the TODOs in src/manifest.ts and src/worker.ts"
echo "     (description, tool parameters, tool implementations)"
echo ""
echo "  2. Build:"
echo "     cd packages/plugin-$PLUGIN_NAME && npm install && npm run build"
echo ""
echo "  3. Validate:"
echo "     ./scripts/validate-plugins.sh packages/plugin-$PLUGIN_NAME"
echo ""
echo "  4. Provision for a customer:"
if [[ ${#SECRETS[@]} -gt 0 ]]; then
  echo "     PC_PASSWORD=<pw> \\"
  for ref in "${SECRETS[@]+"${SECRETS[@]}"}"; do
    var_name="$(echo "$ref" | tr '[:lower:]' '[:upper:]')"
    echo "       ${var_name}=<value> \\"
  done
  for key in "${CONFIG_KEYS[@]+"${CONFIG_KEYS[@]}"}"; do
    echo "       PLUGIN_CONFIG_${key}=<value> \\"
  done
  echo "       ./scripts/provision-plugin.sh <customer-slug> packages/plugin-$PLUGIN_NAME"
else
  echo "     PC_PASSWORD=<pw> ./scripts/provision-plugin.sh <customer-slug> packages/plugin-$PLUGIN_NAME"
fi
echo ""
