import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.personio",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Personio",
  description: "Access employee records, absences, attendance, and departments in Personio via API credentials.",
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
      clientIdRef: {
        type: "string",
        format: "secret-ref",
        title: "Personio Client ID (secret ref)",
        description: "UUID of a Paperclip secret holding the Personio API client ID.",
        default: "",
      },
      clientSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "Personio Client Secret (secret ref)",
        description: "UUID of a Paperclip secret holding the Personio API client secret.",
        default: "",
      },
    },
    required: ["clientIdRef", "clientSecretRef"],
  },
  tools: [
    {
      name: "personio_list_employees",
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
    {
      name: "personio_get_employee",
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
    {
      name: "personio_create_employee",
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
    {
      name: "personio_update_employee",
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
    {
      name: "personio_list_absence_types",
      displayName: "List Absence Types",
      description: "List all configured absence/time-off types in Personio (vacation, sick leave, etc.).",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "personio_list_absences",
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
    {
      name: "personio_create_absence",
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
    {
      name: "personio_delete_absence",
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
    {
      name: "personio_list_attendances",
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
    {
      name: "personio_create_attendance",
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
    {
      name: "personio_list_departments",
      displayName: "List Departments",
      description: "List all departments configured in Personio.",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
  ],
};

export default manifest;
