import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.xero",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Xero",
  description: "Connect to Xero accounting: invoices, contacts, accounts, balance sheet, payments, and credit notes.",
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
        title: "Xero Client ID (secret ref)",
        description: "UUID of a Paperclip secret holding your Xero OAuth2 client ID.",
        default: "",
      },
      clientSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "Xero Client Secret (secret ref)",
        description: "UUID of a Paperclip secret holding your Xero OAuth2 client secret.",
        default: "",
      },
      refreshTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "Xero Refresh Token (secret ref)",
        description: "UUID of a Paperclip secret holding your Xero OAuth2 refresh token.",
        default: "",
      },
      tenantId: {
        type: "string",
        title: "Xero Tenant ID",
        description: "Your Xero tenant (organisation) ID. Find it at developer.xero.com → My Apps → your app → connections.",
        default: "",
      },
    },
    required: ["clientIdRef", "clientSecretRef", "refreshTokenRef", "tenantId"],
  },
  tools: [
    {
      name: "xero_list_invoices",
      displayName: "List Invoices",
      description: "List Xero invoices, optionally filtered by status (DRAFT, AUTHORISED, PAID, VOIDED).",
      parametersSchema: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by invoice status: DRAFT, SUBMITTED, AUTHORISED, PAID, VOIDED." },
          page: { type: "number", description: "Page number (100 invoices per page)." },
        },
      },
    },
    {
      name: "xero_get_invoice",
      displayName: "Get Invoice",
      description: "Get a single Xero invoice by ID or invoice number.",
      parametersSchema: {
        type: "object",
        required: ["invoice_id"],
        properties: {
          invoice_id: { type: "string", description: "Invoice ID (UUID) or invoice number." },
        },
      },
    },
    {
      name: "xero_create_invoice",
      displayName: "Create Invoice",
      description: "Create a new invoice in Xero.",
      parametersSchema: {
        type: "object",
        required: ["contact_id", "line_items"],
        properties: {
          contact_id: { type: "string", description: "Xero contact ID for the customer." },
          type: { type: "string", description: "ACCREC (accounts receivable) or ACCPAY (accounts payable). Default: ACCREC." },
          date: { type: "string", description: "Invoice date in YYYY-MM-DD format (default: today)." },
          due_date: { type: "string", description: "Due date in YYYY-MM-DD format." },
          reference: { type: "string", description: "Your reference number or description." },
          line_items: {
            type: "array",
            description: "Array of line items with description, quantity, unit_amount, and account_code.",
            items: { type: "object", properties: {
              description: { type: "string", description: "Line item description." },
              quantity: { type: "number", description: "Quantity." },
              unit_amount: { type: "number", description: "Unit price." },
              account_code: { type: "string", description: "Xero account code." },
            }},
          },
        },
      },
    },
    {
      name: "xero_list_contacts",
      displayName: "List Contacts",
      description: "List Xero contacts (customers and suppliers).",
      parametersSchema: {
        type: "object",
        properties: {
          search: { type: "string", description: "Search contacts by name." },
          page: { type: "number", description: "Page number (100 per page)." },
        },
      },
    },
    {
      name: "xero_get_contact",
      displayName: "Get Contact",
      description: "Get a single Xero contact by ID.",
      parametersSchema: {
        type: "object",
        required: ["contact_id"],
        properties: {
          contact_id: { type: "string", description: "Contact ID (UUID)." },
        },
      },
    },
    {
      name: "xero_create_contact",
      displayName: "Create Contact",
      description: "Create a new contact in Xero.",
      parametersSchema: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", description: "Contact name." },
          email: { type: "string", description: "Contact email address." },
          phone: { type: "string", description: "Contact phone number." },
          is_customer: { type: "boolean", description: "Mark as customer (default: true)." },
          is_supplier: { type: "boolean", description: "Mark as supplier (default: false)." },
        },
      },
    },
    {
      name: "xero_list_accounts",
      displayName: "List Accounts",
      description: "List all chart of accounts entries in Xero.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "xero_get_balance_sheet",
      displayName: "Get Balance Sheet",
      description: "Get the Xero balance sheet report for a given date.",
      parametersSchema: {
        type: "object",
        properties: {
          date: { type: "string", description: "Report date in YYYY-MM-DD format (default: today)." },
        },
      },
    },
    {
      name: "xero_list_payments",
      displayName: "List Payments",
      description: "List invoice payments recorded in Xero.",
      parametersSchema: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status: AUTHORISED, DELETED." },
        },
      },
    },
    {
      name: "xero_list_credit_notes",
      displayName: "List Credit Notes",
      description: "List credit notes in Xero.",
      parametersSchema: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status: DRAFT, SUBMITTED, AUTHORISED, PAID, VOIDED." },
        },
      },
    },
  ],
};

export default manifest;
