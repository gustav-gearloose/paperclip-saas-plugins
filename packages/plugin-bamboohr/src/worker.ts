import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { BambooHRClient } from "./bamboohr-client.js";

interface BambooHRPluginConfig {
  apiKeyRef?: string;
  domain?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    let cachedClient: BambooHRClient | null = null;
    let configError: string | null = null;

    async function getClient(): Promise<BambooHRClient | null> {
      if (cachedClient) return cachedClient;
      if (configError) return null;

const config = await ctx.config.get() as BambooHRPluginConfig;
      const { apiKeyRef, domain } = config;

      if (!apiKeyRef || !domain) {
        configError = "BambooHR plugin: apiKeyRef and domain are required";
        ctx.logger.warn("config missing");
        return null;
      }

      let apiKey: string;
      try {
        apiKey = await ctx.secrets.resolve(apiKeyRef);
      } catch (err) {
        configError = `BambooHR plugin: failed to resolve secret: ${err instanceof Error ? err.message : String(err)}`;
        ctx.logger.warn("config missing");
        return null;
      }

      cachedClient = new BambooHRClient(apiKey, domain);
      return cachedClient;
      ctx.logger.info(`BambooHR plugin: initialized for ${domain}.bamboohr.com, registering tools`);
    }

    ctx.tools.register(
      "bamboohr_get_directory",
      {
        displayName: "Get Employee Directory",
        description: "Get the company employee directory with all active employees and their basic info.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.getDirectory();
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "bamboohr_get_employee",
      {
        displayName: "Get Employee",
        description: "Get detailed information about a specific employee by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "integer", description: "Employee ID (use 0 for the API key owner)." },
            fields: { type: "string", description: "Comma-separated field names to return (default: name, title, dept, email, phone, status, hire date)." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.getEmployee(params as { id: number; fields?: string });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "bamboohr_update_employee",
      {
        displayName: "Update Employee",
        description: "Update fields for an existing employee in BambooHR.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "integer", description: "Employee ID to update." },
            firstName: { type: "string", description: "First name." },
            lastName: { type: "string", description: "Last name." },
            jobTitle: { type: "string", description: "Job title." },
            department: { type: "string", description: "Department name." },
            workEmail: { type: "string", description: "Work email address." },
            mobilePhone: { type: "string", description: "Mobile phone number." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { id: number } & Record<string, string>;
          const { id, ...rest } = p;
          const result = await client.updateEmployee(id, rest);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "bamboohr_get_time_off_requests",
      {
        displayName: "Get Time-Off Requests",
        description: "List time-off requests for a date range, optionally filtered by employee or status.",
        parametersSchema: {
          type: "object",
          properties: {
            start: { type: "string", description: "Start date (YYYY-MM-DD)." },
            end: { type: "string", description: "End date (YYYY-MM-DD)." },
            employeeId: { type: "integer", description: "Filter by employee ID." },
            status: { type: "string", enum: ["approved", "requested", "declined", "cancelled"], description: "Filter by status." },
          },
          required: ["start", "end"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.getTimeOffRequests(params as { start: string; end: string; employeeId?: number; status?: string });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "bamboohr_get_time_off_types",
      {
        displayName: "Get Time-Off Types",
        description: "List all time-off types configured in BambooHR (vacation, sick leave, etc.).",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.getTimeOffTypes();
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "bamboohr_get_time_off_balance",
      {
        displayName: "Get Time-Off Balance",
        description: "Get the accrued and remaining time-off balance for an employee.",
        parametersSchema: {
          type: "object",
          properties: {
            employeeId: { type: "integer", description: "Employee ID." },
          },
          required: ["employeeId"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { employeeId: number };
          const result = await client.getTimeOffBalance(p.employeeId);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "bamboohr_add_time_off_request",
      {
        displayName: "Add Time-Off Request",
        description: "Submit a time-off request for an employee.",
        parametersSchema: {
          type: "object",
          properties: {
            employeeId: { type: "integer", description: "Employee ID." },
            timeOffTypeId: { type: "integer", description: "Time-off type ID (from get_time_off_types)." },
            start: { type: "string", description: "Start date (YYYY-MM-DD)." },
            end: { type: "string", description: "End date (YYYY-MM-DD)." },
            status: { type: "string", enum: ["requested", "approved"], description: "Initial status (default: requested)." },
            note: { type: "string", description: "Optional note for the request." },
          },
          required: ["employeeId", "timeOffTypeId", "start", "end"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as {
            employeeId: number;
            timeOffTypeId: number;
            start: string;
            end: string;
            status?: "requested" | "approved";
            note?: string;
          };
          const result = await client.addTimeOffRequest({
            employeeId: p.employeeId,
            timeOffTypeId: p.timeOffTypeId,
            start: p.start,
            end: p.end,
            status: p.status ?? "requested",
            note: p.note,
          });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "bamboohr_whos_out",
      {
        displayName: "Who Is Out",
        description: "See which employees are out of office on a given date or date range.",
        parametersSchema: {
          type: "object",
          properties: {
            start: { type: "string", description: "Start date (YYYY-MM-DD, default: today)." },
            end: { type: "string", description: "End date (YYYY-MM-DD, default: today)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.whoIsOut(params as { start?: string; end?: string });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "bamboohr_run_report",
      {
        displayName: "Run Custom Report",
        description: "Run a custom report to fetch any combination of employee fields.",
        parametersSchema: {
          type: "object",
          properties: {
            fields: {
              type: "array",
              items: { type: "string" },
              description: "List of field names to include in the report (e.g. ['firstName','lastName','department','jobTitle','workEmail']).",
            },
          },
          required: ["fields"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { fields: string[] };
          const result = await client.runCustomReport({ fields: p.fields });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "bamboohr_list_departments",
      {
        displayName: "List Departments",
        description: "List all departments configured in BambooHR.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.listDepartments();
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("BambooHR plugin ready — 10 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "BambooHR plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
