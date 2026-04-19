import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.billy",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Billy",
  description: "Access Billy.dk accounting: invoices, contacts, accounts, products, and VAT returns.",
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
      accessTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "Billy API Access Token (secret ref)",
        description:
          "UUID of a Paperclip secret holding your Billy API access token (from mit.billy.dk → Indstillinger → API-adgang).",
        default: "",
      },
    },
    required: ["accessTokenRef"],
  },
  tools: [
    {
      name: "billy_list_invoices",
      displayName: "List Invoices",
      description: "List invoices from Billy. Optionally filter by state (draft, approved, unpaid, paid, voided).",
      parametersSchema: {
        type: "object",
        properties: {
          state: {
            type: "string",
            enum: ["draft", "approved", "unpaid", "paid", "voided"],
            description: "Invoice state filter.",
          },
          page_size: { type: "integer", description: "Results per page (max 1000, default 50)." },
        },
      },
    },
    {
      name: "billy_get_invoice",
      displayName: "Get Invoice",
      description: "Get full details of a specific Billy invoice including line items.",
      parametersSchema: {
        type: "object",
        required: ["invoice_id"],
        properties: {
          invoice_id: { type: "string", description: "The Billy invoice ID." },
        },
      },
    },
    {
      name: "billy_list_contacts",
      displayName: "List Contacts",
      description: "List contacts (customers and suppliers) in Billy.",
      parametersSchema: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["customer", "supplier"],
            description: "Contact type filter.",
          },
          name: { type: "string", description: "Filter by contact name (partial match)." },
          page_size: { type: "integer", description: "Results per page (default 100)." },
        },
      },
    },
    {
      name: "billy_get_contact",
      displayName: "Get Contact",
      description: "Get details of a specific Billy contact.",
      parametersSchema: {
        type: "object",
        required: ["contact_id"],
        properties: {
          contact_id: { type: "string", description: "The Billy contact ID." },
        },
      },
    },
    {
      name: "billy_list_accounts",
      displayName: "List Accounts",
      description: "List all accounts (chart of accounts) from Billy.",
      parametersSchema: {
        type: "object",
        properties: {
          page_size: { type: "integer", description: "Results per page (default 200)." },
        },
      },
    },
    {
      name: "billy_list_products",
      displayName: "List Products",
      description: "List products/services in Billy.",
      parametersSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Filter by product name." },
          page_size: { type: "integer", description: "Results per page (default 100)." },
        },
      },
    },
    {
      name: "billy_get_organization",
      displayName: "Get Organization",
      description: "Get information about the connected Billy organization (company name, CVR, etc.).",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "billy_list_vat_returns",
      displayName: "List VAT Returns",
      description: "List VAT (moms) returns from Billy.",
      parametersSchema: {
        type: "object",
        properties: {
          page_size: { type: "integer", description: "Results per page (default 20)." },
        },
      },
    },
    {
      name: "billy_create_invoice",
      displayName: "Create Invoice",
      description: "Create a new draft invoice in Billy.",
      parametersSchema: {
        type: "object",
        required: ["contact_id", "entry_date", "lines"],
        properties: {
          contact_id: { type: "string", description: "Billy contact ID for the customer." },
          entry_date: { type: "string", description: "Invoice date (YYYY-MM-DD)." },
          currency_id: { type: "string", description: "ISO currency code, e.g. DKK. Default: DKK." },
          lines: {
            type: "array",
            description: "Invoice lines.",
            items: {
              type: "object",
              required: ["description", "quantity", "unit_price"],
              properties: {
                product_id: { type: "string" },
                description: { type: "string" },
                quantity: { type: "number" },
                unit_price: { type: "number" },
                account_id: { type: "string" },
                tax_rate_id: { type: "string" },
              },
            },
          },
        },
      },
    },
  ],
};

export default manifest;
