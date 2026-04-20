import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.clickup",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "ClickUp",
  description: "ClickUp project management — workspaces, spaces, folders, lists, and tasks.",
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
        description: "UUID of a Paperclip secret holding your ClickUp personal API token.",
        default: "",
      },
    },
    required: ["apiTokenRef"],
  },
  tools: [
    {
      name: "clickup_list_workspaces",
      displayName: "List Workspaces",
      description: "List all ClickUp workspaces (teams) the authenticated user has access to.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "clickup_list_spaces",
      displayName: "List Spaces",
      description: "List all spaces in a ClickUp workspace.",
      parametersSchema: {
        type: "object",
        properties: {
          workspace_id: { type: "string", description: "ClickUp workspace (team) ID." },
        },
        required: ["workspace_id"],
      },
    },
    {
      name: "clickup_list_lists",
      displayName: "List Lists",
      description: "List all lists in a ClickUp space or folder.",
      parametersSchema: {
        type: "object",
        properties: {
          space_id: { type: "string", description: "ClickUp space ID (lists directly in space)." },
          folder_id: { type: "string", description: "ClickUp folder ID (lists inside folder). Takes priority over space_id." },
        },
      },
    },
    {
      name: "clickup_list_tasks",
      displayName: "List Tasks",
      description: "List tasks in a ClickUp list, optionally filtered by assignee or status.",
      parametersSchema: {
        type: "object",
        properties: {
          list_id: { type: "string", description: "ClickUp list ID." },
          status: { type: "string", description: "Filter by task status (e.g. open, in progress, closed)." },
          assignee: { type: "string", description: "Filter by assignee user ID." },
          page: { type: "integer", description: "Page number for pagination (default 0).", default: 0 },
        },
        required: ["list_id"],
      },
    },
    {
      name: "clickup_get_task",
      displayName: "Get Task",
      description: "Get full details for a specific ClickUp task by ID.",
      parametersSchema: {
        type: "object",
        properties: {
          task_id: { type: "string", description: "ClickUp task ID." },
        },
        required: ["task_id"],
      },
    },
    {
      name: "clickup_create_task",
      displayName: "Create Task",
      description: "Create a new task in a ClickUp list.",
      parametersSchema: {
        type: "object",
        properties: {
          list_id: { type: "string", description: "ClickUp list ID to create the task in." },
          name: { type: "string", description: "Task name." },
          description: { type: "string", description: "Task description (markdown supported)." },
          status: { type: "string", description: "Task status (must match a status in the list)." },
          priority: { type: "integer", description: "Priority: 1 (urgent), 2 (high), 3 (normal), 4 (low)." },
          due_date: { type: "string", description: "Due date as Unix timestamp in milliseconds." },
          assignees: { type: "array", items: { type: "integer" }, description: "List of user IDs to assign." },
        },
        required: ["list_id", "name"],
      },
    },
    {
      name: "clickup_update_task",
      displayName: "Update Task",
      description: "Update a ClickUp task — rename, change status, priority, due date, or description.",
      parametersSchema: {
        type: "object",
        properties: {
          task_id: { type: "string", description: "ClickUp task ID." },
          name: { type: "string", description: "New task name." },
          description: { type: "string", description: "New task description." },
          status: { type: "string", description: "New task status." },
          priority: { type: "integer", description: "New priority: 1 (urgent), 2 (high), 3 (normal), 4 (low)." },
          due_date: { type: "string", description: "New due date as Unix timestamp in milliseconds." },
        },
        required: ["task_id"],
      },
    },
    {
      name: "clickup_add_comment",
      displayName: "Add Task Comment",
      description: "Add a comment to a ClickUp task.",
      parametersSchema: {
        type: "object",
        properties: {
          task_id: { type: "string", description: "ClickUp task ID." },
          comment_text: { type: "string", description: "Comment text (markdown supported)." },
        },
        required: ["task_id", "comment_text"],
      },
    },
    {
      name: "clickup_search_tasks",
      displayName: "Search Tasks",
      description: "Search tasks across a ClickUp workspace by query string.",
      parametersSchema: {
        type: "object",
        properties: {
          workspace_id: { type: "string", description: "ClickUp workspace ID to search in." },
          query: { type: "string", description: "Search query string." },
        },
        required: ["workspace_id", "query"],
      },
    },
  ],
};

export default manifest;
