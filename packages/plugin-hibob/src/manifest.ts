import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.hibob",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "HiBob",
  description: "HR platform — employees, time-off, departments, tasks, and documents.",
  author: "Gearloose",
  categories: ["connector"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "instance.settings.register",
  ],
  instanceConfigSchema: {
    serviceUserIdRef: {
      type: "string",
      format: "secret-ref",
      description: "HiBob service user ID (from Settings → Integrations → Service Users).",
    },
    tokenRef: {
      type: "string",
      format: "secret-ref",
      description: "HiBob service user token.",
    },
  },
  entrypoints: {
    worker: "./worker.js",
  },
  tools: [
    {
      name: "hibob_list_employees",
      displayName: "List Employees",
      description: "List all employees with optional pagination.",
      parametersSchema: {
        type: "object",
        properties: {
          offset: { type: "number", description: "Pagination offset." },
          limit: { type: "number", description: "Max results (default 50)." },
        },
      },
    },
    {
      name: "hibob_get_employee",
      displayName: "Get Employee",
      description: "Get a single employee by ID.",
      parametersSchema: {
        type: "object",
        properties: {
          employeeId: { type: "string", description: "HiBob employee ID." },
        },
        required: ["employeeId"],
      },
    },
    {
      name: "hibob_create_employee",
      displayName: "Create Employee",
      description: "Create a new employee record.",
      parametersSchema: {
        type: "object",
        properties: {
          firstName: { type: "string", description: "Employee first name." },
          surname: { type: "string", description: "Employee last name." },
          email: { type: "string", description: "Work email address." },
          site: { type: "string", description: "Office site/location name." },
          department: { type: "string", description: "Department name." },
          startDate: { type: "string", description: "ISO 8601 date (YYYY-MM-DD)." },
        },
        required: ["firstName", "surname", "email"],
      },
    },
    {
      name: "hibob_get_directory",
      displayName: "Get Employee Directory",
      description: "Fetch a searchable directory of all employees (name, email, department, title).",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "hibob_list_departments",
      displayName: "List Departments",
      description: "List all departments in the company.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "hibob_list_time_off_requests",
      displayName: "List Time-Off Requests",
      description: "List time-off requests, optionally filtered by employee and date range.",
      parametersSchema: {
        type: "object",
        properties: {
          employeeId: { type: "string", description: "Filter by employee ID." },
          from: { type: "string", description: "Start date YYYY-MM-DD." },
          to: { type: "string", description: "End date YYYY-MM-DD." },
        },
      },
    },
    {
      name: "hibob_submit_time_off_request",
      displayName: "Submit Time-Off Request",
      description: "Submit a time-off request for an employee.",
      parametersSchema: {
        type: "object",
        properties: {
          employeeId: { type: "string", description: "HiBob employee ID." },
          policyType: { type: "string", description: "Time-off policy type (e.g. Vacation, Sick)." },
          startDate: { type: "string", description: "YYYY-MM-DD." },
          endDate: { type: "string", description: "YYYY-MM-DD." },
          requestRangeType: { type: "string", enum: ["days", "hours"], description: "Whether request is measured in days or hours." },
          dayPortion: { type: "string", enum: ["all_day", "morning", "afternoon"], description: "Portion of the day if applicable." },
        },
        required: ["employeeId", "policyType", "startDate", "endDate"],
      },
    },
    {
      name: "hibob_get_whos_out",
      displayName: "Who's Out",
      description: "Get employees currently out or out within a date range.",
      parametersSchema: {
        type: "object",
        properties: {
          from: { type: "string", description: "Start date YYYY-MM-DD." },
          to: { type: "string", description: "End date YYYY-MM-DD." },
        },
      },
    },
    {
      name: "hibob_list_open_tasks",
      displayName: "List Open Tasks",
      description: "List open onboarding/offboarding tasks for employees.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "hibob_get_employee_documents",
      displayName: "Get Employee Documents",
      description: "Retrieve shared documents for a specific employee.",
      parametersSchema: {
        type: "object",
        properties: {
          employeeId: { type: "string", description: "HiBob employee ID." },
        },
        required: ["employeeId"],
      },
    },
  ],
};

export default manifest;
