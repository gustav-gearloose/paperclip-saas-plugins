import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.freshbooks",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "FreshBooks",
  description: "Connect to FreshBooks — invoices, clients, expenses, payments, and time entries.",
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
    required: ["clientIdRef", "clientSecretRef", "refreshTokenRef"],
    properties: {
      clientIdRef: {
        type: "string",
        format: "secret-ref",
        title: "FreshBooks Client ID (secret ref)",
        description: "UUID of a Paperclip secret holding your FreshBooks OAuth2 client ID.",
        default: "",
      },
      clientSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "FreshBooks Client Secret (secret ref)",
        description: "UUID of a Paperclip secret holding your FreshBooks OAuth2 client secret.",
        default: "",
      },
      refreshTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "FreshBooks Refresh Token (secret ref)",
        description: "UUID of a Paperclip secret holding your FreshBooks OAuth2 refresh token.",
        default: "",
      },
    },
  },
  tools: [
    {
      name: "freshbooks_list_invoices",
      displayName: "List Invoices",
      description: "List FreshBooks invoices.",
      parametersSchema: {
        type: "object",
        properties: {
          page: { type: "number", description: "Page number (1-based, default 1)." },
          per_page: { type: "number", description: "Results per page (max 100, default 25)." },
        },
      },
    },
    {
      name: "freshbooks_get_invoice",
      displayName: "Get Invoice",
      description: "Get a single FreshBooks invoice by ID.",
      parametersSchema: {
        type: "object",
        required: ["invoice_id"],
        properties: {
          invoice_id: { type: "string", description: "Invoice ID." },
        },
      },
    },
    {
      name: "freshbooks_create_invoice",
      displayName: "Create Invoice",
      description: "Create a new FreshBooks invoice.",
      parametersSchema: {
        type: "object",
        required: ["client_id", "lines"],
        properties: {
          client_id: { type: "number", description: "FreshBooks client ID." },
          create_date: { type: "string", description: "Invoice date in YYYY-MM-DD format." },
          due_date: { type: "string", description: "Due date in YYYY-MM-DD format." },
          currency_code: { type: "string", description: "Currency code (e.g. USD, DKK). Defaults to account currency." },
          lines: {
            type: "array",
            description: "Invoice line items.",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Line item name/description." },
                qty: { type: "number", description: "Quantity." },
                unit_cost: { type: "number", description: "Unit price." },
              },
            },
          },
        },
      },
    },
    {
      name: "freshbooks_list_clients",
      displayName: "List Clients",
      description: "List FreshBooks clients.",
      parametersSchema: {
        type: "object",
        properties: {
          page: { type: "number", description: "Page number (1-based, default 1)." },
          per_page: { type: "number", description: "Results per page (max 100, default 25)." },
        },
      },
    },
    {
      name: "freshbooks_get_client",
      displayName: "Get Client",
      description: "Get a single FreshBooks client by ID.",
      parametersSchema: {
        type: "object",
        required: ["client_id"],
        properties: {
          client_id: { type: "string", description: "Client ID." },
        },
      },
    },
    {
      name: "freshbooks_create_client",
      displayName: "Create Client",
      description: "Create a new FreshBooks client.",
      parametersSchema: {
        type: "object",
        required: ["fname", "lname"],
        properties: {
          fname: { type: "string", description: "First name." },
          lname: { type: "string", description: "Last name." },
          email: { type: "string", description: "Email address." },
          organization: { type: "string", description: "Company/organization name." },
          currency_code: { type: "string", description: "Default currency code (e.g. DKK, USD)." },
        },
      },
    },
    {
      name: "freshbooks_list_expenses",
      displayName: "List Expenses",
      description: "List FreshBooks expenses.",
      parametersSchema: {
        type: "object",
        properties: {
          page: { type: "number", description: "Page number (1-based, default 1)." },
          per_page: { type: "number", description: "Results per page (max 100, default 25)." },
        },
      },
    },
    {
      name: "freshbooks_get_expense",
      displayName: "Get Expense",
      description: "Get a single FreshBooks expense by ID.",
      parametersSchema: {
        type: "object",
        required: ["expense_id"],
        properties: {
          expense_id: { type: "string", description: "Expense ID." },
        },
      },
    },
    {
      name: "freshbooks_list_payments",
      displayName: "List Payments",
      description: "List FreshBooks payments.",
      parametersSchema: {
        type: "object",
        properties: {
          page: { type: "number", description: "Page number (1-based, default 1)." },
          per_page: { type: "number", description: "Results per page (max 100, default 25)." },
        },
      },
    },
    {
      name: "freshbooks_list_time_entries",
      displayName: "List Time Entries",
      description: "List FreshBooks time entries.",
      parametersSchema: {
        type: "object",
        properties: {
          page: { type: "number", description: "Page number (1-based, default 1)." },
          per_page: { type: "number", description: "Results per page (max 100, default 25)." },
        },
      },
    },
  ],
};

export default manifest;
