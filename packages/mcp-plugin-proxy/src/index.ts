#!/usr/bin/env node
/**
 * Paperclip MCP Plugin Proxy
 *
 * Dynamically fetches all registered plugin tools from a Paperclip instance
 * and exposes them as MCP tools. When called, proxies execution to the
 * Paperclip plugin tool execute API.
 *
 * Required env vars:
 *   PC_HOST        e.g. http://localhost:3100
 *   PC_EMAIL       Paperclip login email
 *   PC_PASSWORD    Paperclip login password
 *   PC_COMPANY_ID  Paperclip company UUID
 *
 * Optional:
 *   PC_AGENT_ID    Agent UUID for runContext (defaults to "mcp-proxy")
 *   PC_PROJECT_ID  Project UUID for runContext
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

const PC_HOST = process.env.PC_HOST ?? "";
const PC_EMAIL = process.env.PC_EMAIL ?? "";
const PC_PASSWORD = process.env.PC_PASSWORD ?? "";
const PC_COMPANY_ID = process.env.PC_COMPANY_ID ?? "";
const PC_AGENT_ID = process.env.PC_AGENT_ID ?? "mcp-proxy";
const PC_PROJECT_ID = process.env.PC_PROJECT_ID ?? "";

if (!PC_HOST || !PC_EMAIL || !PC_PASSWORD || !PC_COMPANY_ID) {
  process.stderr.write(
    "❌ Missing required env vars: PC_HOST, PC_EMAIL, PC_PASSWORD, PC_COMPANY_ID\n"
  );
  process.exit(1);
}

interface AgentToolDescriptor {
  name: string;
  displayName: string;
  description: string;
  parametersSchema: Record<string, unknown>;
  pluginId: string;
}

let sessionCookie = "";

async function authenticate(): Promise<void> {
  const resp = await fetch(`${PC_HOST}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: PC_HOST,
      Referer: `${PC_HOST}/`,
    },
    body: JSON.stringify({ email: PC_EMAIL, password: PC_PASSWORD }),
  });
  if (!resp.ok) {
    throw new Error(`Auth failed: ${resp.status} ${await resp.text()}`);
  }
  const setCookie = resp.headers.get("set-cookie") ?? "";
  // Extract session token from Set-Cookie header
  const match = setCookie.match(/better-auth\.session_token=([^;]+)/);
  if (match) {
    sessionCookie = `better-auth.session_token=${match[1]}`;
  } else {
    // Fall back to grabbing all cookie name=value pairs
    sessionCookie = setCookie
      .split(",")
      .map((s) => s.trim().split(";")[0])
      .join("; ");
  }
}

async function pcFetch(path: string, init?: RequestInit): Promise<unknown> {
  const resp = await fetch(`${PC_HOST}${path}`, {
    ...init,
    headers: {
      Cookie: sessionCookie,
      Origin: PC_HOST,
      Referer: `${PC_HOST}/`,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (resp.status === 401) {
    // Re-auth and retry once
    await authenticate();
    const retry = await fetch(`${PC_HOST}${path}`, {
      ...init,
      headers: {
        Cookie: sessionCookie,
        Origin: PC_HOST,
        Referer: `${PC_HOST}/`,
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
    return retry.json();
  }
  return resp.json();
}

async function listPluginTools(): Promise<AgentToolDescriptor[]> {
  const data = await pcFetch("/api/plugins/tools");
  if (!Array.isArray(data)) return [];
  return data as AgentToolDescriptor[];
}

// MCP tool names must match [a-zA-Z0-9_-]+ — sanitize the Paperclip "pluginKey:toolName"
function toMcpName(apiName: string): string {
  return apiName.replace(/[.:]/g, "_");
}

function descriptorToMcpTool(d: AgentToolDescriptor): Tool {
  return {
    name: toMcpName(d.name),
    description: `[${d.displayName}] ${d.description}`,
    inputSchema: {
      type: "object" as const,
      ...(d.parametersSchema as object),
    },
  };
}

// MCP name → full API descriptor (for lookup at call time)
let toolMap = new Map<string, AgentToolDescriptor>();

async function refreshTools(): Promise<void> {
  const descriptors = await listPluginTools();
  toolMap = new Map(descriptors.map((d) => [toMcpName(d.name), d]));
  process.stderr.write(
    `→ Loaded ${toolMap.size} plugin tools: ${[...toolMap.keys()].join(", ")}\n`
  );
}

async function executePluginTool(
  mcpName: string,
  parameters: Record<string, unknown>
): Promise<unknown> {
  const descriptor = toolMap.get(mcpName);
  if (!descriptor) {
    throw new Error(`Unknown plugin tool: ${mcpName}`);
  }

  // d.name is already "pluginKey:toolName" — pass it directly to the execute API
  const body = {
    tool: descriptor.name,
    parameters,
    runContext: {
      agentId: PC_AGENT_ID,
      runId: `mcp-${Date.now()}`,
      companyId: PC_COMPANY_ID,
      projectId: PC_PROJECT_ID || undefined,
    },
  };

  const result = await pcFetch("/api/plugins/tools/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return result;
}


async function main(): Promise<void> {
  await authenticate();
  await refreshTools();

  const server = new Server(
    { name: "paperclip-plugin-proxy", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    // Refresh tool list on every list call so new plugins are picked up
    await refreshTools();
    return { tools: [...toolMap.values()].map(descriptorToMcpTool) };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    try {
      const resp = await executePluginTool(
        name,
        args as Record<string, unknown>
      ) as Record<string, unknown>;
      // Unwrap { pluginId, toolName, result: { content, error? } }
      const inner = (resp?.result ?? resp) as Record<string, unknown>;
      if (inner?.error) {
        return {
          content: [{ type: "text", text: String(inner.error) }],
          isError: true,
        };
      }
      const text = typeof inner?.content === "string"
        ? inner.content
        : JSON.stringify(resp, null, 2);
      return { content: [{ type: "text", text }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("✅ Paperclip MCP plugin proxy running\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
