import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { PlandayClient } from "./planday-client.js";

interface PlandayConfig {
  clientIdRef?: string;
  refreshTokenRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const cfg = await ctx.config.get() as PlandayConfig;

    const [clientId, refreshToken] = await Promise.all([
      ctx.secrets.resolve(cfg.clientIdRef ?? ""),
      ctx.secrets.resolve(cfg.refreshTokenRef ?? ""),
    ]);

    const client = new PlandayClient(clientId, refreshToken);

    ctx.tools.register(
      "planday_list_employees",
      {
        displayName: "List Employees",
        description: "List employees in the Planday account.",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Max employees to return (default 50)." },
            offset: { type: "number", description: "Pagination offset (default 0)." },
          },
        },
      },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as { limit?: number; offset?: number };
          const data = await client.listEmployees(p.limit, p.offset);
          return { content: JSON.stringify(data) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "planday_get_employee",
      {
        displayName: "Get Employee",
        description: "Get details for a specific employee by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "number", description: "Employee ID." },
          },
          required: ["id"],
        },
      },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as { id: number };
          const data = await client.getEmployee(p.id);
          return { content: JSON.stringify(data) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "planday_list_employee_groups",
      {
        displayName: "List Employee Groups",
        description: "List all employee groups in Planday.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const data = await client.listEmployeeGroups();
          return { content: JSON.stringify(data) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "planday_list_shifts",
      {
        displayName: "List Shifts",
        description: "List scheduled shifts within a date range.",
        parametersSchema: {
          type: "object",
          properties: {
            from: { type: "string", description: "Start date (YYYY-MM-DD)." },
            to: { type: "string", description: "End date (YYYY-MM-DD)." },
            departmentId: { type: "number", description: "Filter by department ID (optional)." },
          },
          required: ["from", "to"],
        },
      },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as { from: string; to: string; departmentId?: number };
          const data = await client.listShifts(p.from, p.to, p.departmentId);
          return { content: JSON.stringify(data) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "planday_get_shift",
      {
        displayName: "Get Shift",
        description: "Get details for a specific shift by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "number", description: "Shift ID." },
          },
          required: ["id"],
        },
      },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as { id: number };
          const data = await client.getShift(p.id);
          return { content: JSON.stringify(data) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "planday_create_shift",
      {
        displayName: "Create Shift",
        description: "Create a new shift in the schedule.",
        parametersSchema: {
          type: "object",
          properties: {
            departmentId: { type: "number", description: "Department ID for the shift." },
            employeeId: { type: "number", description: "Employee ID to assign the shift to (optional)." },
            startDateTime: { type: "string", description: "Shift start (ISO 8601, e.g. 2025-06-01T08:00:00)." },
            endDateTime: { type: "string", description: "Shift end (ISO 8601)." },
            positionId: { type: "number", description: "New position ID (optional)." },
          },
          required: ["departmentId", "startDateTime", "endDateTime"],
        },
      },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as {
            departmentId: number;
            employeeId?: number;
            startDateTime: string;
            endDateTime: string;
            positionId?: number;
          };
          const body: Record<string, unknown> = {
            departmentId: p.departmentId,
            startDateTime: p.startDateTime,
            endDateTime: p.endDateTime,
          };
          if (p.employeeId !== undefined) body["employeeId"] = p.employeeId;
          if (p.positionId !== undefined) body["positionId"] = p.positionId;
          const data = await client.createShift(body);
          return { content: JSON.stringify(data) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "planday_update_shift",
      {
        displayName: "Update Shift",
        description: "Update an existing shift.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "number", description: "Shift ID to update." },
            employeeId: { type: "number", description: "New employee ID (optional)." },
            startDateTime: { type: "string", description: "New start datetime (ISO 8601, optional)." },
            endDateTime: { type: "string", description: "New end datetime (ISO 8601, optional)." },
            positionId: { type: "number", description: "New position ID (optional)." },
          },
          required: ["id"],
        },
      },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as {
            id: number;
            employeeId?: number;
            startDateTime?: string;
            endDateTime?: string;
            positionId?: number;
          };
          const body: Record<string, unknown> = {};
          if (p.employeeId !== undefined) body["employeeId"] = p.employeeId;
          if (p.startDateTime) body["startDateTime"] = p.startDateTime;
          if (p.endDateTime) body["endDateTime"] = p.endDateTime;
          if (p.positionId !== undefined) body["positionId"] = p.positionId;
          const data = await client.updateShift(p.id, body);
          return { content: JSON.stringify(data) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "planday_delete_shift",
      {
        displayName: "Delete Shift",
        description: "Delete a shift from the schedule.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "number", description: "Shift ID to delete." },
          },
          required: ["id"],
        },
      },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as { id: number };
          await client.deleteShift(p.id);
          return { content: JSON.stringify({ deleted: true, id: p.id }) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "planday_list_departments",
      {
        displayName: "List Departments",
        description: "List all departments in the Planday account.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const data = await client.listDepartments();
          return { content: JSON.stringify(data) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "planday_get_department",
      {
        displayName: "Get Department",
        description: "Get details for a specific department by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "number", description: "Department ID." },
          },
          required: ["id"],
        },
      },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as { id: number };
          const data = await client.getDepartment(p.id);
          return { content: JSON.stringify(data) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "planday_list_punch_clock_records",
      {
        displayName: "List Punch Clock Records",
        description: "List punch clock time records within a date range.",
        parametersSchema: {
          type: "object",
          properties: {
            from: { type: "string", description: "Start date (YYYY-MM-DD)." },
            to: { type: "string", description: "End date (YYYY-MM-DD)." },
            departmentId: { type: "number", description: "Filter by department ID (optional)." },
          },
          required: ["from", "to"],
        },
      },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as { from: string; to: string; departmentId?: number };
          const data = await client.listPunchClockRecords(p.from, p.to, p.departmentId);
          return { content: JSON.stringify(data) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "planday_list_leave_requests",
      {
        displayName: "List Leave Requests",
        description: "List employee leave/absence requests.",
        parametersSchema: {
          type: "object",
          properties: {
            from: { type: "string", description: "Filter from date (YYYY-MM-DD, optional)." },
            to: { type: "string", description: "Filter to date (YYYY-MM-DD, optional)." },
          },
        },
      },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as { from?: string; to?: string };
          const data = await client.listLeaveRequests(p.from, p.to);
          return { content: JSON.stringify(data) };
        } catch (e) { return errResult(e); }
      },
    );
  },
});

runWorker(plugin, import.meta.url);
