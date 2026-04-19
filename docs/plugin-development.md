# Paperclip Plugin Development Guide

This is the living reference for building and deploying custom Paperclip plugins as part of the Gearloose SaaS offering. Everything here is battle-tested against a real self-hosted Paperclip instance.

## Overview

Paperclip plugins are Node.js ESM workers that run inside the Paperclip container process. A plugin registers tools at startup; agents can then call those tools via the Paperclip MCP interface. This is the right primitive for giving Paperclip agents access to external services (Dinero, CRM, etc.) without touching Paperclip core.

---

## Plugin Structure

Every plugin is a flat directory with these four files:

```
plugin-dir/
  manifest.js       # Plugin metadata + config schema (ESM)
  worker.js         # Tool registration + business logic (ESM)
  dinero-client.js  # (optional) extracted API client
  package.json
```

**`package.json` must point to the flat root — not `dist/`:**
```json
{
  "name": "@yourorg/paperclip-plugin-foo",
  "version": "0.1.0",
  "type": "module",
  "paperclipPlugin": {
    "manifest": "./manifest.js",
    "worker": "./worker.js"
  }
}
```

**`manifest.js` entrypoint must also be flat:**
```js
entrypoints: { worker: "./worker.js" }  // NOT "./dist/worker.js"
```

> **Why flat?** Paperclip resolves `entrypoints.worker` relative to the installed plugin directory root. There is no build-step integration — you copy compiled output and fix the paths.

---

## Manifest Rules

```ts
const manifest: PaperclipPluginManifestV1 = {
  id: "yourorg.pluginname",       // reverse-domain, unique
  apiVersion: 1,                  // number, not string
  version: "0.1.0",
  displayName: "Human Name",
  description: "...",
  author: "Yourorg",
  categories: ["connector"],
  capabilities: [                 // non-empty array — all strings must be valid enum values
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "instance.settings.register",
  ],
  entrypoints: { worker: "./worker.js" },
  instanceConfigSchema: { ... },  // JSON Schema for per-instance config
};
```

**Key constraints:**
- `apiVersion` must be the number `1`, not the string `"1"`
- `capabilities` must be a non-empty array of strings from Paperclip's `PLUGIN_CAPABILITIES` enum
- Tools are NOT declared in the manifest — they are registered at runtime via `ctx.tools.register()`

---

## Secrets System

Paperclip has a first-class secrets store. Use it for all credentials — never put plaintext secrets in config.

**How it works:**
1. A secret is created in Paperclip and gets a UUID.
2. The plugin's `instanceConfigSchema` declares fields with `format: "secret-ref"`.
3. The admin sets the config with the secret UUIDs (not the values).
4. The worker calls `ctx.secrets.resolve(uuid)` → `Promise<string>` to get the actual value at runtime.

**Schema field for a secret ref:**
```ts
dineroClientIdRef: {
  type: "string",
  format: "secret-ref",           // required for Paperclip's scoping check
  title: "Dinero Client ID",
  description: "UUID of a Paperclip secret holding the Dinero OAuth2 client_id.",
  default: "",
},
```

**Worker resolving secrets:**
```ts
const [clientId, clientSecret, apiKey] = await Promise.all([
  ctx.secrets.resolve(dineroClientIdRef),
  ctx.secrets.resolve(dineroClientSecretRef),
  ctx.secrets.resolve(dineroApiKeyRef),
]);
```

> `ctx.secrets.resolve()` takes a UUID string and returns the secret value. It will throw if the UUID doesn't exist or is out of scope.

---

## Worker Pattern

```ts
import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as MyConfig;

    // 1. Validate config
    if (!config.mySecretRef) {
      ctx.logger.error("mySecretRef is required");
      return;  // returning early stops the worker cleanly
    }

    // 2. Resolve secrets
    const secretValue = await ctx.secrets.resolve(config.mySecretRef);

    // 3. Init API client
    const client = new MyApiClient({ token: secretValue });

    // 4. Register tools
    ctx.tools.register(
      "tool_name",
      {
        displayName: "Tool Name",
        description: "What this tool does.",
        parametersSchema: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "The record ID." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.getRecord(p.id as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      }
    );

    ctx.logger.info("Plugin ready — N tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "Plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
```

**`ToolResult` shape:** `{ content?: string, data?: unknown, error?: string }` — no `isError` field.

---

## Install Procedure (Self-Hosted NUC)

This is the proven procedure for deploying a plugin to a self-hosted Paperclip Docker instance.

### 1. Build TypeScript on your dev machine

```bash
cd packages/plugin-foo
npm run build   # runs tsc
```

`tsconfig.json` must include `"types": ["node"]` and `"rootDir": "./src"`.

### 2. Copy built files to NUC

```bash
scp dist/worker.js dist/manifest.js dist/my-client.js package.json nuc:~/paperclip-plugins-src/plugin-foo/
```

### 3. Fix paths on NUC (dist/ → flat)

```bash
ssh nuc "python3 -c \"
import json
with open('~/paperclip-plugins-src/plugin-foo/package.json') as f: p = json.load(f)
p['paperclipPlugin'] = {'manifest': './manifest.js', 'worker': './worker.js'}
with open('~/paperclip-plugins-src/plugin-foo/package.json', 'w') as f: json.dump(p, f, indent=2)
\""
ssh nuc "sed -i 's|./dist/worker.js|./worker.js|g' ~/paperclip-plugins-src/plugin-foo/manifest.js"
```

### 4. Copy into container and install dependencies

```bash
# Increment v3 → v4 etc. on each deploy — Node caches imports by path
ssh nuc "DOCKER_HOST=unix:///var/run/docker.sock docker cp ~/paperclip-plugins-src/plugin-foo/ paperclip-deploy-paperclip-1:/paperclip-foo-v3"

# Install runtime dependencies INSIDE the container (not from Mac — CJS modules aren't portable)
ssh nuc "DOCKER_HOST=unix:///var/run/docker.sock docker exec paperclip-deploy-paperclip-1 bash -c \
  'cd /paperclip-foo-v3 && npm install --ignore-scripts 2>&1 | tail -5'"

# Symlink the SDK AFTER npm install (npm install would overwrite it)
ssh nuc "DOCKER_HOST=unix:///var/run/docker.sock docker exec paperclip-deploy-paperclip-1 bash -c \
  'rm -rf /paperclip-foo-v3/node_modules/@paperclipai && \
   mkdir -p /paperclip-foo-v3/node_modules/@paperclipai && \
   ln -sfn /app/packages/plugins/sdk /paperclip-foo-v3/node_modules/@paperclipai/plugin-sdk && \
   echo SDK symlinked'"
```

> **Why npm install inside the container?** Transitive CJS dependencies (e.g. imapflow → pino → quick-format-unescaped) are deeply nested and not portable from Mac to Linux. `npm` is available in the container and resolves all transitive deps cleanly. Always symlink the SDK AFTER running npm install, since npm will clear the `@paperclipai` dir.

> **Why increment the path?** Node's dynamic `import()` caches by resolved file path. Redeploying to `/paperclip-foo-v2` after a code change will serve the old cached module. A new path (`v3`, `v4`, ...) forces a fresh import.

### 5. Create secrets in Paperclip

```bash
# Auth first
curl -s -X POST http://HOST:3100/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -c /tmp/paperclip-cookies.txt \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}'

# Create a secret — note the returned UUID
curl -s -X POST "http://HOST:3100/api/companies/COMPANY_ID/secrets" \
  -b /tmp/paperclip-cookies.txt \
  -H "Content-Type: application/json" \
  -H "Origin: http://HOST:3100" \
  -d '{"name":"My Secret Name","value":"the-actual-secret-value"}'
# → {"id":"<uuid>", ...}
```

### 6. Install the plugin

```bash
curl -s -X POST http://HOST:3100/api/plugins/install \
  -b /tmp/paperclip-cookies.txt \
  -H "Content-Type: application/json" \
  -H "Origin: http://HOST:3100" \
  -d '{"packageName":"/paperclip-foo-v3","isLocalPath":true}'
# → {"id":"<plugin-id>", "status":"ready", ...}
```

### 7. Set config (with secret UUIDs, not values)

```bash
curl -s -X POST "http://HOST:3100/api/plugins/PLUGIN_ID/config" \
  -b /tmp/paperclip-cookies.txt \
  -H "Content-Type: application/json" \
  -H "Origin: http://HOST:3100" \
  -d '{
    "configJson": {
      "myOrgId": "12345",
      "mySecretRef": "<uuid-from-step-5>"
    }
  }'
```

### 8. Restart worker (uninstall → reinstall so worker starts with config)

```bash
# purge=false keeps the config
curl -s -X DELETE "http://HOST:3100/api/plugins/PLUGIN_ID?purge=false" \
  -b /tmp/paperclip-cookies.txt -H "Origin: http://HOST:3100"

curl -s -X POST http://HOST:3100/api/plugins/install \
  -b /tmp/paperclip-cookies.txt \
  -H "Content-Type: application/json" \
  -H "Origin: http://HOST:3100" \
  -d '{"packageName":"/paperclip-foo-v3","isLocalPath":true}'
```

### 9. Verify

```bash
curl -s "http://HOST:3100/api/plugins/PLUGIN_ID/health" \
  -b /tmp/paperclip-cookies.txt -H "Origin: http://HOST:3100"
# → {"status":"ready","healthy":true,...}

# Check container logs for tool registration confirmation
ssh nuc "sg docker -c 'docker logs paperclip-deploy-paperclip-1 --tail=20'" | grep -i "plugin"
```

---

## API Reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/auth/sign-in/email` | POST | Get session cookie |
| `/api/plugins/install` | POST | Install plugin |
| `/api/plugins` | GET | List installed plugins |
| `/api/plugins/:id` | GET | Get plugin details + lastError |
| `/api/plugins/:id/config` | POST | Set instance config |
| `/api/plugins/:id/health` | GET | Health check |
| `/api/plugins/:id` | DELETE | Uninstall (`?purge=false` keeps config) |
| `/api/companies/:id/secrets` | POST | Create a secret |

**Required headers on all API calls:**
- `Origin: http://HOST:3100` — CSRF protection, must match the instance URL
- Cookie from auth step

---

## Dinero Plugin — Auth Notes

Dinero uses OAuth2 password grant with Basic auth. The correct endpoint is:

```
POST https://authz.dinero.dk/dineroapi/oauth/token
Authorization: Basic base64(clientId:clientSecret)
Content-Type: application/x-www-form-urlencoded

grant_type=password&scope=read+write&username=API_KEY&password=API_KEY
```

The API key is used as both `username` and `password`. The response contains `access_token` which is used as a Bearer token for all `https://api.dinero.dk/v1/{orgId}/...` requests.

**Common mistakes:**
- `authorizationserver.dinero.dk` — **does not resolve** (DNS dead end)
- Passing `client_id`/`client_secret` in the POST body instead of Basic auth header — returns 400
- Wrong scope: `openid email` doesn't work; use `read write`

Credentials come from: email Dinero support for `clientId`/`clientSecret`; create API key in Dinero → Indstillinger → Integrationer → API nøgler.

---

## SaaS Deployment Strategy

For the Gearloose SaaS (installing plugins on customer Paperclip instances), the path-increment workaround for Node's module cache is not scalable. The production approach should be:

1. **Package plugins as npm tarballs** — `npm pack` produces a `.tgz`. Paperclip's install API likely supports npm package names if the instance has network access, removing the need for manual `docker cp`.
2. **Automate the install script** — wrap steps 2–9 above in a single idempotent shell script or Node script that takes `HOST`, `EMAIL`, `PASSWORD`, and secret values as arguments.
3. **Version in the plugin ID or path** — until Paperclip supports in-place plugin updates, bump the container path on each version (or use a Paperclip restart to clear the import cache cleanly).
4. **Secret creation via API** — already possible; integrate into the onboarding flow so customers never paste secrets into config fields directly.
