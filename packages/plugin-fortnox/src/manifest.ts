import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.fortnox",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Fortnox",
  description: "Read and manage Fortnox accounting data: invoices, customers, suppliers, articles, and vouchers.",
  author: "Gearloose",
  categories: ["connector"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "instance.settings.register",
    "plugin.state.read",
    "plugin.state.write",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      accessTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "Fortnox Access Token (ref)",
        description: "UUID of a Paperclip secret holding your Fortnox OAuth2 access token.",
        default: "",
      },
      refreshTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "Fortnox Refresh Token (ref)",
        description: "UUID of a Paperclip secret holding your Fortnox OAuth2 refresh token.",
        default: "",
      },
      clientIdRef: {
        type: "string",
        format: "secret-ref",
        title: "Fortnox Client ID (ref)",
        description: "UUID of a Paperclip secret holding your Fortnox API client ID.",
        default: "",
      },
      clientSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "Fortnox Client Secret (ref)",
        description: "UUID of a Paperclip secret holding your Fortnox API client secret.",
        default: "",
      },
    },
    required: ["accessTokenRef", "refreshTokenRef", "clientIdRef", "clientSecretRef"],
  },
  tools: [
    {
      name: "fortnox_list_invoices",
      displayName: "List Invoices",
      description: "List sales invoices from Fortnox. Filter by customer, status, or date range.",
      parametersSchema: {
        type: "object",
        properties: {
          customer_number: { type: "string", description: "Filter by customer number." },
          filter: { type: "string", enum: ["unpaid", "unpaidoverdue", "paid", "cancelled", "fullypaid"], description: "Invoice status filter." },
          from_date: { type: "string", description: "Start date (YYYY-MM-DD)." },
          to_date: { type: "string", description: "End date (YYYY-MM-DD)." },
          limit: { type: "integer", description: "Max results (default 100).", default: 100 },
        },
      },
    },
    {
      name: "fortnox_get_invoice",
      displayName: "Get Invoice",
      description: "Get full details for a specific Fortnox invoice by document number.",
      parametersSchema: {
        type: "object",
        properties: {
          document_number: { type: "string", description: "Invoice document number." },
        },
        required: ["document_number"],
      },
    },
    {
      name: "fortnox_create_invoice",
      displayName: "Create Invoice",
      description: "Create a new sales invoice in Fortnox.",
      parametersSchema: {
        type: "object",
        properties: {
          customer_number: { type: "string", description: "Fortnox customer number." },
          invoice_date: { type: "string", description: "Invoice date (YYYY-MM-DD), defaults to today." },
          due_date: { type: "string", description: "Due date (YYYY-MM-DD)." },
          invoice_rows: {
            type: "array",
            description: "Line items.",
            items: {
              type: "object",
              properties: {
                article_number: { type: "string", description: "Article number." },
                description: { type: "string", description: "Line description." },
                quantity: { type: "number", description: "Quantity." },
                price: { type: "number", description: "Unit price excl. VAT." },
                vat: { type: "integer", description: "VAT percent (e.g. 25)." },
              },
            },
          },
          your_order_number: { type: "string", description: "Optional order reference." },
          remarks: { type: "string", description: "Invoice remarks/notes." },
        },
        required: ["customer_number", "invoice_rows"],
      },
    },
    {
      name: "fortnox_list_customers",
      displayName: "List Customers",
      description: "List customers registered in Fortnox.",
      parametersSchema: {
        type: "object",
        properties: {
          search: { type: "string", description: "Search by name or customer number." },
          limit: { type: "integer", description: "Max results (default 100).", default: 100 },
        },
      },
    },
    {
      name: "fortnox_get_customer",
      displayName: "Get Customer",
      description: "Get full details for a specific Fortnox customer.",
      parametersSchema: {
        type: "object",
        properties: {
          customer_number: { type: "string", description: "Customer number." },
        },
        required: ["customer_number"],
      },
    },
    {
      name: "fortnox_create_customer",
      displayName: "Create Customer",
      description: "Create a new customer in Fortnox.",
      parametersSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Customer name." },
          email: { type: "string", description: "Customer email." },
          phone: { type: "string", description: "Phone number." },
          address1: { type: "string", description: "Street address." },
          city: { type: "string", description: "City." },
          zip_code: { type: "string", description: "Postal code." },
          country_code: { type: "string", description: "ISO 3166-1 alpha-2 country code (e.g. SE, DK)." },
          organisation_number: { type: "string", description: "Company org number." },
          vat_number: { type: "string", description: "EU VAT number." },
          currency: { type: "string", description: "Currency code (e.g. SEK, DKK, EUR).", default: "SEK" },
        },
        required: ["name"],
      },
    },
    {
      name: "fortnox_list_articles",
      displayName: "List Articles",
      description: "List products/articles in Fortnox product registry.",
      parametersSchema: {
        type: "object",
        properties: {
          search: { type: "string", description: "Search by description or article number." },
          limit: { type: "integer", description: "Max results (default 100).", default: 100 },
        },
      },
    },
    {
      name: "fortnox_list_vouchers",
      displayName: "List Vouchers",
      description: "List accounting vouchers (journal entries) from Fortnox.",
      parametersSchema: {
        type: "object",
        properties: {
          from_date: { type: "string", description: "Start date (YYYY-MM-DD)." },
          to_date: { type: "string", description: "End date (YYYY-MM-DD)." },
          voucher_series: { type: "string", description: "Voucher series (e.g. A, B, C)." },
          limit: { type: "integer", description: "Max results (default 100).", default: 100 },
        },
      },
    },
    {
      name: "fortnox_get_account_balance",
      displayName: "Get Account Balance",
      description: "Get the balance for a specific account number in Fortnox chart of accounts.",
      parametersSchema: {
        type: "object",
        properties: {
          account_number: { type: "integer", description: "Account number (e.g. 1930 for bank)." },
          financial_year: { type: "integer", description: "Financial year ID (omit for current year)." },
        },
        required: ["account_number"],
      },
    },
    {
      name: "fortnox_list_suppliers",
      displayName: "List Suppliers",
      description: "List suppliers registered in Fortnox.",
      parametersSchema: {
        type: "object",
        properties: {
          search: { type: "string", description: "Search by name or supplier number." },
          limit: { type: "integer", description: "Max results (default 100).", default: 100 },
        },
      },
    },
  ],
};

export default manifest;
