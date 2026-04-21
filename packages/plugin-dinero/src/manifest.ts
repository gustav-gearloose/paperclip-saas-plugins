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
      name: "dinero_list_entries",
      displayName: "List Ledger Entries",
      description: "List ledger entries (bogføringsposter) for a date range.",
      parametersSchema: {
        type: "object",
        properties: {
          from_date: { type: "string", description: "Start date (YYYY-MM-DD)." },
          to_date: { type: "string", description: "End date (YYYY-MM-DD)." },
          include_primo: { type: "boolean", description: "Include primo entries (default true)." },
        },
      },
    },
    {
      name: "dinero_list_entry_changes",
      displayName: "List Entry Changes",
      description: "List ledger entries changed since a given timestamp. Useful for syncing.",
      parametersSchema: {
        type: "object",
        required: ["changes_from"],
        properties: {
          changes_from: { type: "string", description: "ISO datetime — return entries changed after this (e.g. '2025-01-01T00:00:00')." },
          changes_to: { type: "string", description: "ISO datetime upper bound (optional)." },
          include_primo: { type: "boolean", description: "Include primo entries (default true)." },
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
              required: ["description", "quantity", "account_number", "base_amount_excl_vat"],
              properties: {
                product_guid: { type: "string", description: "Dinero product GUID (optional)." },
                description: { type: "string", description: "Line item description shown on invoice." },
                quantity: { type: "number", description: "Number of units." },
                unit: { type: "string", description: "Unit label, e.g. 'parts', 'hours'." },
                account_number: { type: "integer", description: "Required. Dinero ledger account number (e.g. 1000 for sales)." },
                base_amount_excl_vat: { type: "number", description: "Unit price excl. VAT." },
                discount: { type: "number", description: "Discount 0-100 (percent). Default 0." },
              },
            },
          },
        },
      },
    },
    {
      name: "dinero_create_contact",
      displayName: "Create Contact",
      description: "Create a new contact in Dinero. Debitor/creditor (customer/supplier) state is inferred by Dinero based on how the contact is used later (invoices make them a debitor, purchases a creditor) — no flag is set at creation time.",
      parametersSchema: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", description: "Contact name." },
          email: { type: "string", description: "Contact email address." },
          phone: { type: "string", description: "Contact phone number." },
          address: { type: "string", description: "Street address." },
          city: { type: "string", description: "City." },
          zip_code: { type: "string", description: "Postal/ZIP code." },
          country_key: { type: "string", description: "ISO country code, e.g. DK. Default: DK." },
          vat_number: { type: "string", description: "VAT / CVR number. For DK companies, Dinero will attempt a CVR lookup." },
          is_person: { type: "boolean", description: "True for individual, false for company (default)." },
        },
      },
    },
  ],
};

export default manifest;
