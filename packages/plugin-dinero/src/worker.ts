import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { DineroClient } from "./dinero-client.js";

interface DineroPluginConfig {
  dineroOrgId?: string;
  dineroClientIdRef?: string;
  dineroClientSecretRef?: string;
  dineroApiKeyRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const NOT_CONFIGURED = { error: "Dinero plugin not configured — set dineroOrgId, dineroClientIdRef, dineroClientSecretRef, dineroApiKeyRef in plugin settings." };

const plugin = definePlugin({
  async setup(ctx) {
    let cachedClient: DineroClient | null = null;
    let configError: string | null = null;

    async function getClient(): Promise<DineroClient | null> {
      if (cachedClient) return cachedClient;
      if (configError) return null;

      const config = await ctx.config.get() as DineroPluginConfig;
      const { dineroOrgId: orgId, dineroClientIdRef, dineroClientSecretRef, dineroApiKeyRef } = config;

      if (!orgId || !dineroClientIdRef || !dineroClientSecretRef || !dineroApiKeyRef) {
        configError = "Dinero plugin not configured — set dineroOrgId, dineroClientIdRef, dineroClientSecretRef, dineroApiKeyRef in plugin settings.";
        ctx.logger.warn("Dinero plugin: missing required config fields");
        return null;
      }

      let clientId: string, clientSecret: string, apiKey: string;
      try {
        [clientId, clientSecret, apiKey] = await Promise.all([
          ctx.secrets.resolve(dineroClientIdRef),
          ctx.secrets.resolve(dineroClientSecretRef),
          ctx.secrets.resolve(dineroApiKeyRef),
        ]);
      } catch (err) {
        configError = `Dinero plugin: failed to resolve secrets — ${err instanceof Error ? err.message : String(err)}`;
        ctx.logger.error(configError);
        return null;
      }

      cachedClient = new DineroClient({ clientId, clientSecret, apiKey, orgId });
      return cachedClient;
    }

    ctx.tools.register(
      "dinero_list_invoices",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? NOT_CONFIGURED.error };
          const p = params as Record<string, unknown>;
          const data = await client.listInvoices({
            status: p.status as string | undefined,
            fiscalYear: p.fiscal_year as number | undefined,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "dinero_get_invoice",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? NOT_CONFIGURED.error };
          const p = params as Record<string, unknown>;
          const data = await client.getInvoice(p.guid as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "dinero_list_contacts",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? NOT_CONFIGURED.error };
          const p = params as Record<string, unknown>;
          const data = await client.listContacts({
            type: p.type as string | undefined,
            query: p.query as string | undefined,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "dinero_get_balance",
      {
        displayName: "Get Account Balance",
        description: "Get account balances and key financial figures from Dinero.",
        parametersSchema: {
          type: "object",
          properties: {
            fiscal_year: { type: "integer", description: "Fiscal year (e.g. 2025)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? NOT_CONFIGURED.error };
          const p = params as Record<string, unknown>;
          const [accounts, keyFigures] = await Promise.allSettled([
            client.listAccounts(p.fiscal_year as number | undefined),
            client.getKeyFigures(p.fiscal_year as number | undefined),
          ]);
          return { content: JSON.stringify({
            accounts: accounts.status === "fulfilled" ? accounts.value : null,
            keyFigures: keyFigures.status === "fulfilled" ? keyFigures.value : null,
          }, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "dinero_list_entries",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? NOT_CONFIGURED.error };
          const p = params as Record<string, unknown>;
          const data = await client.listEntries({
            fromDate: p.from_date as string | undefined,
            toDate: p.to_date as string | undefined,
            includePrimo: p.include_primo as boolean | undefined,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "dinero_list_entry_changes",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? NOT_CONFIGURED.error };
          const p = params as Record<string, unknown>;
          const data = await client.listEntryChanges({
            changesFrom: p.changes_from as string,
            changesTo: p.changes_to as string | undefined,
            includePrimo: p.include_primo as boolean | undefined,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "dinero_get_vat_report",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? NOT_CONFIGURED.error };
          const p = params as Record<string, unknown>;
          const data = await client.getVatReport({
            year: p.year as number | undefined,
            quarter: p.quarter as number | undefined,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "dinero_list_products",
      {
        displayName: "List Products",
        description: "List all products/services configured in Dinero.",
        parametersSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query to filter products." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? NOT_CONFIGURED.error };
          const p = params as Record<string, unknown>;
          const data = await client.listProducts({ query: p.query as string | undefined });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "dinero_get_financial_summary",
      {
        displayName: "Get Financial Summary",
        description: "High-level financial summary: revenue, expenses, profit, and outstanding invoices.",
        parametersSchema: {
          type: "object",
          properties: {
            fiscal_year: { type: "integer", description: "Fiscal year (e.g. 2025)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? NOT_CONFIGURED.error };
          const p = params as Record<string, unknown>;
          const data = await client.getFinancialSummary(p.fiscal_year as number | undefined);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "dinero_create_invoice",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? NOT_CONFIGURED.error };
          const p = params as Record<string, unknown>;
          const lines = (p.lines as Array<Record<string, unknown>>).map((l) => ({
            productGuid: l.product_guid as string | undefined,
            description: l.description as string,
            quantity: l.quantity as number,
            unit: l.unit as string | undefined,
            accountNumber: l.account_number as number | undefined,
            baseAmountExclVat: l.base_amount_excl_vat as number,
          }));
          const data = await client.createInvoice({
            contactGuid: p.contact_guid as string,
            date: p.date as string,
            currency: p.currency as string | undefined,
            paymentConditionNumberOfDays: p.payment_days as number | undefined,
            lines,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "dinero_create_contact",
      {
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
            is_person: { type: "boolean", description: "True for individual contacts (default false = company)." },
            is_customer: { type: "boolean", description: "Mark as customer (default true)." },
            is_supplier: { type: "boolean", description: "Mark as supplier (default false)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? NOT_CONFIGURED.error };
          const p = params as Record<string, unknown>;
          const data = await client.createContact({
            name: p.name as string,
            email: p.email as string | undefined,
            phone: p.phone as string | undefined,
            address: p.address as string | undefined,
            city: p.city as string | undefined,
            zipCode: p.zip_code as string | undefined,
            countryKey: p.country_key as string | undefined,
            vatNumber: p.vat_number as string | undefined,
            isPerson: p.is_person as boolean | undefined,
            isCustomer: p.is_customer as boolean | undefined,
            isSupplier: p.is_supplier as boolean | undefined,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Dinero plugin ready — 11 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "Dinero plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
