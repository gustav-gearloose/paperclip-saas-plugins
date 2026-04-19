import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { EconomicClient } from "./economic-client.js";

interface EconomicPluginConfig {
  appSecretTokenRef?: string;
  agreementGrantTokenRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as EconomicPluginConfig;
    const { appSecretTokenRef, agreementGrantTokenRef } = config;

    if (!appSecretTokenRef || !agreementGrantTokenRef) {
      ctx.logger.error("e-conomic plugin: appSecretTokenRef and agreementGrantTokenRef are required");
      return;
    }

    let appSecret: string, grantToken: string;
    try {
      [appSecret, grantToken] = await Promise.all([
        ctx.secrets.resolve(appSecretTokenRef),
        ctx.secrets.resolve(agreementGrantTokenRef),
      ]);
    } catch (err) {
      ctx.logger.error(`e-conomic plugin: failed to resolve secrets: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    const client = new EconomicClient(appSecret, grantToken);

    ctx.logger.info("e-conomic plugin: registering tools");

    ctx.tools.register(
      "economic_list_invoices",
      {
        displayName: "List Invoices",
        description: "List booked invoices from e-conomic. Filter by date range.",
        parametersSchema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["booked", "draft", "all"] },
            date_from: { type: "string" },
            date_to: { type: "string" },
            page_size: { type: "integer" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const status = (p.status as string) ?? "booked";
          const opts = {
            pageSize: p.page_size as number | undefined,
            dateFrom: p.date_from as string | undefined,
            dateTo: p.date_to as string | undefined,
          };
          let data: unknown;
          if (status === "draft") {
            data = await client.listDraftInvoices(opts);
          } else if (status === "all") {
            const [booked, draft] = await Promise.allSettled([
              client.listBookedInvoices(opts),
              client.listDraftInvoices(opts),
            ]);
            data = {
              booked: booked.status === "fulfilled" ? booked.value : null,
              draft: draft.status === "fulfilled" ? draft.value : null,
            };
          } else {
            data = await client.listBookedInvoices(opts);
          }
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "economic_get_invoice",
      {
        displayName: "Get Invoice",
        description: "Get details of a specific invoice by invoice number.",
        parametersSchema: {
          type: "object",
          required: ["invoice_number"],
          properties: {
            invoice_number: { type: "integer" },
            type: { type: "string", enum: ["booked", "draft"] },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const type = (p.type as string) ?? "booked";
          const number = p.invoice_number as number;
          const data = type === "draft"
            ? await client.getDraftInvoice(number)
            : await client.getBookedInvoice(number);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "economic_list_customers",
      {
        displayName: "List Customers",
        description: "List customers in e-conomic. Optionally filter by name.",
        parametersSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            page_size: { type: "integer" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listCustomers({
            query: p.query as string | undefined,
            pageSize: p.page_size as number | undefined,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "economic_get_customer",
      {
        displayName: "Get Customer",
        description: "Get details of a specific customer by customer number.",
        parametersSchema: {
          type: "object",
          required: ["customer_number"],
          properties: {
            customer_number: { type: "integer" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.getCustomer(p.customer_number as number);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "economic_list_accounts",
      {
        displayName: "List Accounts",
        description: "List all accounts (chart of accounts) from e-conomic.",
        parametersSchema: {
          type: "object",
          properties: {
            page_size: { type: "integer" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listAccounts({ pageSize: p.page_size as number | undefined });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "economic_list_products",
      {
        displayName: "List Products",
        description: "List products/services in e-conomic. Optionally filter by name.",
        parametersSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            page_size: { type: "integer" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listProducts({
            query: p.query as string | undefined,
            pageSize: p.page_size as number | undefined,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "economic_get_company_info",
      {
        displayName: "Get Company Info",
        description: "Get information about the connected e-conomic account and company.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const data = await client.getCompanyInfo();
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("e-conomic plugin ready — 7 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "e-conomic plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
