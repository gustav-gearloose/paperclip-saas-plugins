import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.tripletex",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Tripletex",
  description: "Norwegian accounting & ERP — invoices, customers, suppliers, projects, timesheet, employees, ledger.",
  author: "Gearloose",
  categories: ["connector"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "instance.settings.register",
  ],
  instanceConfigSchema: {
    consumerTokenRef: {
      type: "string",
      format: "secret-ref",
      description: "Tripletex Consumer Token (from API access settings).",
    },
    employeeTokenRef: {
      type: "string",
      format: "secret-ref",
      description: "Tripletex Employee Token (from your user profile).",
    },
  },
  entrypoints: {
    worker: "./worker.js",
  },
  tools: [
    {
      name: "tripletex_list_invoices",
      displayName: "List Invoices",
      description: "List invoices with optional date range and pagination.",
      parametersSchema: {
        type: "object",
        properties: {
          from: { type: "number", description: "Pagination offset (0-based)." },
          count: { type: "number", description: "Number of results (default 25, max 1000)." },
          dateFrom: { type: "string", description: "Invoice date from (YYYY-MM-DD)." },
          dateTo: { type: "string", description: "Invoice date to (YYYY-MM-DD)." },
        },
      },
    },
    {
      name: "tripletex_get_invoice",
      displayName: "Get Invoice",
      description: "Get a single invoice by ID including line items and payment status.",
      parametersSchema: {
        type: "object",
        properties: {
          id: { type: "number", description: "Tripletex invoice ID." },
        },
        required: ["id"],
      },
    },
    {
      name: "tripletex_list_customers",
      displayName: "List Customers",
      description: "List all customers/clients.",
      parametersSchema: {
        type: "object",
        properties: {
          from: { type: "number", description: "Pagination offset (0-based)." },
          count: { type: "number", description: "Number of results (default 25)." },
        },
      },
    },
    {
      name: "tripletex_list_suppliers",
      displayName: "List Suppliers",
      description: "List all suppliers/vendors.",
      parametersSchema: {
        type: "object",
        properties: {
          from: { type: "number", description: "Pagination offset (0-based)." },
          count: { type: "number", description: "Number of results (default 25)." },
        },
      },
    },
    {
      name: "tripletex_list_projects",
      displayName: "List Projects",
      description: "List all projects.",
      parametersSchema: {
        type: "object",
        properties: {
          from: { type: "number", description: "Pagination offset (0-based)." },
          count: { type: "number", description: "Number of results (default 25)." },
        },
      },
    },
    {
      name: "tripletex_get_project",
      displayName: "Get Project",
      description: "Get a single project by ID including budget and team.",
      parametersSchema: {
        type: "object",
        properties: {
          id: { type: "number", description: "Tripletex project ID." },
        },
        required: ["id"],
      },
    },
    {
      name: "tripletex_list_timesheet_entries",
      displayName: "List Timesheet Entries",
      description: "List time entries, optionally filtered by employee, project, and date range.",
      parametersSchema: {
        type: "object",
        properties: {
          from: { type: "number", description: "Pagination offset (0-based)." },
          count: { type: "number", description: "Number of results (default 25)." },
          dateFrom: { type: "string", description: "Date from (YYYY-MM-DD)." },
          dateTo: { type: "string", description: "Date to (YYYY-MM-DD)." },
          employeeId: { type: "number", description: "Filter by employee ID." },
          projectId: { type: "number", description: "Filter by project ID." },
        },
      },
    },
    {
      name: "tripletex_list_employees",
      displayName: "List Employees",
      description: "List all employees in the company.",
      parametersSchema: {
        type: "object",
        properties: {
          from: { type: "number", description: "Pagination offset (0-based)." },
          count: { type: "number", description: "Number of results (default 25)." },
        },
      },
    },
    {
      name: "tripletex_list_ledger_postings",
      displayName: "List Ledger Postings",
      description: "List general ledger postings for accounting analysis.",
      parametersSchema: {
        type: "object",
        properties: {
          from: { type: "number", description: "Pagination offset (0-based)." },
          count: { type: "number", description: "Number of results (default 25)." },
          dateFrom: { type: "string", description: "Posting date from (YYYY-MM-DD)." },
          dateTo: { type: "string", description: "Posting date to (YYYY-MM-DD)." },
        },
      },
    },
    {
      name: "tripletex_list_accounts",
      displayName: "List Ledger Accounts",
      description: "List chart of accounts.",
      parametersSchema: {
        type: "object",
        properties: {
          from: { type: "number", description: "Pagination offset (0-based)." },
          count: { type: "number", description: "Number of results (default 25)." },
        },
      },
    },
  ],
};

export default manifest;
