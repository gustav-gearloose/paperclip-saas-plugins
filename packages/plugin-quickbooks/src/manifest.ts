import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.quickbooks",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "QuickBooks Online",
  description: "Connect to QuickBooks Online — invoices, customers, accounts, P&L reports, vendors, and bills.",
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
    required: ["clientIdRef", "clientSecretRef", "refreshTokenRef", "realmId"],
    properties: {
      clientIdRef: {
        type: "string",
        format: "secret-ref",
        title: "QuickBooks Client ID (secret ref)",
        description: "UUID of a Paperclip secret holding your QuickBooks OAuth2 client ID.",
        default: "",
      },
      clientSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "QuickBooks Client Secret (secret ref)",
        description: "UUID of a Paperclip secret holding your QuickBooks OAuth2 client secret.",
        default: "",
      },
      refreshTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "QuickBooks Refresh Token (secret ref)",
        description: "UUID of a Paperclip secret holding your QuickBooks OAuth2 refresh token.",
        default: "",
      },
      realmId: {
        type: "string",
        title: "QuickBooks Realm ID",
        description: "Your QuickBooks company/realm ID (from the OAuth callback URL).",
        default: "",
      },
      sandbox: {
        type: "boolean",
        title: "Use Sandbox",
        description: "Connect to the QuickBooks sandbox environment (default: false).",
        default: false,
      },
    },
  },
  tools: [
    {
      name: "quickbooks_list_invoices",
      displayName: "List Invoices",
      description: "List QuickBooks Online invoices.",
      parametersSchema: {
        type: "object",
        properties: {
          start_position: { type: "number", description: "1-based start position for pagination." },
          max_results: { type: "number", description: "Max results per page (default 100, max 1000)." },
        },
      },
    },
    {
      name: "quickbooks_get_invoice",
      displayName: "Get Invoice",
      description: "Get a single QuickBooks invoice by ID.",
      parametersSchema: {
        type: "object",
        required: ["invoice_id"],
        properties: {
          invoice_id: { type: "string", description: "Invoice ID." },
        },
      },
    },
    {
      name: "quickbooks_create_invoice",
      displayName: "Create Invoice",
      description: "Create a new QuickBooks Online invoice.",
      parametersSchema: {
        type: "object",
        required: ["customer_id", "lines"],
        properties: {
          customer_id: { type: "string", description: "Customer ID (CustomerRef.value)." },
          due_date: { type: "string", description: "Due date in YYYY-MM-DD format." },
          lines: {
            type: "array",
            description: "Invoice line items.",
            items: {
              type: "object",
              properties: {
                description: { type: "string", description: "Line item description." },
                amount: { type: "number", description: "Line total amount." },
                item_id: { type: "string", description: "Item/product ID (ItemRef.value)." },
                quantity: { type: "number", description: "Quantity." },
                unit_price: { type: "number", description: "Unit price." },
              },
            },
          },
        },
      },
    },
    {
      name: "quickbooks_list_customers",
      displayName: "List Customers",
      description: "List QuickBooks Online customers.",
      parametersSchema: {
        type: "object",
        properties: {
          start_position: { type: "number", description: "1-based start position for pagination." },
          max_results: { type: "number", description: "Max results per page (default 100, max 1000)." },
        },
      },
    },
    {
      name: "quickbooks_get_customer",
      displayName: "Get Customer",
      description: "Get a single QuickBooks customer by ID.",
      parametersSchema: {
        type: "object",
        required: ["customer_id"],
        properties: {
          customer_id: { type: "string", description: "Customer ID." },
        },
      },
    },
    {
      name: "quickbooks_create_customer",
      displayName: "Create Customer",
      description: "Create a new customer in QuickBooks Online.",
      parametersSchema: {
        type: "object",
        required: ["display_name"],
        properties: {
          display_name: { type: "string", description: "Customer display name (must be unique)." },
          email: { type: "string", description: "Primary email address." },
          phone: { type: "string", description: "Primary phone number." },
          company_name: { type: "string", description: "Company name." },
        },
      },
    },
    {
      name: "quickbooks_list_accounts",
      displayName: "List Accounts",
      description: "List QuickBooks chart of accounts.",
      parametersSchema: {
        type: "object",
        properties: {
          start_position: { type: "number", description: "1-based start position for pagination." },
          max_results: { type: "number", description: "Max results per page (default 100, max 1000)." },
        },
      },
    },
    {
      name: "quickbooks_get_profit_and_loss",
      displayName: "Get Profit & Loss Report",
      description: "Get the QuickBooks Profit & Loss report for a date range.",
      parametersSchema: {
        type: "object",
        required: ["start_date", "end_date"],
        properties: {
          start_date: { type: "string", description: "Start date in YYYY-MM-DD format." },
          end_date: { type: "string", description: "End date in YYYY-MM-DD format." },
          accounting_method: { type: "string", description: "Accrual or Cash (default: Accrual)." },
        },
      },
    },
    {
      name: "quickbooks_list_vendors",
      displayName: "List Vendors",
      description: "List QuickBooks Online vendors.",
      parametersSchema: {
        type: "object",
        properties: {
          start_position: { type: "number", description: "1-based start position for pagination." },
          max_results: { type: "number", description: "Max results per page (default 100, max 1000)." },
        },
      },
    },
    {
      name: "quickbooks_list_bills",
      displayName: "List Bills",
      description: "List QuickBooks Online bills (accounts payable).",
      parametersSchema: {
        type: "object",
        properties: {
          start_position: { type: "number", description: "1-based start position for pagination." },
          max_results: { type: "number", description: "Max results per page (default 100, max 1000)." },
        },
      },
    },
  ],
};

export default manifest;
