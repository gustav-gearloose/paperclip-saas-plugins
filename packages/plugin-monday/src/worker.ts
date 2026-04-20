import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { MondayClient } from "./monday-client.js";

interface MondayPluginConfig {
  apiTokenRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as MondayPluginConfig;

    if (!config.apiTokenRef) {
      ctx.logger.error("monday.com plugin: apiTokenRef is required");
      return;
    }

    let apiToken: string;
    try {
      apiToken = await ctx.secrets.resolve(config.apiTokenRef);
    } catch (err) {
      ctx.logger.error(`monday.com plugin: failed to resolve apiTokenRef: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    ctx.logger.info("monday.com plugin: secret resolved, registering tools");
    const client = new MondayClient(apiToken);

    ctx.tools.register(
      "monday_list_boards",
      {
        displayName: "List Boards",
        description: "List monday.com boards, optionally filtered by workspace.",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Max boards to return (default 25).", default: 25 },
            page: { type: "integer", description: "Page number (default 1).", default: 1 },
            workspace_ids: {
              type: "array",
              items: { type: "integer" },
              description: "Filter by workspace IDs.",
            },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { limit?: number; page?: number; workspace_ids?: number[] };
          const result = await client.listBoards(p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "monday_get_board",
      {
        displayName: "Get Board",
        description: "Get full details for a monday.com board including groups and columns.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "integer", description: "Board ID." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { id: number };
          const result = await client.getBoard(p.id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "monday_list_items",
      {
        displayName: "List Items",
        description: "List items (tasks/rows) on a monday.com board.",
        parametersSchema: {
          type: "object",
          properties: {
            board_id: { type: "integer", description: "Board ID." },
            limit: { type: "integer", description: "Max items per page (default 25).", default: 25 },
            page: { type: "integer", description: "Page number (default 1).", default: 1 },
          },
          required: ["board_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { board_id: number; limit?: number; page?: number };
          const result = await client.listItems(p.board_id, p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "monday_get_item",
      {
        displayName: "Get Item",
        description: "Get full details for a monday.com item including column values, subitems, and recent updates.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "integer", description: "Item ID." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { id: number };
          const result = await client.getItem(p.id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "monday_search_items",
      {
        displayName: "Search Items",
        description: "Search items on a monday.com board by name.",
        parametersSchema: {
          type: "object",
          properties: {
            board_id: { type: "integer", description: "Board ID to search within." },
            query: { type: "string", description: "Search query (matches item name)." },
          },
          required: ["board_id", "query"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { board_id: number; query: string };
          const result = await client.searchItems(p.board_id, p.query);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "monday_create_item",
      {
        displayName: "Create Item",
        description: "Create a new item (task) on a monday.com board.",
        parametersSchema: {
          type: "object",
          properties: {
            board_id: { type: "integer", description: "Board ID." },
            group_id: { type: "string", description: "Group ID within the board (optional)." },
            name: { type: "string", description: "Item name." },
            column_values: {
              type: "object",
              description: "Column values as an object mapping column IDs to values.",
              additionalProperties: true,
            },
          },
          required: ["board_id", "name"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { board_id: number; group_id?: string; name: string; column_values?: Record<string, unknown> };
          const result = await client.createItem({
            boardId: p.board_id,
            groupId: p.group_id,
            name: p.name,
            columnValues: p.column_values,
          });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "monday_change_column_value",
      {
        displayName: "Change Column Value",
        description: "Update a single column value for a monday.com item.",
        parametersSchema: {
          type: "object",
          properties: {
            item_id: { type: "integer", description: "Item ID." },
            board_id: { type: "integer", description: "Board ID." },
            column_id: { type: "string", description: "Column ID to update." },
            value: { type: "string", description: "New value (as a simple string)." },
          },
          required: ["item_id", "board_id", "column_id", "value"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { item_id: number; board_id: number; column_id: string; value: string };
          const result = await client.changeColumnValue({
            itemId: p.item_id,
            boardId: p.board_id,
            columnId: p.column_id,
            value: p.value,
          });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "monday_add_update",
      {
        displayName: "Add Update",
        description: "Post an update (comment) on a monday.com item.",
        parametersSchema: {
          type: "object",
          properties: {
            item_id: { type: "integer", description: "Item ID to comment on." },
            body: { type: "string", description: "Update text." },
          },
          required: ["item_id", "body"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { item_id: number; body: string };
          const result = await client.addUpdate(p.item_id, p.body);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "monday_list_workspaces",
      {
        displayName: "List Workspaces",
        description: "List all workspaces in the monday.com account.",
        parametersSchema: {
          type: "object",
          properties: {},
        },
      },
      async (): Promise<ToolResult> => {
        try {
          const result = await client.listWorkspaces();
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "monday_get_users",
      {
        displayName: "Get Users",
        description: "List users in the monday.com account.",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Max users to return (default 50).", default: 50 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { limit?: number };
          const result = await client.getUsers(p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );
  },
});

runWorker(plugin, import.meta.url);
