import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.todoist",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Todoist",
  description: "Todoist task management — projects, tasks, sections, labels, and comments.",
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
        description: "UUID of a Paperclip secret holding your Todoist API token.",
        default: "",
      },
    },
    required: ["apiTokenRef"],
  },
  tools: [
    {
      name: "todoist_list_projects",
      displayName: "List Projects",
      description: "List all Todoist projects.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "todoist_get_project",
      displayName: "Get Project",
      description: "Get details for a specific Todoist project by ID.",
      parametersSchema: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "Todoist project ID." },
        },
        required: ["project_id"],
      },
    },
    {
      name: "todoist_list_tasks",
      displayName: "List Tasks",
      description: "List tasks, optionally filtered by project, label, or filter expression.",
      parametersSchema: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "Filter tasks by project ID." },
          label: { type: "string", description: "Filter tasks by label name." },
          filter: { type: "string", description: "Todoist filter expression (e.g. 'today', 'overdue', 'p1')." },
          limit: { type: "integer", description: "Max results (default 50).", default: 50 },
        },
      },
    },
    {
      name: "todoist_get_task",
      displayName: "Get Task",
      description: "Get full details for a specific Todoist task by ID.",
      parametersSchema: {
        type: "object",
        properties: {
          task_id: { type: "string", description: "Todoist task ID." },
        },
        required: ["task_id"],
      },
    },
    {
      name: "todoist_create_task",
      displayName: "Create Task",
      description: "Create a new task in Todoist.",
      parametersSchema: {
        type: "object",
        properties: {
          content: { type: "string", description: "Task content (title). Supports Todoist markdown." },
          description: { type: "string", description: "Task description." },
          project_id: { type: "string", description: "Project ID to add the task to (defaults to Inbox)." },
          labels: { type: "array", items: { type: "string" }, description: "Label names to assign." },
          priority: { type: "integer", description: "Priority: 1 (normal) to 4 (urgent).", default: 1 },
          due_string: { type: "string", description: "Natural language due date (e.g. 'tomorrow', 'next Monday', 'June 1')." },
          due_date: { type: "string", description: "Due date in YYYY-MM-DD format." },
        },
        required: ["content"],
      },
    },
    {
      name: "todoist_update_task",
      displayName: "Update Task",
      description: "Update a Todoist task — rename, change priority, due date, or labels.",
      parametersSchema: {
        type: "object",
        properties: {
          task_id: { type: "string", description: "Todoist task ID." },
          content: { type: "string", description: "New task content." },
          description: { type: "string", description: "New task description." },
          labels: { type: "array", items: { type: "string" }, description: "New label names (replaces existing)." },
          priority: { type: "integer", description: "New priority: 1 (normal) to 4 (urgent)." },
          due_string: { type: "string", description: "New due date as natural language." },
          due_date: { type: "string", description: "New due date in YYYY-MM-DD format." },
        },
        required: ["task_id"],
      },
    },
    {
      name: "todoist_close_task",
      displayName: "Close Task",
      description: "Mark a Todoist task as completed.",
      parametersSchema: {
        type: "object",
        properties: {
          task_id: { type: "string", description: "Todoist task ID." },
        },
        required: ["task_id"],
      },
    },
    {
      name: "todoist_add_comment",
      displayName: "Add Comment",
      description: "Add a comment to a Todoist task or project.",
      parametersSchema: {
        type: "object",
        properties: {
          task_id: { type: "string", description: "Task ID to comment on (use this or project_id)." },
          project_id: { type: "string", description: "Project ID to comment on (use this or task_id)." },
          content: { type: "string", description: "Comment text." },
        },
        required: ["content"],
      },
    },
    {
      name: "todoist_list_labels",
      displayName: "List Labels",
      description: "List all personal labels in Todoist.",
      parametersSchema: { type: "object", properties: {} },
    },
  ],
};

export default manifest;
