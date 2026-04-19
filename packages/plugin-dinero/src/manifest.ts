import type { PluginManifest } from "@paperclipai/plugin-sdk";

const manifest: PluginManifest = {
  id: "gearloose.dinero",
  apiVersion: "1.0",
  displayName: "Dinero",
  description: "Access Dinero accounting: invoices, contacts, journal entries, VAT, bank statements.",
  capabilities: {
    "http.outbound": {
      allowedHosts: ["api.dinero.dk"]
    },
    "secrets.read-ref": {
      secrets: ["DINERO_ACCESS_TOKEN", "DINERO_ORG_ID"]
    },
    "agent.tools.register": {
      tools: [
        {
          name: "dinero_list_invoices",
          displayName: "List Invoices",
          description: "List sales invoices from Dinero. Filter by status (draft, sent, paid, overdue) and fiscal year.",
          parametersSchema: {
            type: "object",
            properties: {
              status: {
                type: "string",
                enum: ["draft", "sent", "paid", "overdue", "all"],
                description: "Filter invoices by status. Defaults to 'all'."
              },
              fiscal_year: {
                type: "integer",
                description: "Fiscal year (e.g. 2025). Defaults to current year."
              }
            }
          }
        },
        {
          name: "dinero_get_invoice",
          displayName: "Get Invoice",
          description: "Get details of a specific invoice by its GUID.",
          parametersSchema: {
            type: "object",
            required: ["guid"],
            properties: {
              guid: {
                type: "string",
                description: "The invoice GUID from Dinero."
              }
            }
          }
        },
        {
          name: "dinero_list_contacts",
          displayName: "List Contacts",
          description: "List all contacts (customers and suppliers) in Dinero.",
          parametersSchema: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["customer", "supplier", "all"],
                description: "Filter by contact type. Defaults to 'all'."
              },
              query: {
                type: "string",
                description: "Optional search query to filter contacts by name or CVR."
              }
            }
          }
        },
        {
          name: "dinero_get_balance",
          displayName: "Get Account Balance",
          description: "Get the current account balances and profit/loss overview from Dinero.",
          parametersSchema: {
            type: "object",
            properties: {
              fiscal_year: {
                type: "integer",
                description: "Fiscal year (e.g. 2025). Defaults to current year."
              }
            }
          }
        },
        {
          name: "dinero_list_journal_entries",
          displayName: "List Journal Entries",
          description: "Search journal entries (bogføringer) with optional date and amount filters.",
          parametersSchema: {
            type: "object",
            properties: {
              date_from: {
                type: "string",
                description: "Start date (YYYY-MM-DD)."
              },
              date_to: {
                type: "string",
                description: "End date (YYYY-MM-DD)."
              },
              account_number: {
                type: "string",
                description: "Filter by account number (e.g. '1000')."
              },
              page_size: {
                type: "integer",
                description: "Number of results per page (max 1000). Defaults to 100."
              }
            }
          }
        },
        {
          name: "dinero_get_vat_report",
          displayName: "Get VAT Report",
          description: "Get VAT (moms) report showing input VAT, output VAT, and amount to pay.",
          parametersSchema: {
            type: "object",
            properties: {
              year: {
                type: "integer",
                description: "Year for VAT report. Defaults to current year."
              },
              quarter: {
                type: "integer",
                enum: [1, 2, 3, 4],
                description: "Quarter (1-4). If omitted, returns year-to-date."
              }
            }
          }
        },
        {
          name: "dinero_list_products",
          displayName: "List Products",
          description: "List all products/services configured in Dinero.",
          parametersSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Optional search query to filter products."
              }
            }
          }
        },
        {
          name: "dinero_get_financial_summary",
          displayName: "Get Financial Summary",
          description: "Get a high-level financial summary: revenue, expenses, profit, and outstanding invoices.",
          parametersSchema: {
            type: "object",
            properties: {
              fiscal_year: {
                type: "integer",
                description: "Fiscal year (e.g. 2025). Defaults to current year."
              }
            }
          }
        }
      ]
    }
  },
  entrypoints: {
    worker: "./dist/worker.js"
  }
};

export default manifest;
