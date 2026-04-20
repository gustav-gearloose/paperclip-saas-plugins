import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.sage",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Sage Business Cloud",
  description: "Connect to Sage Business Cloud — invoices, contacts, purchases, ledger accounts, payments, and trial balance.",
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
        title: "Sage Client ID (secret ref)",
        description: "UUID of a Paperclip secret holding your Sage OAuth2 client ID.",
        default: "",
      },
      clientSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "Sage Client Secret (secret ref)",
        description: "UUID of a Paperclip secret holding your Sage OAuth2 client secret.",
        default: "",
      },
      refreshTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "Sage Refresh Token (secret ref)",
        description: "UUID of a Paperclip secret holding your Sage OAuth2 refresh token.",
        default: "",
      },
    },
  },
  tools: [
    {
      name: "sage_list_sales_invoices",
      displayName: "List Sales Invoices",
      description: "List Sage Business Cloud sales invoices.",
      parametersSchema: {
        type: "object",
        properties: {
          page: { type: "number", description: "Page number (1-based, default 1)." },
          per_page: { type: "number", description: "Results per page (default 25)." },
        },
      },
    },
    {
      name: "sage_get_sales_invoice",
      displayName: "Get Sales Invoice",
      description: "Get a single Sage sales invoice by ID.",
      parametersSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "Sales invoice ID." },
        },
      },
    },
    {
      name: "sage_create_sales_invoice",
      displayName: "Create Sales Invoice",
      description: "Create a new Sage sales invoice.",
      parametersSchema: {
        type: "object",
        required: ["contact_id", "invoice_lines"],
        properties: {
          contact_id: { type: "string", description: "Sage contact ID (customer)." },
          date: { type: "string", description: "Invoice date YYYY-MM-DD." },
          due_date: { type: "string", description: "Due date YYYY-MM-DD." },
          reference: { type: "string", description: "Optional reference/PO number." },
          invoice_lines: {
            type: "array",
            description: "Invoice line items.",
            items: {
              type: "object",
              properties: {
                description: { type: "string", description: "Line item description." },
                quantity: { type: "number", description: "Quantity." },
                unit_price: { type: "number", description: "Unit price." },
                ledger_account_id: { type: "string", description: "Ledger account ID (optional)." },
              },
            },
          },
        },
      },
    },
    {
      name: "sage_list_contacts",
      displayName: "List Contacts",
      description: "List Sage contacts (customers and suppliers).",
      parametersSchema: {
        type: "object",
        properties: {
          page: { type: "number", description: "Page number (1-based, default 1)." },
          per_page: { type: "number", description: "Results per page (default 25)." },
        },
      },
    },
    {
      name: "sage_get_contact",
      displayName: "Get Contact",
      description: "Get a single Sage contact by ID.",
      parametersSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "Contact ID." },
        },
      },
    },
    {
      name: "sage_create_contact",
      displayName: "Create Contact",
      description: "Create a new Sage contact.",
      parametersSchema: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", description: "Contact name." },
          email: { type: "string", description: "Email address." },
          phone: { type: "string", description: "Phone number." },
        },
      },
    },
    {
      name: "sage_list_purchase_invoices",
      displayName: "List Purchase Invoices",
      description: "List Sage purchase invoices (supplier bills).",
      parametersSchema: {
        type: "object",
        properties: {
          page: { type: "number", description: "Page number (1-based, default 1)." },
          per_page: { type: "number", description: "Results per page (default 25)." },
        },
      },
    },
    {
      name: "sage_get_purchase_invoice",
      displayName: "Get Purchase Invoice",
      description: "Get a single Sage purchase invoice by ID.",
      parametersSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string", description: "Purchase invoice ID." },
        },
      },
    },
    {
      name: "sage_list_ledger_accounts",
      displayName: "List Ledger Accounts",
      description: "List Sage ledger accounts (chart of accounts).",
      parametersSchema: {
        type: "object",
        properties: {
          page: { type: "number", description: "Page number (1-based, default 1)." },
          per_page: { type: "number", description: "Results per page (default 25)." },
        },
      },
    },
    {
      name: "sage_list_payments",
      displayName: "List Payments",
      description: "List Sage payments.",
      parametersSchema: {
        type: "object",
        properties: {
          page: { type: "number", description: "Page number (1-based, default 1)." },
          per_page: { type: "number", description: "Results per page (default 25)." },
        },
      },
    },
    {
      name: "sage_list_bank_accounts",
      displayName: "List Bank Accounts",
      description: "List Sage bank accounts.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "sage_get_trial_balance",
      displayName: "Get Trial Balance",
      description: "Get the Sage trial balance report.",
      parametersSchema: { type: "object", properties: {} },
    },
  ],
};

export default manifest;
