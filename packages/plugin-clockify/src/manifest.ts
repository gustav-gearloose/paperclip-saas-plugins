import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.clockify",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Clockify",
  description: "Time tracking — workspaces, projects, clients, users, tags, time entries, and summary reports.",
  author: "Gearloose",
  categories: ["connector"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "instance.settings.register",
  ],
  instanceConfigSchema: {
    apiKeyRef: {
      type: "string",
      format: "secret-ref",
      description: "Clockify API key (from Profile Settings → API).",
    },
  },
  entrypoints: {
    worker: "./worker.js",
  },
  tools: [
    {
      name: "clockify_get_user",
      displayName: "Get Current User",
      description: "Get the authenticated Clockify user profile.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "clockify_list_workspaces",
      displayName: "List Workspaces",
      description: "List all Clockify workspaces the user belongs to.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "clockify_list_projects",
      displayName: "List Projects",
      description: "List projects in a Clockify workspace.",
      parametersSchema: {
        type: "object",
        properties: {
          workspace_id: { type: "string", description: "Workspace ID." },
          page: { type: "number", description: "Page number (default 1)." },
          page_size: { type: "number", description: "Results per page (default 50, max 5000)." },
        },
        required: ["workspace_id"],
      },
    },
    {
      name: "clockify_list_clients",
      displayName: "List Clients",
      description: "List clients in a Clockify workspace.",
      parametersSchema: {
        type: "object",
        properties: {
          workspace_id: { type: "string", description: "Workspace ID." },
        },
        required: ["workspace_id"],
      },
    },
    {
      name: "clockify_list_tags",
      displayName: "List Tags",
      description: "List tags in a Clockify workspace.",
      parametersSchema: {
        type: "object",
        properties: {
          workspace_id: { type: "string", description: "Workspace ID." },
        },
        required: ["workspace_id"],
      },
    },
    {
      name: "clockify_list_users",
      displayName: "List Users",
      description: "List members of a Clockify workspace.",
      parametersSchema: {
        type: "object",
        properties: {
          workspace_id: { type: "string", description: "Workspace ID." },
        },
        required: ["workspace_id"],
      },
    },
    {
      name: "clockify_list_time_entries",
      displayName: "List Time Entries",
      description: "List time entries for a user in a workspace, optionally filtered by date range.",
      parametersSchema: {
        type: "object",
        properties: {
          workspace_id: { type: "string", description: "Workspace ID." },
          user_id: { type: "string", description: "User ID (use clockify_get_user to find yours)." },
          start: { type: "string", description: "ISO 8601 start datetime e.g. 2024-01-01T00:00:00Z (optional)." },
          end: { type: "string", description: "ISO 8601 end datetime (optional)." },
          page: { type: "number", description: "Page number (default 1)." },
          page_size: { type: "number", description: "Results per page (default 50)." },
        },
        required: ["workspace_id", "user_id"],
      },
    },
    {
      name: "clockify_add_time_entry",
      displayName: "Add Time Entry",
      description: "Log a new time entry in a Clockify workspace.",
      parametersSchema: {
        type: "object",
        properties: {
          workspace_id: { type: "string", description: "Workspace ID." },
          start: { type: "string", description: "ISO 8601 start datetime e.g. 2024-06-01T09:00:00Z." },
          end: { type: "string", description: "ISO 8601 end datetime (omit to start a running timer)." },
          description: { type: "string", description: "Description of the work done (optional)." },
          project_id: { type: "string", description: "Project ID to attach the entry to (optional)." },
          tag_ids: { type: "array", items: { type: "string" }, description: "Array of tag IDs (optional)." },
        },
        required: ["workspace_id", "start"],
      },
    },
    {
      name: "clockify_delete_time_entry",
      displayName: "Delete Time Entry",
      description: "Delete a time entry by ID.",
      parametersSchema: {
        type: "object",
        properties: {
          workspace_id: { type: "string", description: "Workspace ID." },
          entry_id: { type: "string", description: "Time entry ID to delete." },
        },
        required: ["workspace_id", "entry_id"],
      },
    },
    {
      name: "clockify_get_summary_report",
      displayName: "Get Summary Report",
      description: "Get a summary report of tracked time for a date range, grouped by project or user.",
      parametersSchema: {
        type: "object",
        properties: {
          workspace_id: { type: "string", description: "Workspace ID." },
          date_range_start: { type: "string", description: "ISO 8601 start date e.g. 2024-01-01T00:00:00Z." },
          date_range_end: { type: "string", description: "ISO 8601 end date e.g. 2024-01-31T23:59:59Z." },
          groups: {
            type: "array",
            items: { type: "string" },
            description: "Grouping fields: PROJECT, CLIENT, USER, TAG, TASK (optional, defaults to PROJECT).",
          },
        },
        required: ["workspace_id", "date_range_start", "date_range_end"],
      },
    },
  ],
};

export default manifest;
