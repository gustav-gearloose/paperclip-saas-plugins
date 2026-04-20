import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { ClockifyClient } from "./clockify-client.js";

interface ClockifyConfig {
  apiKeyRef?: string;
}

function errResult(e: unknown): ToolResult {
  return { error: e instanceof Error ? e.message : String(e) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const cfg = await ctx.config.get() as ClockifyConfig;
    const apiKey = await ctx.secrets.resolve(cfg.apiKeyRef ?? "");
    const client = new ClockifyClient(apiKey);

    ctx.tools.register(
      "clockify_get_user",
      {
        displayName: "Get Current User",
        description: "Get the authenticated Clockify user profile.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try { return { content: JSON.stringify(await client.getUser()) }; }
        catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "clockify_list_workspaces",
      {
        displayName: "List Workspaces",
        description: "List all Clockify workspaces the user belongs to.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try { return { content: JSON.stringify(await client.listWorkspaces()) }; }
        catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "clockify_list_projects",
      {
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
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as { workspace_id: string; page?: number; page_size?: number };
          return { content: JSON.stringify(await client.listProjects(p.workspace_id, { page: p.page, pageSize: p.page_size })) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "clockify_list_clients",
      {
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
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as { workspace_id: string };
          return { content: JSON.stringify(await client.listClients(p.workspace_id)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "clockify_list_tags",
      {
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
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as { workspace_id: string };
          return { content: JSON.stringify(await client.listTags(p.workspace_id)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "clockify_list_users",
      {
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
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as { workspace_id: string };
          return { content: JSON.stringify(await client.listUsers(p.workspace_id)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "clockify_list_time_entries",
      {
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
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as { workspace_id: string; user_id: string; start?: string; end?: string; page?: number; page_size?: number };
          return { content: JSON.stringify(await client.listTimeEntries(p.workspace_id, p.user_id, { start: p.start, end: p.end, page: p.page, pageSize: p.page_size })) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "clockify_add_time_entry",
      {
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
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as { workspace_id: string; start: string; end?: string; description?: string; project_id?: string; tag_ids?: string[] };
          return { content: JSON.stringify(await client.addTimeEntry(p.workspace_id, { start: p.start, end: p.end, description: p.description, projectId: p.project_id, tagIds: p.tag_ids })) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "clockify_delete_time_entry",
      {
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
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as { workspace_id: string; entry_id: string };
          await client.deleteTimeEntry(p.workspace_id, p.entry_id);
          return { content: JSON.stringify({ deleted: true, entry_id: p.entry_id }) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "clockify_get_summary_report",
      {
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
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as { workspace_id: string; date_range_start: string; date_range_end: string; groups?: string[] };
          return { content: JSON.stringify(await client.getSummaryReport(p.workspace_id, { dateRangeStart: p.date_range_start, dateRangeEnd: p.date_range_end, summaryFilter: p.groups ? { groups: p.groups } : undefined })) };
        } catch (e) { return errResult(e); }
      },
    );
  },
});

runWorker(plugin, import.meta.url);
