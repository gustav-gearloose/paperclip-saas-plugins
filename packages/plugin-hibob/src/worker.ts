import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { HiBobClient } from "./hibob-client.js";

interface HiBobConfig {
  serviceUserIdRef?: string;
  tokenRef?: string;
}

function errResult(e: unknown): ToolResult {
  return { error: e instanceof Error ? e.message : String(e) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const cfg = await ctx.config.get() as HiBobConfig;
    const serviceUserId = await ctx.secrets.resolve(cfg.serviceUserIdRef ?? "");
    const token = await ctx.secrets.resolve(cfg.tokenRef ?? "");
    const client = new HiBobClient(serviceUserId, token);

    ctx.tools.register(
      "hibob_list_employees",
      { displayName: "List Employees", description: "List all employees with optional pagination.", parametersSchema: { type: "object", properties: { offset: { type: "number" }, limit: { type: "number" } } } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = (params ?? {}) as { offset?: number; limit?: number };
          return { content: JSON.stringify(await client.listEmployees(p)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "hibob_get_employee",
      { displayName: "Get Employee", description: "Get a single employee by ID.", parametersSchema: { type: "object", properties: { employeeId: { type: "string" } }, required: ["employeeId"] } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const { employeeId } = params as { employeeId: string };
          return { content: JSON.stringify(await client.getEmployee(employeeId)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "hibob_create_employee",
      { displayName: "Create Employee", description: "Create a new employee record.", parametersSchema: { type: "object", properties: { firstName: { type: "string" }, surname: { type: "string" }, email: { type: "string" }, site: { type: "string" }, department: { type: "string" }, startDate: { type: "string" } }, required: ["firstName", "surname", "email"] } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          return { content: JSON.stringify(await client.createEmployee(params as Record<string, unknown>)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "hibob_get_directory",
      { displayName: "Get Employee Directory", description: "Fetch a searchable directory of all employees.", parametersSchema: { type: "object", properties: {} } },
      async (): Promise<ToolResult> => {
        try {
          return { content: JSON.stringify(await client.getDirectory()) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "hibob_list_departments",
      { displayName: "List Departments", description: "List all departments in the company.", parametersSchema: { type: "object", properties: {} } },
      async (): Promise<ToolResult> => {
        try {
          return { content: JSON.stringify(await client.listDepartments()) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "hibob_list_time_off_requests",
      { displayName: "List Time-Off Requests", description: "List time-off requests.", parametersSchema: { type: "object", properties: { employeeId: { type: "string" }, from: { type: "string" }, to: { type: "string" } } } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = (params ?? {}) as { employeeId?: string; from?: string; to?: string };
          return { content: JSON.stringify(await client.listTimeOffRequests(p)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "hibob_submit_time_off_request",
      { displayName: "Submit Time-Off Request", description: "Submit a time-off request for an employee.", parametersSchema: { type: "object", properties: { employeeId: { type: "string" }, policyType: { type: "string" }, startDate: { type: "string" }, endDate: { type: "string" }, requestRangeType: { type: "string" }, dayPortion: { type: "string" } }, required: ["employeeId", "policyType", "startDate", "endDate"] } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const { employeeId, ...rest } = params as { employeeId: string; [k: string]: unknown };
          return { content: JSON.stringify(await client.submitTimeOffRequest(employeeId, rest)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "hibob_get_whos_out",
      { displayName: "Who's Out", description: "Get employees currently out or out within a date range.", parametersSchema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } } } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = (params ?? {}) as { from?: string; to?: string };
          return { content: JSON.stringify(await client.getWhosOut(p)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "hibob_list_open_tasks",
      { displayName: "List Open Tasks", description: "List open onboarding/offboarding tasks.", parametersSchema: { type: "object", properties: {} } },
      async (): Promise<ToolResult> => {
        try {
          return { content: JSON.stringify(await client.listOpenTasks()) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "hibob_get_employee_documents",
      { displayName: "Get Employee Documents", description: "Retrieve shared documents for a specific employee.", parametersSchema: { type: "object", properties: { employeeId: { type: "string" } }, required: ["employeeId"] } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const { employeeId } = params as { employeeId: string };
          return { content: JSON.stringify(await client.getEmployeeDocuments(employeeId)) };
        } catch (e) { return errResult(e); }
      },
    );
  },
});

runWorker(plugin, import.meta.url);
