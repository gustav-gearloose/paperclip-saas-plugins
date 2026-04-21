import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { HarvestClient } from "./harvest-client.js";

interface HarvestPluginConfig {
  apiTokenRef?: string;
  accountId?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    let cachedClient: HarvestClient | null = null;
    let configError: string | null = null;

    async function getClient(): Promise<HarvestClient | null> {
      if (cachedClient) return cachedClient;
      if (configError) return null;

const config = await ctx.config.get() as HarvestPluginConfig;

      if (!config.apiTokenRef) {
        configError = "Harvest plugin: apiTokenRef is required";
        ctx.logger.warn("config missing");
        return null;
      }
      if (!config.accountId) {
        configError = "Harvest plugin: accountId is required";
        ctx.logger.warn("config missing");
        return null;
      }

      let apiToken: string;
      try {
        apiToken = await ctx.secrets.resolve(config.apiTokenRef);
      } catch (err) {
        configError = `Harvest plugin: failed to resolve apiTokenRef: ${err instanceof Error ? err.message : String(err)}`;
        ctx.logger.warn("config missing");
        return null;
      }

      ctx.logger.info("Harvest plugin: secret resolved, registering tools");
      cachedClient = new HarvestClient(apiToken, config.accountId);
      return cachedClient;
    }

    ctx.tools.register(
      "harvest_list_time_entries",
      {
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
      async (params): Promise<ToolResult> => {
        const { project_id, user_id, client_id, from, to, is_billable, per_page, page } = params as {
          project_id?: number; user_id?: number; client_id?: number; from?: string; to?: string;
          is_billable?: boolean; per_page?: number; page?: number;
        };
        try {
          const result = await client.listTimeEntries({ project_id, user_id, client_id, from, to, is_billable, per_page, page });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "harvest_create_time_entry",
      {
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
      async (params): Promise<ToolResult> => {
        const { project_id, task_id, spent_date, hours, notes, user_id } = params as {
          project_id: number; task_id: number; spent_date: string; hours?: number; notes?: string; user_id?: number;
        };
        try {
          const body: Record<string, unknown> = { project_id, task_id, spent_date };
          if (hours !== undefined) body.hours = hours;
          if (notes) body.notes = notes;
          if (user_id !== undefined) body.user_id = user_id;
          const result = await client.createTimeEntry(body);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "harvest_update_time_entry",
      {
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
      async (params): Promise<ToolResult> => {
        const { time_entry_id, project_id, task_id, spent_date, hours, notes } = params as {
          time_entry_id: number; project_id?: number; task_id?: number; spent_date?: string; hours?: number; notes?: string;
        };
        try {
          const body: Record<string, unknown> = {};
          if (project_id !== undefined) body.project_id = project_id;
          if (task_id !== undefined) body.task_id = task_id;
          if (spent_date) body.spent_date = spent_date;
          if (hours !== undefined) body.hours = hours;
          if (notes) body.notes = notes;
          const result = await client.updateTimeEntry(time_entry_id, body);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "harvest_list_projects",
      {
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
      async (params): Promise<ToolResult> => {
        const { client_id, is_active, per_page } = params as { client_id?: number; is_active?: boolean; per_page?: number };
        try {
          const result = await client.listProjects({ client_id, is_active, per_page });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "harvest_list_clients",
      {
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
      async (params): Promise<ToolResult> => {
        const { is_active, per_page } = params as { is_active?: boolean; per_page?: number };
        try {
          const result = await client.listClients({ is_active, per_page });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "harvest_list_tasks",
      {
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
      async (params): Promise<ToolResult> => {
        const { is_active, per_page } = params as { is_active?: boolean; per_page?: number };
        try {
          const result = await client.listTasks({ is_active, per_page });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "harvest_list_users",
      {
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
      async (params): Promise<ToolResult> => {
        const { is_active, per_page } = params as { is_active?: boolean; per_page?: number };
        try {
          const result = await client.listUsers({ is_active, per_page });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "harvest_list_invoices",
      {
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
      async (params): Promise<ToolResult> => {
        const { client_id, state, from, to, per_page } = params as {
          client_id?: number; state?: string; from?: string; to?: string; per_page?: number;
        };
        try {
          const result = await client.listInvoices({ client_id, state, from, to, per_page });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "harvest_get_me",
      {
        displayName: "Get Current User",
        description: "Get details about the currently authenticated Harvest user.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.getMe();
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Harvest plugin: all tools registered");
  },
});

runWorker(plugin, import.meta.url);
