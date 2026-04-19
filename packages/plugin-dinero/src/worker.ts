import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import { DineroClient } from "./dinero-client.js";

const plugin = definePlugin({
  async setup(ctx) {
    const accessToken = await ctx.secrets.get("DINERO_ACCESS_TOKEN");
    const orgId = await ctx.secrets.get("DINERO_ORG_ID");

    if (!accessToken || !orgId) {
      ctx.logger.error("Missing required secrets: DINERO_ACCESS_TOKEN, DINERO_ORG_ID");
      return;
    }

    const client = new DineroClient({ accessToken, orgId });

    ctx.tools.handle("dinero_list_invoices", async (params) => {
      try {
        const data = await client.listInvoices({
          status: params.status as string | undefined,
          fiscalYear: params.fiscal_year as number | undefined
        });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    });

    ctx.tools.handle("dinero_get_invoice", async (params) => {
      try {
        const data = await client.getInvoice(params.guid as string);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    });

    ctx.tools.handle("dinero_list_contacts", async (params) => {
      try {
        const data = await client.listContacts({
          type: params.type as string | undefined,
          query: params.query as string | undefined
        });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    });

    ctx.tools.handle("dinero_get_balance", async (params) => {
      try {
        const [accounts, keyFigures] = await Promise.allSettled([
          client.listAccounts(params.fiscal_year as number | undefined),
          client.getKeyFigures(params.fiscal_year as number | undefined)
        ]);
        const data = {
          accounts: accounts.status === "fulfilled" ? accounts.value : null,
          keyFigures: keyFigures.status === "fulfilled" ? keyFigures.value : null
        };
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    });

    ctx.tools.handle("dinero_list_journal_entries", async (params) => {
      try {
        const data = await client.listJournalEntries({
          dateFrom: params.date_from as string | undefined,
          dateTo: params.date_to as string | undefined,
          accountNumber: params.account_number as string | undefined,
          pageSize: params.page_size as number | undefined
        });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    });

    ctx.tools.handle("dinero_get_vat_report", async (params) => {
      try {
        const data = await client.getVatReport({
          year: params.year as number | undefined,
          quarter: params.quarter as number | undefined
        });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    });

    ctx.tools.handle("dinero_list_products", async (params) => {
      try {
        const data = await client.listProducts({
          query: params.query as string | undefined
        });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    });

    ctx.tools.handle("dinero_get_financial_summary", async (params) => {
      try {
        const data = await client.getFinancialSummary(params.fiscal_year as number | undefined);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    });

    ctx.logger.info("Dinero plugin ready");
  },

  onHealth() {
    return { status: "ok" };
  }
});

runWorker(plugin, import.meta.url);
