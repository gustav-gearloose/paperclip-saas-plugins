import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.asana",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Asana",
  description: "Access Asana project management: workspaces, projects, tasks, sections, and users.",
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
      accessTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "Access Token (secret ref)",
        description: "UUID of a Paperclip secret holding your Asana personal access token.",
        default: "",
      },
    },
    required: ["accessTokenRef"],
  },
  tools: [
    {
      name: "asana_get_me",
      displayName: "Get Me",
      description: "Get the authenticated Asana user's profile and workspace memberships.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "asana_list_workspaces",
      displayName: "List Workspaces",
      description: "List all Asana workspaces and organizations the user belongs to.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "asana_list_projects",
      displayName: "List Projects",
      description: "List projects in an Asana workspace.",
      parametersSchema: {
        type: "object",
        properties: {
          workspace_gid: { type: "string", description: "Workspace GID." },
          archived: { type: "boolean", description: "Include archived projects (default false).", default: false },
          limit: { type: "integer", description: "Max results (default 100).", default: 100 },
        },
        required: ["workspace_gid"],
      },
    },
    {
      name: "asana_get_project",
      displayName: "Get Project",
      description: "Get full details for a specific Asana project.",
      parametersSchema: {
        type: "object",
        properties: {
          project_gid: { type: "string", description: "Project GID." },
        },
        required: ["project_gid"],
      },
    },
    {
      name: "asana_list_tasks",
      displayName: "List Tasks",
      description: "List tasks in an Asana project.",
      parametersSchema: {
        type: "object",
        properties: {
          project_gid: { type: "string", description: "Project GID." },
          completed: { type: "boolean", description: "Filter by completion status (omit for all)." },
          limit: { type: "integer", description: "Max results (default 100).", default: 100 },
        },
        required: ["project_gid"],
      },
    },
    {
      name: "asana_get_task",
      displayName: "Get Task",
      description: "Get full details for a specific Asana task including subtasks and recent comments.",
      parametersSchema: {
        type: "object",
        properties: {
          task_gid: { type: "string", description: "Task GID." },
        },
        required: ["task_gid"],
      },
    },
    {
      name: "asana_search_tasks",
      displayName: "Search Tasks",
      description: "Search tasks in an Asana workspace by text.",
      parametersSchema: {
        type: "object",
        properties: {
          workspace_gid: { type: "string", description: "Workspace GID to search within." },
          text: { type: "string", description: "Search query." },
          completed: { type: "boolean", description: "Filter by completion status (omit for all)." },
          limit: { type: "integer", description: "Max results (default 20).", default: 20 },
        },
        required: ["workspace_gid", "text"],
      },
    },
    {
      name: "asana_create_task",
      displayName: "Create Task",
      description: "Create a new task in an Asana workspace, optionally assigned to a project.",
      parametersSchema: {
        type: "object",
        properties: {
          workspace_gid: { type: "string", description: "Workspace GID." },
          project_gid: { type: "string", description: "Project GID to add the task to (optional)." },
          name: { type: "string", description: "Task name." },
          notes: { type: "string", description: "Task description." },
          assignee_gid: { type: "string", description: "Assignee user GID (optional)." },
          due_on: { type: "string", description: "Due date in YYYY-MM-DD format (optional)." },
        },
        required: ["workspace_gid", "name"],
      },
    },
    {
      name: "asana_update_task",
      displayName: "Update Task",
      description: "Update an Asana task (name, notes, due_on, assignee, completed, etc.).",
      parametersSchema: {
        type: "object",
        properties: {
          task_gid: { type: "string", description: "Task GID." },
          name: { type: "string", description: "New task name." },
          notes: { type: "string", description: "New task notes." },
          completed: { type: "boolean", description: "Mark as complete or incomplete." },
          due_on: { type: "string", description: "Due date in YYYY-MM-DD format." },
          assignee: { type: "string", description: "Assignee user GID or 'me'." },
        },
        required: ["task_gid"],
      },
    },
    {
      name: "asana_add_task_comment",
      displayName: "Add Task Comment",
      description: "Post a comment (story) on an Asana task.",
      parametersSchema: {
        type: "object",
        properties: {
          task_gid: { type: "string", description: "Task GID." },
          text: { type: "string", description: "Comment text." },
        },
        required: ["task_gid", "text"],
      },
    },
  ],
};

export default manifest;
