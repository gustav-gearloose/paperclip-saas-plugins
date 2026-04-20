import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.toggl",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Toggl Track",
  description: "Track time, manage projects and clients, and generate reports in Toggl Track.",
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
        title: "Toggl API Token (secret ref)",
        description: "UUID of a Paperclip secret holding a Toggl Track API token.",
        default: "",
      },
    },
    required: ["apiTokenRef"],
  },
  tools: [
    {
      name: "toggl_get_me",
      displayName: "Get Current User",
      description: "Get the current authenticated Toggl user profile.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "toggl_get_workspaces",
      displayName: "Get Workspaces",
      description: "List all workspaces the authenticated user belongs to.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "toggl_get_time_entries",
      displayName: "Get Time Entries",
      description: "List time entries for the current user, optionally filtered by date range.",
      parametersSchema: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "ISO 8601 start date (e.g. 2024-01-01)." },
          end_date: { type: "string", description: "ISO 8601 end date (e.g. 2024-01-31)." },
        },
      },
    },
    {
      name: "toggl_get_current_entry",
      displayName: "Get Current Time Entry",
      description: "Get the currently running time entry, if any.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "toggl_start_time_entry",
      displayName: "Start Time Entry",
      description: "Start a new running time entry in the given workspace.",
      parametersSchema: {
        type: "object",
        properties: {
          workspace_id: { type: "number", description: "ID of the workspace to log time in." },
          description: { type: "string", description: "Description for the time entry." },
          project_id: { type: "number", description: "Optional project to assign the entry to." },
          tags: { type: "array", items: { type: "string" }, description: "Optional tags to attach." },
          billable: { type: "boolean", description: "Whether the entry is billable." },
        },
        required: ["workspace_id"],
      },
    },
    {
      name: "toggl_stop_time_entry",
      displayName: "Stop Time Entry",
      description: "Stop a running time entry.",
      parametersSchema: {
        type: "object",
        properties: {
          workspace_id: { type: "number", description: "ID of the workspace the entry belongs to." },
          time_entry_id: { type: "number", description: "ID of the running time entry to stop." },
        },
        required: ["workspace_id", "time_entry_id"],
      },
    },
    {
      name: "toggl_create_time_entry",
      displayName: "Create Time Entry",
      description: "Create a completed (historical) time entry with a known start and duration.",
      parametersSchema: {
        type: "object",
        properties: {
          workspace_id: { type: "number", description: "ID of the workspace to log time in." },
          start: { type: "string", description: "ISO 8601 start datetime of the entry." },
          duration_seconds: { type: "number", description: "Duration of the entry in seconds." },
          description: { type: "string", description: "Description for the time entry." },
          project_id: { type: "number", description: "Optional project to assign the entry to." },
          tags: { type: "array", items: { type: "string" }, description: "Optional tags to attach." },
          billable: { type: "boolean", description: "Whether the entry is billable." },
        },
        required: ["workspace_id", "start", "duration_seconds"],
      },
    },
    {
      name: "toggl_get_projects",
      displayName: "Get Projects",
      description: "List projects in a workspace, optionally filtering by active status.",
      parametersSchema: {
        type: "object",
        properties: {
          workspace_id: { type: "number", description: "ID of the workspace to list projects from." },
          active: { type: "boolean", description: "If true, return only active projects; false for archived." },
        },
        required: ["workspace_id"],
      },
    },
    {
      name: "toggl_create_project",
      displayName: "Create Project",
      description: "Create a new project in a workspace.",
      parametersSchema: {
        type: "object",
        properties: {
          workspace_id: { type: "number", description: "ID of the workspace to create the project in." },
          name: { type: "string", description: "Name of the new project." },
          client_id: { type: "number", description: "Optional client to associate the project with." },
          color: { type: "string", description: "Hex color string for the project (e.g. #e36a00)." },
          billable: { type: "boolean", description: "Whether the project is billable." },
          active: { type: "boolean", description: "Whether the project is active (default true)." },
        },
        required: ["workspace_id", "name"],
      },
    },
    {
      name: "toggl_get_clients",
      displayName: "Get Clients",
      description: "List all clients in a workspace.",
      parametersSchema: {
        type: "object",
        properties: {
          workspace_id: { type: "number", description: "ID of the workspace to list clients from." },
        },
        required: ["workspace_id"],
      },
    },
    {
      name: "toggl_get_summary_report",
      displayName: "Get Summary Report",
      description: "Get a summary report of tracked time for a workspace, grouped by projects by default.",
      parametersSchema: {
        type: "object",
        properties: {
          workspace_id: { type: "number", description: "ID of the workspace to report on." },
          start_date: { type: "string", description: "Report start date in YYYY-MM-DD format." },
          end_date: { type: "string", description: "Report end date in YYYY-MM-DD format." },
          group_by: { type: "string", description: "Grouping dimension: 'projects', 'clients', or 'users'." },
        },
        required: ["workspace_id", "start_date", "end_date"],
      },
    },
  ],
};

export default manifest;
