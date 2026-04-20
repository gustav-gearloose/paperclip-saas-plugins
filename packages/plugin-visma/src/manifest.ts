import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.visma",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Visma eAccounting",
  description: "Connect to Visma eAccounting: customer invoices, customers, articles, account balances, vouchers, and fiscal years.",
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
        title: "Visma Client ID (secret ref)",
        description: "UUID of a Paperclip secret holding your Visma OAuth2 client ID.",
        default: "",
      },
      clientSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "Visma Client Secret (secret ref)",
        description: "UUID of a Paperclip secret holding your Visma OAuth2 client secret.",
        default: "",
      },
      refreshTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "Visma Refresh Token (secret ref)",
        description: "UUID of a Paperclip secret holding your Visma OAuth2 refresh token.",
        default: "",
      },
    },
    required: ["clientIdRef", "clientSecretRef", "refreshTokenRef"],
  },
  tools: [
    {
      name: "visma_list_invoices",
      displayName: "List Customer Invoices",
      description: "List Visma eAccounting customer invoices.",
      parametersSchema: {
        type: "object",
        properties: {
          page: { type: "number", description: "Page number (100 invoices per page)." },
        },
      },
    },
    {
      name: "visma_get_invoice",
      displayName: "Get Customer Invoice",
      description: "Get a single Visma customer invoice by ID.",
      parametersSchema: {
        type: "object",
        required: ["invoice_id"],
        properties: {
          invoice_id: { type: "string", description: "Customer invoice ID (UUID)." },
        },
      },
    },
    {
      name: "visma_create_invoice",
      displayName: "Create Customer Invoice",
      description: "Create a new customer invoice in Visma eAccounting.",
      parametersSchema: {
        type: "object",
        required: ["customer_id", "rows"],
        properties: {
          customer_id: { type: "string", description: "Visma customer ID." },
          your_reference: { type: "string", description: "Your reference text shown on the invoice." },
          rows: {
            type: "array",
            description: "Invoice rows.",
            items: {
              type: "object",
              properties: {
                article_id: { type: "string", description: "Visma article ID." },
                article_number: { type: "string", description: "Article number (alternative to article_id)." },
                description: { type: "string", description: "Row description." },
                quantity: { type: "number", description: "Quantity." },
                unit_price: { type: "number", description: "Unit price excl. VAT." },
              },
            },
          },
        },
      },
    },
    {
      name: "visma_list_customers",
      displayName: "List Customers",
      description: "List customers in Visma eAccounting.",
      parametersSchema: {
        type: "object",
        properties: {
          page: { type: "number", description: "Page number (100 per page)." },
        },
      },
    },
    {
      name: "visma_get_customer",
      displayName: "Get Customer",
      description: "Get a single Visma customer by ID.",
      parametersSchema: {
        type: "object",
        required: ["customer_id"],
        properties: {
          customer_id: { type: "string", description: "Customer ID (UUID)." },
        },
      },
    },
    {
      name: "visma_create_customer",
      displayName: "Create Customer",
      description: "Create a new customer in Visma eAccounting.",
      parametersSchema: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", description: "Customer name." },
          email: { type: "string", description: "Customer email address." },
          phone: { type: "string", description: "Customer phone number." },
          vat_number: { type: "string", description: "Customer VAT registration number." },
        },
      },
    },
    {
      name: "visma_list_articles",
      displayName: "List Articles",
      description: "List articles (products/services) in Visma eAccounting.",
      parametersSchema: {
        type: "object",
        properties: {
          page: { type: "number", description: "Page number (100 per page)." },
        },
      },
    },
    {
      name: "visma_get_account_balances",
      displayName: "Get Account Balances",
      description: "Get account balance snapshot for a given date in Visma eAccounting.",
      parametersSchema: {
        type: "object",
        required: ["date"],
        properties: {
          date: { type: "string", description: "Date in YYYY-MM-DD format." },
        },
      },
    },
    {
      name: "visma_list_vouchers",
      displayName: "List Vouchers",
      description: "List accounting vouchers (journal entries) in Visma eAccounting.",
      parametersSchema: {
        type: "object",
        properties: {
          page: { type: "number", description: "Page number (100 per page)." },
        },
      },
    },
    {
      name: "visma_list_fiscal_years",
      displayName: "List Fiscal Years",
      description: "List all fiscal years configured in Visma eAccounting.",
      parametersSchema: { type: "object", properties: {} },
    },
  ],
};

export default manifest;
