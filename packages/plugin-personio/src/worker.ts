import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { PersonioClient } from "./personio-client.js";

interface PersonioPluginConfig {
  clientIdRef?: string;
  clientSecretRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as PersonioPluginConfig;
    const { clientIdRef, clientSecretRef } = config;

    if (!clientIdRef || !clientSecretRef) {
      ctx.logger.error("Personio plugin: clientIdRef and clientSecretRef are required");
      return;
    }

    let clientId: string;
    let clientSecret: string;
    try {
      [clientId, clientSecret] = await Promise.all([
        ctx.secrets.resolve(clientIdRef),
        ctx.secrets.resolve(clientSecretRef),
      ]);
    } catch (err) {
      ctx.logger.error(`Personio plugin: failed to resolve secrets: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    let client: PersonioClient;
    try {
      client = await PersonioClient.create(clientId, clientSecret);
    } catch (err) {
      ctx.logger.error(`Personio plugin: auth failed: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    ctx.logger.info("Personio plugin: authenticated, registering tools");

    ctx.tools.register(
      "personio_list_employees",
      {
        displayName: "List Employees",
        description: "List all employees in Personio, optionally filtered by email.",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Max results to return (default: 200)." },
            offset: { type: "integer", description: "Pagination offset." },
            email: { type: "string", description: "Filter by employee email address." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const result = await client.listEmployees(params as { limit?: number; offset?: number; email?: string });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "personio_get_employee",
      {
        displayName: "Get Employee",
        description: "Get detailed information about a specific employee by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "integer", description: "Personio employee ID." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { id: number };
          const result = await client.getEmployee(p.id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "personio_create_employee",
      {
        displayName: "Create Employee",
        description: "Create a new employee record in Personio.",
        parametersSchema: {
          type: "object",
          properties: {
            first_name: { type: "string", description: "First name." },
            last_name: { type: "string", description: "Last name." },
            email: { type: "string", description: "Work email address." },
            gender: { type: "string", enum: ["male", "female", "diverse"], description: "Gender." },
            position: { type: "string", description: "Job position/title." },
            department: { type: "string", description: "Department name." },
            hire_date: { type: "string", description: "Hire date (YYYY-MM-DD)." },
          },
          required: ["first_name", "last_name", "email"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const result = await client.createEmployee(params as Record<string, unknown>);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "personio_update_employee",
      {
        displayName: "Update Employee",
        description: "Update fields on an existing Personio employee.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "integer", description: "Personio employee ID to update." },
            first_name: { type: "string", description: "First name." },
            last_name: { type: "string", description: "Last name." },
            email: { type: "string", description: "Work email address." },
            position: { type: "string", description: "Job position/title." },
            department: { type: "string", description: "Department name." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { id: number } & Record<string, unknown>;
          const { id, ...rest } = p;
          const result = await client.updateEmployee(id, rest);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "personio_list_absence_types",
      {
        displayName: "List Absence Types",
        description: "List all configured absence/time-off types in Personio (vacation, sick leave, etc.).",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const result = await client.listAbsenceTypes();
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "personio_list_absences",
      {
        displayName: "List Absences",
        description: "List employee absences/time-off requests, optionally filtered by date range or employee.",
        parametersSchema: {
          type: "object",
          properties: {
            startDate: { type: "string", description: "Filter by start date (YYYY-MM-DD)." },
            endDate: { type: "string", description: "Filter by end date (YYYY-MM-DD)." },
            employeeId: { type: "integer", description: "Filter by employee ID." },
            limit: { type: "integer", description: "Max results (default: 200)." },
            offset: { type: "integer", description: "Pagination offset." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const result = await client.listAbsences(params as { startDate?: string; endDate?: string; employeeId?: number; limit?: number; offset?: number });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "personio_create_absence",
      {
        displayName: "Create Absence",
        description: "Submit a new absence/time-off request for an employee.",
        parametersSchema: {
          type: "object",
          properties: {
            employeeId: { type: "integer", description: "Personio employee ID." },
            timeOffTypeId: { type: "integer", description: "Absence type ID (from list_absence_types)." },
            startDate: { type: "string", description: "Start date (YYYY-MM-DD)." },
            endDate: { type: "string", description: "End date (YYYY-MM-DD)." },
            halfDayStart: { type: "boolean", description: "Whether the first day is a half day." },
            halfDayEnd: { type: "boolean", description: "Whether the last day is a half day." },
            comment: { type: "string", description: "Optional note or reason." },
          },
          required: ["employeeId", "timeOffTypeId", "startDate", "endDate"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as {
            employeeId: number;
            timeOffTypeId: number;
            startDate: string;
            endDate: string;
            halfDayStart?: boolean;
            halfDayEnd?: boolean;
            comment?: string;
          };
          const result = await client.createAbsence(p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "personio_delete_absence",
      {
        displayName: "Delete Absence",
        description: "Delete/cancel an absence request by its ID.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "integer", description: "Absence ID to delete." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { id: number };
          const result = await client.deleteAbsence(p.id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "personio_list_attendances",
      {
        displayName: "List Attendances",
        description: "List attendance records, optionally filtered by date range or employee.",
        parametersSchema: {
          type: "object",
          properties: {
            startDate: { type: "string", description: "Filter by start date (YYYY-MM-DD)." },
            endDate: { type: "string", description: "Filter by end date (YYYY-MM-DD)." },
            employeeId: { type: "integer", description: "Filter by employee ID." },
            limit: { type: "integer", description: "Max results (default: 200)." },
            offset: { type: "integer", description: "Pagination offset." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const result = await client.listAttendances(params as { startDate?: string; endDate?: string; employeeId?: number; limit?: number; offset?: number });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "personio_create_attendance",
      {
        displayName: "Create Attendance",
        description: "Log an attendance record (clock-in/clock-out) for an employee.",
        parametersSchema: {
          type: "object",
          properties: {
            employeeId: { type: "integer", description: "Personio employee ID." },
            date: { type: "string", description: "Work date (YYYY-MM-DD)." },
            startTime: { type: "string", description: "Start time (HH:MM)." },
            endTime: { type: "string", description: "End time (HH:MM)." },
            breakDuration: { type: "integer", description: "Break duration in minutes (default: 0)." },
            comment: { type: "string", description: "Optional comment." },
          },
          required: ["employeeId", "date", "startTime", "endTime"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as {
            employeeId: number;
            date: string;
            startTime: string;
            endTime: string;
            breakDuration?: number;
            comment?: string;
          };
          const result = await client.createAttendance(p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "personio_list_departments",
      {
        displayName: "List Departments",
        description: "List all departments configured in Personio.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const result = await client.listDepartments();
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Personio plugin ready — 11 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "Personio plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
