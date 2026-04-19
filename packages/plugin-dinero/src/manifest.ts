import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.dinero",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Dinero",
  description: "Access Dinero accounting: invoices, contacts, journal entries, VAT, bank statements.",
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
      dineroOrgId: {
        type: "string",
        title: "Dinero Organisation ID",
        description: "Your Dinero organisation ID (found in Dinero → Indstillinger → API).",
        default: "",
      },
      dineroClientIdRef: {
        type: "string",
        format: "secret-ref",
        title: "Dinero Client ID (secret ref)",
        description: "UUID of a Paperclip secret holding your Dinero OAuth2 client_id.",
        default: "",
      },
      dineroClientSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "Dinero Client Secret (secret ref)",
        description: "UUID of a Paperclip secret holding your Dinero OAuth2 client_secret.",
        default: "",
      },
      dineroApiKeyRef: {
        type: "string",
        format: "secret-ref",
        title: "Dinero API Key (secret ref)",
        description: "UUID of a Paperclip secret holding your Dinero organisation API key.",
        default: "",
      },
    },
    required: ["dineroOrgId", "dineroClientIdRef", "dineroClientSecretRef", "dineroApiKeyRef"],
  },
  tools: [
    {
      name: "dinero_list_invoices",
      displayName: "List Invoices",
      description: "List sales invoices from Dinero. Filter by status and fiscal year.",
      parametersSchema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["draft", "sent", "paid", "overdue", "all"], description: "Invoice status filter." },
          fiscal_year: { type: "integer", description: "Fiscal year (e.g. 2025)." },
        },
      },
    },
    {
      name: "dinero_get_invoice",
      displayName: "Get Invoice",
      description: "Get details of a specific invoice by GUID.",
      parametersSchema: {
        type: "object",
        required: ["guid"],
        properties: {
          guid: { type: "string", description: "The invoice GUID." },
        },
      },
    },
    {
      name: "dinero_list_contacts",
      displayName: "List Contacts",
      description: "List contacts (customers and suppliers) in Dinero.",
      parametersSchema: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["customer", "supplier", "all"], description: "Contact type filter." },
          query: { type: "string", description: "Search query to filter by name or CVR." },
        },
      },
    },
    {
      name: "dinero_get_balance",
      displayName: "Get Account Balance",
      description: "Get account balances and key financial figures from Dinero.",
      parametersSchema: {
        type: "object",
        properties: {
          fiscal_year: { type: "integer", description: "Fiscal year (e.g. 2025)." },
        },
      },
    },
    {
      name: "dinero_list_journal_entries",
      displayName: "List Journal Entries",
      description: "Search journal entries (bogføringer) with optional date and account filters.",
      parametersSchema: {
        type: "object",
        properties: {
          date_from: { type: "string", description: "Start date (YYYY-MM-DD)." },
          date_to: { type: "string", description: "End date (YYYY-MM-DD)." },
          account_number: { type: "string", description: "Filter by account number." },
          page_size: { type: "integer", description: "Results per page (max 1000)." },
        },
      },
    },
    {
      name: "dinero_get_vat_report",
      displayName: "Get VAT Report",
      description: "Get VAT (moms) report showing input VAT, output VAT, and net amount.",
      parametersSchema: {
        type: "object",
        properties: {
          year: { type: "integer", description: "Year for VAT report." },
          quarter: { type: "integer", enum: [1, 2, 3, 4], description: "Quarter (1-4). Omit for year-to-date." },
        },
      },
    },
    {
      name: "dinero_list_products",
      displayName: "List Products",
      description: "List all products/services configured in Dinero.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query to filter products." },
        },
      },
    },
    {
      name: "dinero_get_financial_summary",
      displayName: "Get Financial Summary",
      description: "High-level financial summary: revenue, expenses, profit, and outstanding invoices.",
      parametersSchema: {
        type: "object",
        properties: {
          fiscal_year: { type: "integer", description: "Fiscal year (e.g. 2025)." },
        },
      },
    },
    {
      name: "dinero_create_invoice",
      displayName: "Create Invoice",
      description: "Create a new draft invoice in Dinero.",
      parametersSchema: {
        type: "object",
        required: ["contact_guid", "date", "lines"],
        properties: {
          contact_guid: { type: "string", description: "Dinero contact GUID." },
          date: { type: "string", description: "Invoice date (YYYY-MM-DD)." },
          currency: { type: "string", description: "ISO currency code. Default: DKK." },
          payment_days: { type: "integer", description: "Net payment days (e.g. 14, 30)." },
          lines: {
            type: "array",
            description: "Invoice product lines.",
            items: {
              type: "object",
              required: ["description", "quantity", "base_amount_excl_vat"],
              properties: {
                product_guid: { type: "string" },
                description: { type: "string" },
                quantity: { type: "number" },
                unit: { type: "string", description: "Unit label, e.g. 'parts', 'hours'." },
                account_number: { type: "integer" },
                base_amount_excl_vat: { type: "number", description: "Unit price excl. VAT." },
              },
            },
          },
        },
      },
    },
    {
      name: "dinero_create_contact",
      displayName: "Create Contact",
      description: "Create a new contact (customer or supplier) in Dinero.",
      parametersSchema: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", description: "Contact name." },
          email: { type: "string" },
          phone: { type: "string" },
          address: { type: "string" },
          city: { type: "string" },
          zip_code: { type: "string" },
          country_key: { type: "string", description: "ISO country code, e.g. DK." },
          vat_number: { type: "string", description: "VAT / CVR number." },
          is_person: { type: "boolean", description: "True for individual, false for company (default)." },
          is_customer: { type: "boolean", description: "Mark as customer (default true)." },
          is_supplier: { type: "boolean", description: "Mark as supplier (default false)." },
        },
      },
    },
  ],
};

export default manifest;
