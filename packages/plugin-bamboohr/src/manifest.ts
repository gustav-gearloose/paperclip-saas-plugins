import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.bamboohr",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "BambooHR",
  description: "Access employee data, time-off requests, org structure, and custom reports in BambooHR via API key.",
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
      apiKeyRef: {
        type: "string",
        format: "secret-ref",
        title: "BambooHR API Key (secret ref)",
        description: "UUID of a Paperclip secret holding a BambooHR API key.",
        default: "",
      },
      domain: {
        type: "string",
        title: "BambooHR Company Domain",
        description: "Your BambooHR subdomain (e.g. 'mycompany' from mycompany.bamboohr.com).",
        default: "",
      },
    },
    required: ["apiKeyRef", "domain"],
  },
  tools: [
    {
      name: "bamboohr_get_directory",
      displayName: "Get Employee Directory",
      description: "Get the company employee directory with all active employees and their basic info.",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "bamboohr_get_employee",
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
    {
      name: "bamboohr_update_employee",
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
    {
      name: "bamboohr_get_time_off_requests",
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
    {
      name: "bamboohr_get_time_off_types",
      displayName: "Get Time-Off Types",
      description: "List all time-off types configured in BambooHR (vacation, sick leave, etc.).",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "bamboohr_get_time_off_balance",
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
    {
      name: "bamboohr_add_time_off_request",
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
    {
      name: "bamboohr_whos_out",
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
    {
      name: "bamboohr_run_report",
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
    {
      name: "bamboohr_list_departments",
      displayName: "List Departments",
      description: "List all departments configured in BambooHR.",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
  ],
};

export default manifest;
