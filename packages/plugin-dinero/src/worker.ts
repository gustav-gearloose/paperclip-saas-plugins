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

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as DineroPluginConfig;
    const { dineroOrgId: orgId, dineroClientIdRef, dineroClientSecretRef, dineroApiKeyRef } = config;

    if (!orgId || !dineroClientIdRef || !dineroClientSecretRef || !dineroApiKeyRef) {
      ctx.logger.error("Dinero plugin: dineroOrgId, dineroClientIdRef, dineroClientSecretRef, dineroApiKeyRef are all required");
      return;
    }

    let clientId: string, clientSecret: string, apiKey: string;
    try {
      [clientId, clientSecret, apiKey] = await Promise.all([
        ctx.secrets.resolve(dineroClientIdRef),
        ctx.secrets.resolve(dineroClientSecretRef),
        ctx.secrets.resolve(dineroApiKeyRef),
      ]);
    } catch (err) {
      ctx.logger.error(`Dinero plugin: failed to resolve secrets: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    // Fetch a bearer token from Dinero's OAuth2 server using Basic auth + API key as password
    let bearerToken: string;
    try {
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const tokenRes = await fetch("https://authz.dinero.dk/dineroapi/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${basicAuth}`,
        },
        body: new URLSearchParams({
          grant_type: "password",
          scope: "read write",
          username: apiKey,
          password: apiKey,
        }),
      });
      if (!tokenRes.ok) {
        const body = await tokenRes.text().catch(() => "");
        throw new Error(`Token endpoint returned ${tokenRes.status}: ${body}`);
      }
      const tokenJson = await tokenRes.json() as Record<string, unknown>;
      bearerToken = tokenJson["access_token"] as string;
      if (!bearerToken) throw new Error("No access_token in response");
    } catch (err) {
      ctx.logger.error(`Dinero plugin: failed to obtain bearer token: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    ctx.logger.info("Dinero plugin: bearer token obtained, registering tools");
    const client = new DineroClient({ accessToken: bearerToken, orgId });

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
      "dinero_list_journal_entries",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listJournalEntries({
            dateFrom: p.date_from as string | undefined,
            dateTo: p.date_to as string | undefined,
            accountNumber: p.account_number as string | undefined,
            pageSize: p.page_size as number | undefined,
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

    ctx.logger.info("Dinero plugin ready — 9 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "Dinero plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
