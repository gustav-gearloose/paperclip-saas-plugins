import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { PodioClient } from "./podio-client.js";

interface PodioPluginConfig {
  clientIdRef?: string;
  clientSecretRef?: string;
  appId?: string;
  appTokenRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as PodioPluginConfig;
    const { clientIdRef, clientSecretRef, appId, appTokenRef } = config;

    if (!clientIdRef || !clientSecretRef || !appId || !appTokenRef) {
      ctx.logger.error("Podio plugin: clientIdRef, clientSecretRef, appId, and appTokenRef are required");
      return;
    }

    let clientId: string;
    let clientSecret: string;
    let appToken: string;
    try {
      [clientId, clientSecret, appToken] = await Promise.all([
        ctx.secrets.resolve(clientIdRef),
        ctx.secrets.resolve(clientSecretRef),
        ctx.secrets.resolve(appTokenRef),
      ]);
    } catch (err) {
      ctx.logger.error(`Podio plugin: failed to resolve secrets: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    let client: PodioClient;
    try {
      client = await PodioClient.create(clientId, clientSecret, appId, appToken);
    } catch (err) {
      ctx.logger.error(`Podio plugin: auth failed: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    ctx.logger.info(`Podio plugin: authenticated for app ${appId}, registering tools`);

    ctx.tools.register(
      "podio_get_app",
      {
        displayName: "Get App",
        description: "Get details about a Podio app (fields, description, workspace).",
        parametersSchema: {
          type: "object",
          properties: {
            appId: { type: "integer", description: "Podio app ID." },
          },
          required: ["appId"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { appId: number };
          const result = await client.getApp(p.appId);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "podio_get_items",
      {
        displayName: "Get Items",
        description: "List items in a Podio app with optional sorting and pagination.",
        parametersSchema: {
          type: "object",
          properties: {
            appId: { type: "integer", description: "Podio app ID." },
            limit: { type: "integer", description: "Max items to return (default: 100)." },
            offset: { type: "integer", description: "Pagination offset." },
            sort_by: { type: "string", description: "Field to sort by." },
            sort_desc: { type: "boolean", description: "Sort descending (default: false)." },
          },
          required: ["appId"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { appId: number; limit?: number; offset?: number; sort_by?: string; sort_desc?: boolean };
          const { appId: aid, ...rest } = p;
          const result = await client.getItems(aid, rest);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "podio_get_item",
      {
        displayName: "Get Item",
        description: "Get a specific Podio item by ID, including all field values.",
        parametersSchema: {
          type: "object",
          properties: {
            itemId: { type: "integer", description: "Podio item ID." },
          },
          required: ["itemId"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { itemId: number };
          const result = await client.getItem(p.itemId);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "podio_create_item",
      {
        displayName: "Create Item",
        description: "Create a new item in a Podio app.",
        parametersSchema: {
          type: "object",
          properties: {
            appId: { type: "integer", description: "Podio app ID to create the item in." },
            fields: { type: "object", description: "Key-value map of field external_id → value to set on the item." },
            externalId: { type: "string", description: "Optional external ID for deduplication." },
          },
          required: ["appId", "fields"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { appId: number; fields: Record<string, unknown>; externalId?: string };
          const result = await client.createItem(p.appId, p.fields, p.externalId);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "podio_update_item",
      {
        displayName: "Update Item",
        description: "Update fields on an existing Podio item.",
        parametersSchema: {
          type: "object",
          properties: {
            itemId: { type: "integer", description: "Podio item ID to update." },
            fields: { type: "object", description: "Key-value map of field external_id → new value." },
          },
          required: ["itemId", "fields"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { itemId: number; fields: Record<string, unknown> };
          const result = await client.updateItem(p.itemId, p.fields);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "podio_filter_items",
      {
        displayName: "Filter Items",
        description: "Filter items in a Podio app by field values.",
        parametersSchema: {
          type: "object",
          properties: {
            appId: { type: "integer", description: "Podio app ID." },
            filters: { type: "object", description: "Key-value filter map (field external_id → filter value)." },
            limit: { type: "integer", description: "Max results (default: 100)." },
            offset: { type: "integer", description: "Pagination offset." },
          },
          required: ["appId", "filters"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { appId: number; filters: Record<string, unknown>; limit?: number; offset?: number };
          const result = await client.filterItems(p.appId, p.filters, { limit: p.limit, offset: p.offset });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "podio_get_tasks",
      {
        displayName: "Get Tasks",
        description: "List tasks, optionally filtering by completion status.",
        parametersSchema: {
          type: "object",
          properties: {
            completed: { type: "boolean", description: "Filter by completion status (omit for all tasks)." },
            limit: { type: "integer", description: "Max tasks to return (default: 100)." },
            offset: { type: "integer", description: "Pagination offset." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const result = await client.getTasks(params as { completed?: boolean; limit?: number; offset?: number });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "podio_create_task",
      {
        displayName: "Create Task",
        description: "Create a new task in Podio.",
        parametersSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "Task title/description text." },
            description: { type: "string", description: "Longer task description." },
            dueDate: { type: "string", description: "Due date (YYYY-MM-DD)." },
            responsible: { type: "integer", description: "User ID to assign the task to." },
          },
          required: ["text"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const result = await client.createTask(params as { text: string; description?: string; dueDate?: string; responsible?: number });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "podio_complete_task",
      {
        displayName: "Complete Task",
        description: "Mark a Podio task as completed.",
        parametersSchema: {
          type: "object",
          properties: {
            taskId: { type: "integer", description: "Podio task ID to complete." },
          },
          required: ["taskId"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { taskId: number };
          const result = await client.completeTask(p.taskId);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "podio_get_comments",
      {
        displayName: "Get Comments",
        description: "Get comments on a Podio item, task, or other object.",
        parametersSchema: {
          type: "object",
          properties: {
            refType: { type: "string", enum: ["item", "task", "app", "space"], description: "Type of object to get comments for." },
            refId: { type: "integer", description: "ID of the object." },
          },
          required: ["refType", "refId"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { refType: string; refId: number };
          const result = await client.getComments(p.refType, p.refId);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "podio_add_comment",
      {
        displayName: "Add Comment",
        description: "Add a comment to a Podio item, task, or other object.",
        parametersSchema: {
          type: "object",
          properties: {
            refType: { type: "string", enum: ["item", "task", "app", "space"], description: "Type of object to comment on." },
            refId: { type: "integer", description: "ID of the object." },
            value: { type: "string", description: "Comment text." },
          },
          required: ["refType", "refId", "value"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { refType: string; refId: number; value: string };
          const result = await client.addComment(p.refType, p.refId, p.value);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "podio_search",
      {
        displayName: "Search",
        description: "Search across all Podio content (items, tasks, apps) within the authenticated app scope.",
        parametersSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query string." },
            limit: { type: "integer", description: "Max results (default: 20)." },
          },
          required: ["query"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { query: string; limit?: number };
          const result = await client.search(p.query, { limit: p.limit });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Podio plugin ready — 12 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "Podio plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
