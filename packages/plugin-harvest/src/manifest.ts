import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.harvest",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Harvest",
  description: "Harvest time tracking — log time entries, list projects, clients, users, and invoices.",
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
        title: "Personal Access Token (secret ref)",
        description: "UUID of a Paperclip secret holding your Harvest personal access token.",
        default: "",
      },
      accountId: {
        type: "string",
        title: "Harvest Account ID",
        description: "Your Harvest account ID (found at id.getharvest.com after logging in).",
        default: "",
      },
    },
    required: ["apiTokenRef", "accountId"],
  },
  tools: [
    {
      name: "harvest_list_time_entries",
      displayName: "List Time Entries",
      description: "List time entries, optionally filtered by project, user, client, or date range.",
      parametersSchema: {
        type: "object",
        properties: {
          project_id: { type: "integer", description: "Filter by project ID." },
          user_id: { type: "integer", description: "Filter by user ID." },
          client_id: { type: "integer", description: "Filter by client ID." },
          from: { type: "string", description: "Start date (YYYY-MM-DD)." },
          to: { type: "string", description: "End date (YYYY-MM-DD)." },
          is_billable: { type: "boolean", description: "Filter billable or non-billable entries." },
          per_page: { type: "integer", description: "Results per page (max 100, default 100).", default: 100 },
          page: { type: "integer", description: "Page number (default 1).", default: 1 },
        },
      },
    },
    {
      name: "harvest_create_time_entry",
      displayName: "Create Time Entry",
      description: "Log a new time entry in Harvest.",
      parametersSchema: {
        type: "object",
        properties: {
          project_id: { type: "integer", description: "Project ID to log time against." },
          task_id: { type: "integer", description: "Task ID within the project." },
          spent_date: { type: "string", description: "Date of the time entry (YYYY-MM-DD)." },
          hours: { type: "number", description: "Hours worked (decimal, e.g. 1.5)." },
          notes: { type: "string", description: "Notes or description for the time entry." },
          user_id: { type: "integer", description: "User ID to log for (defaults to authenticated user)." },
        },
        required: ["project_id", "task_id", "spent_date"],
      },
    },
    {
      name: "harvest_update_time_entry",
      displayName: "Update Time Entry",
      description: "Update an existing Harvest time entry.",
      parametersSchema: {
        type: "object",
        properties: {
          time_entry_id: { type: "integer", description: "Time entry ID to update." },
          project_id: { type: "integer", description: "New project ID." },
          task_id: { type: "integer", description: "New task ID." },
          spent_date: { type: "string", description: "New date (YYYY-MM-DD)." },
          hours: { type: "number", description: "New hours worked." },
          notes: { type: "string", description: "New notes." },
        },
        required: ["time_entry_id"],
      },
    },
    {
      name: "harvest_list_projects",
      displayName: "List Projects",
      description: "List all active Harvest projects.",
      parametersSchema: {
        type: "object",
        properties: {
          client_id: { type: "integer", description: "Filter projects by client ID." },
          is_active: { type: "boolean", description: "Filter by active status (default true).", default: true },
          per_page: { type: "integer", description: "Results per page (max 100).", default: 100 },
        },
      },
    },
    {
      name: "harvest_list_clients",
      displayName: "List Clients",
      description: "List all clients in Harvest.",
      parametersSchema: {
        type: "object",
        properties: {
          is_active: { type: "boolean", description: "Filter by active status.", default: true },
          per_page: { type: "integer", description: "Results per page (max 100).", default: 100 },
        },
      },
    },
    {
      name: "harvest_list_tasks",
      displayName: "List Tasks",
      description: "List all tasks in Harvest.",
      parametersSchema: {
        type: "object",
        properties: {
          is_active: { type: "boolean", description: "Filter by active status.", default: true },
          per_page: { type: "integer", description: "Results per page (max 100).", default: 100 },
        },
      },
    },
    {
      name: "harvest_list_users",
      displayName: "List Users",
      description: "List all users in the Harvest account.",
      parametersSchema: {
        type: "object",
        properties: {
          is_active: { type: "boolean", description: "Filter by active status.", default: true },
          per_page: { type: "integer", description: "Results per page (max 100).", default: 100 },
        },
      },
    },
    {
      name: "harvest_list_invoices",
      displayName: "List Invoices",
      description: "List invoices in Harvest, optionally filtered by client or status.",
      parametersSchema: {
        type: "object",
        properties: {
          client_id: { type: "integer", description: "Filter by client ID." },
          state: { type: "string", description: "Invoice state: draft, open, paid, closed." },
          from: { type: "string", description: "Start date filter (YYYY-MM-DD)." },
          to: { type: "string", description: "End date filter (YYYY-MM-DD)." },
          per_page: { type: "integer", description: "Results per page (max 100).", default: 100 },
        },
      },
    },
    {
      name: "harvest_get_me",
      displayName: "Get Current User",
      description: "Get details about the currently authenticated Harvest user.",
      parametersSchema: { type: "object", properties: {} },
    },
  ],
};

export default manifest;
