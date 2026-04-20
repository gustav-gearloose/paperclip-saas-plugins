import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.podio",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Podio",
  description: "Access Podio workspaces, apps, items, tasks, comments, and search via app credentials.",
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
      clientIdRef: {
        type: "string",
        format: "secret-ref",
        title: "Podio Client ID (secret ref)",
        description: "UUID of a Paperclip secret holding the Podio OAuth2 client ID.",
        default: "",
      },
      clientSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "Podio Client Secret (secret ref)",
        description: "UUID of a Paperclip secret holding the Podio OAuth2 client secret.",
        default: "",
      },
      appId: {
        type: "string",
        title: "Podio App ID",
        description: "The numeric ID of the Podio app to authenticate against.",
        default: "",
      },
      appTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "Podio App Token (secret ref)",
        description: "UUID of a Paperclip secret holding the Podio app token.",
        default: "",
      },
    },
    required: ["clientIdRef", "clientSecretRef", "appId", "appTokenRef"],
  },
  tools: [
    {
      name: "podio_get_app",
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
    {
      name: "podio_get_items",
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
    {
      name: "podio_get_item",
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
    {
      name: "podio_create_item",
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
    {
      name: "podio_update_item",
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
    {
      name: "podio_filter_items",
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
    {
      name: "podio_get_tasks",
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
    {
      name: "podio_create_task",
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
    {
      name: "podio_complete_task",
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
    {
      name: "podio_get_comments",
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
    {
      name: "podio_add_comment",
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
    {
      name: "podio_search",
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
  ],
};

export default manifest;
