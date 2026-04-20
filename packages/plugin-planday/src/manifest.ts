import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.planday",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Planday",
  description: "Workforce management: employees, shifts, departments, punch clock, and leave requests.",
  author: "Gearloose",
  categories: ["connector"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "instance.settings.register",
  ],
  instanceConfigSchema: {
    clientIdRef: {
      type: "string",
      format: "secret-ref",
      description: "Planday OAuth2 application client ID.",
    },
    refreshTokenRef: {
      type: "string",
      format: "secret-ref",
      description: "Planday OAuth2 refresh token.",
    },
  },
  entrypoints: {
    worker: "./worker.js",
  },
  tools: [
    {
      name: "planday_list_employees",
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
    {
      name: "planday_get_employee",
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
    {
      name: "planday_list_employee_groups",
      displayName: "List Employee Groups",
      description: "List all employee groups in Planday.",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "planday_list_shifts",
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
    {
      name: "planday_get_shift",
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
    {
      name: "planday_create_shift",
      displayName: "Create Shift",
      description: "Create a new shift in the schedule.",
      parametersSchema: {
        type: "object",
        properties: {
          departmentId: { type: "number", description: "Department ID for the shift." },
          employeeId: { type: "number", description: "Employee ID to assign the shift to (optional)." },
          startDateTime: { type: "string", description: "Shift start (ISO 8601, e.g. 2025-06-01T08:00:00)." },
          endDateTime: { type: "string", description: "Shift end (ISO 8601)." },
          positionId: { type: "number", description: "Position/role ID (optional)." },
        },
        required: ["departmentId", "startDateTime", "endDateTime"],
      },
    },
    {
      name: "planday_update_shift",
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
    {
      name: "planday_delete_shift",
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
    {
      name: "planday_list_departments",
      displayName: "List Departments",
      description: "List all departments in the Planday account.",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "planday_get_department",
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
    {
      name: "planday_list_punch_clock_records",
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
    {
      name: "planday_list_leave_requests",
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
  ],
};

export default manifest;
