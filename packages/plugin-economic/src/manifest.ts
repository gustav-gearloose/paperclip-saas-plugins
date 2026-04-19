import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.economic",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "e-conomic",
  description: "Access Visma e-conomic: invoices, customers, accounts, and products via the e-conomic REST API.",
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
      appSecretTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "App Secret Token (secret ref)",
        description: "UUID of a Paperclip secret holding your e-conomic App Secret Token (developer credential from apps.e-conomic.com).",
        default: "",
      },
      agreementGrantTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "Agreement Grant Token (secret ref)",
        description: "UUID of a Paperclip secret holding the customer's Agreement Grant Token (from e-conomic → Indstillinger → API-adgang).",
        default: "",
      },
    },
    required: ["appSecretTokenRef", "agreementGrantTokenRef"],
  },
  tools: [
    {
      name: "economic_list_invoices",
      displayName: "List Invoices",
      description: "List booked invoices from e-conomic. Filter by date range.",
      parametersSchema: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["booked", "draft", "all"],
            description: "Invoice status. Default: booked.",
          },
          date_from: { type: "string", description: "Start date filter (YYYY-MM-DD)." },
          date_to: { type: "string", description: "End date filter (YYYY-MM-DD)." },
          page_size: { type: "integer", description: "Results per page (max 1000, default 100)." },
        },
      },
    },
    {
      name: "economic_get_invoice",
      displayName: "Get Invoice",
      description: "Get details of a specific booked invoice by invoice number.",
      parametersSchema: {
        type: "object",
        required: ["invoice_number"],
        properties: {
          invoice_number: { type: "integer", description: "The booked invoice number." },
          type: {
            type: "string",
            enum: ["booked", "draft"],
            description: "Invoice type. Default: booked.",
          },
        },
      },
    },
    {
      name: "economic_list_customers",
      displayName: "List Customers",
      description: "List customers in e-conomic. Optionally filter by name.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Name filter (partial match)." },
          page_size: { type: "integer", description: "Results per page (max 1000, default 100)." },
        },
      },
    },
    {
      name: "economic_get_customer",
      displayName: "Get Customer",
      description: "Get details of a specific customer by customer number.",
      parametersSchema: {
        type: "object",
        required: ["customer_number"],
        properties: {
          customer_number: { type: "integer", description: "The e-conomic customer number." },
        },
      },
    },
    {
      name: "economic_list_accounts",
      displayName: "List Accounts",
      description: "List all accounts (chart of accounts) from e-conomic.",
      parametersSchema: {
        type: "object",
        properties: {
          page_size: { type: "integer", description: "Results per page (max 1000, default 200)." },
        },
      },
    },
    {
      name: "economic_list_products",
      displayName: "List Products",
      description: "List products/services in e-conomic. Optionally filter by name.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Name filter (partial match)." },
          page_size: { type: "integer", description: "Results per page (max 1000, default 100)." },
        },
      },
    },
    {
      name: "economic_get_company_info",
      displayName: "Get Company Info",
      description: "Get information about the connected e-conomic account and company.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "economic_create_draft_invoice",
      displayName: "Create Draft Invoice",
      description: "Create a new draft invoice in e-conomic.",
      parametersSchema: {
        type: "object",
        required: ["customer_number", "date", "currency", "payment_terms_number", "recipient_name", "lines"],
        properties: {
          customer_number: { type: "integer", description: "e-conomic customer number." },
          date: { type: "string", description: "Invoice date (YYYY-MM-DD)." },
          currency: { type: "string", description: "ISO currency code, e.g. DKK." },
          payment_terms_number: { type: "integer", description: "e-conomic payment terms number." },
          recipient_name: { type: "string", description: "Recipient name on invoice." },
          recipient_address: { type: "string" },
          recipient_city: { type: "string" },
          recipient_zip: { type: "string" },
          lines: {
            type: "array",
            description: "Invoice lines.",
            items: {
              type: "object",
              required: ["description", "quantity", "unit_net_price"],
              properties: {
                product_number: { type: "string" },
                description: { type: "string" },
                quantity: { type: "number" },
                unit_net_price: { type: "number" },
              },
            },
          },
        },
      },
    },
    {
      name: "economic_list_journal_entries",
      displayName: "List Journal Entries",
      description: "List journal voucher entries from e-conomic.",
      parametersSchema: {
        type: "object",
        properties: {
          journal_number: { type: "integer", description: "Specific journal number to fetch entries from. Omit to list all journals." },
          page_size: { type: "integer" },
        },
      },
    },
    {
      name: "economic_create_customer",
      displayName: "Create Customer",
      description: "Create a new customer in e-conomic.",
      parametersSchema: {
        type: "object",
        required: ["name", "customer_group_number"],
        properties: {
          name: { type: "string", description: "Customer name." },
          customer_group_number: { type: "integer", description: "e-conomic customer group number." },
          currency: { type: "string", description: "ISO currency code (default DKK)." },
          payment_terms_number: { type: "integer", description: "Payment terms number (default 14)." },
          address: { type: "string" },
          city: { type: "string" },
          zip: { type: "string" },
          country: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
        },
      },
    },
  ],
};

export default manifest;
