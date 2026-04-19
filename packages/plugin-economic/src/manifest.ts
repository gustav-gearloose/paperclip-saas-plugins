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
  ],
};

export default manifest;
