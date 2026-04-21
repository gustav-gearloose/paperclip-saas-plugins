import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { TogglClient } from "./toggl-client.js";

interface TogglPluginConfig {
  apiTokenRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    let cachedClient: TogglClient | null = null;
    let configError: string | null = null;

    async function getClient(): Promise<TogglClient | null> {
      if (cachedClient) return cachedClient;
      if (configError) return null;

const config = await ctx.config.get() as TogglPluginConfig;
      const { apiTokenRef } = config;

      if (!apiTokenRef) {
        configError = "Toggl plugin: apiTokenRef is required";
        ctx.logger.warn("config missing");
        return null;
      }

      let apiToken: string;
      try {
        apiToken = await ctx.secrets.resolve(apiTokenRef);
      } catch (err) {
        configError = `Toggl plugin: failed to resolve secret: ${err instanceof Error ? err.message : String(err)}`;
        ctx.logger.warn("config missing");
        return null;
      }

      cachedClient = new TogglClient(apiToken);
      return cachedClient;
      ctx.logger.info("Toggl plugin: initialized, registering tools");
    }

    ctx.tools.register(
      "toggl_get_me",
      {
        displayName: "Get Current User",
        description: "Get the current authenticated Toggl user profile.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          return { content: JSON.stringify(await client.getMe(), null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "toggl_get_workspaces",
      {
        displayName: "Get Workspaces",
        description: "List all workspaces the authenticated user belongs to.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          return { content: JSON.stringify(await client.getWorkspaces(), null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "toggl_get_time_entries",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { start_date?: string; end_date?: string };
          return { content: JSON.stringify(await client.getTimeEntries({ startDate: p.start_date, endDate: p.end_date }), null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "toggl_get_current_entry",
      {
        displayName: "Get Current Time Entry",
        description: "Get the currently running time entry, if any.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          return { content: JSON.stringify(await client.getCurrentTimeEntry(), null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "toggl_start_time_entry",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { workspace_id: number; description?: string; project_id?: number; tags?: string[]; billable?: boolean };
          const result = await client.startTimeEntry({
            workspaceId: p.workspace_id,
            description: p.description,
            projectId: p.project_id,
            tags: p.tags,
            billable: p.billable,
          });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "toggl_stop_time_entry",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { workspace_id: number; time_entry_id: number };
          return { content: JSON.stringify(await client.stopTimeEntry(p.workspace_id, p.time_entry_id), null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "toggl_create_time_entry",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { workspace_id: number; start: string; duration_seconds: number; description?: string; project_id?: number; tags?: string[]; billable?: boolean };
          const result = await client.createTimeEntry({
            workspaceId: p.workspace_id,
            start: p.start,
            durationSeconds: p.duration_seconds,
            description: p.description,
            projectId: p.project_id,
            tags: p.tags,
            billable: p.billable,
          });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "toggl_get_projects",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { workspace_id: number; active?: boolean };
          return { content: JSON.stringify(await client.getProjects(p.workspace_id, { active: p.active }), null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "toggl_create_project",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { workspace_id: number; name: string; client_id?: number; color?: string; billable?: boolean; active?: boolean };
          const result = await client.createProject(p.workspace_id, {
            name: p.name,
            clientId: p.client_id,
            color: p.color,
            billable: p.billable,
            active: p.active,
          });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "toggl_get_clients",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { workspace_id: number };
          return { content: JSON.stringify(await client.getClients(p.workspace_id), null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "toggl_get_summary_report",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { workspace_id: number; start_date: string; end_date: string; group_by?: string };
          const result = await client.getSummaryReport(p.workspace_id, {
            startDate: p.start_date,
            endDate: p.end_date,
            groupBy: p.group_by,
          });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
