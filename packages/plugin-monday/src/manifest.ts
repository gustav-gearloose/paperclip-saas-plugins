import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.monday",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "monday.com",
  description: "Access monday.com work management: boards, items, groups, updates, users, and workspaces.",
  author: "Gearloose",
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
      apiTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "API Token (secret ref)",
        description: "UUID of a Paperclip secret holding your monday.com API token.",
        default: "",
      },
    },
    required: ["apiTokenRef"],
  },
  tools: [
    {
      name: "monday_list_boards",
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
    {
      name: "monday_get_board",
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
    {
      name: "monday_list_items",
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
    {
      name: "monday_get_item",
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
    {
      name: "monday_search_items",
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
    {
      name: "monday_create_item",
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
    {
      name: "monday_change_column_value",
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
    {
      name: "monday_add_update",
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
    {
      name: "monday_list_workspaces",
      displayName: "List Workspaces",
      description: "List all workspaces in the monday.com account.",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "monday_get_users",
      displayName: "Get Users",
      description: "List users in the monday.com account.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Max users to return (default 50).", default: 50 },
        },
      },
    },
  ],
};

export default manifest;
