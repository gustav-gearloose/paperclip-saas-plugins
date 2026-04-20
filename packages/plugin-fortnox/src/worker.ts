import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { FortnoxClient } from "./fortnox-client.js";

interface FortnoxPluginConfig {
  accessTokenRef?: string;
  refreshTokenRef?: string;
  clientIdRef?: string;
  clientSecretRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as FortnoxPluginConfig;
    const { accessTokenRef, refreshTokenRef, clientIdRef, clientSecretRef } = config;

    if (!accessTokenRef || !refreshTokenRef || !clientIdRef || !clientSecretRef) {
      ctx.logger.error("Fortnox plugin: all four secret refs are required");
      return;
    }

    let accessToken: string, refreshToken: string, clientId: string, clientSecret: string;
    try {
      [accessToken, refreshToken, clientId, clientSecret] = await Promise.all([
        ctx.secrets.resolve(accessTokenRef),
        ctx.secrets.resolve(refreshTokenRef),
        ctx.secrets.resolve(clientIdRef),
        ctx.secrets.resolve(clientSecretRef),
      ]);
    } catch (err) {
      ctx.logger.error(`Fortnox plugin: failed to resolve secrets: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    ctx.logger.info("Fortnox plugin: secrets resolved, registering tools");
    const client = new FortnoxClient({ accessToken, refreshToken, clientId, clientSecret });

    ctx.tools.register(
      "fortnox_list_invoices",
      {
        displayName: "List Invoices",
        description: "List sales invoices from Fortnox. Filter by customer, status, or date range.",
        parametersSchema: {
          type: "object",
          properties: {
            customer_number: { type: "string", description: "Filter by customer number." },
            filter: { type: "string", enum: ["unpaid", "unpaidoverdue", "paid", "cancelled", "fullypaid"] },
            from_date: { type: "string", description: "Start date (YYYY-MM-DD)." },
            to_date: { type: "string", description: "End date (YYYY-MM-DD)." },
            limit: { type: "integer", default: 100 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const invoices = await client.listInvoices(params as Parameters<typeof client.listInvoices>[0]);
          return { content: JSON.stringify(invoices, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "fortnox_get_invoice",
      {
        displayName: "Get Invoice",
        description: "Get full details for a specific Fortnox invoice by document number.",
        parametersSchema: {
          type: "object",
          properties: {
            document_number: { type: "string", description: "Invoice document number." },
          },
          required: ["document_number"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { document_number: string };
          const invoice = await client.getInvoice(p.document_number);
          return { content: JSON.stringify(invoice, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "fortnox_create_invoice",
      {
        displayName: "Create Invoice",
        description: "Create a new sales invoice in Fortnox.",
        parametersSchema: {
          type: "object",
          properties: {
            customer_number: { type: "string" },
            invoice_date: { type: "string" },
            due_date: { type: "string" },
            invoice_rows: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  article_number: { type: "string" },
                  description: { type: "string" },
                  quantity: { type: "number" },
                  price: { type: "number" },
                  vat: { type: "integer" },
                },
              },
            },
            your_order_number: { type: "string" },
            remarks: { type: "string" },
          },
          required: ["customer_number", "invoice_rows"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const invoice = await client.createInvoice(params as Parameters<typeof client.createInvoice>[0]);
          return { content: JSON.stringify(invoice, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "fortnox_list_customers",
      {
        displayName: "List Customers",
        description: "List customers registered in Fortnox.",
        parametersSchema: {
          type: "object",
          properties: {
            search: { type: "string" },
            limit: { type: "integer", default: 100 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const customers = await client.listCustomers(params as Parameters<typeof client.listCustomers>[0]);
          return { content: JSON.stringify(customers, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "fortnox_get_customer",
      {
        displayName: "Get Customer",
        description: "Get full details for a specific Fortnox customer.",
        parametersSchema: {
          type: "object",
          properties: {
            customer_number: { type: "string" },
          },
          required: ["customer_number"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { customer_number: string };
          const customer = await client.getCustomer(p.customer_number);
          return { content: JSON.stringify(customer, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "fortnox_create_customer",
      {
        displayName: "Create Customer",
        description: "Create a new customer in Fortnox.",
        parametersSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            address1: { type: "string" },
            city: { type: "string" },
            zip_code: { type: "string" },
            country_code: { type: "string" },
            organisation_number: { type: "string" },
            vat_number: { type: "string" },
            currency: { type: "string", default: "SEK" },
          },
          required: ["name"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const customer = await client.createCustomer(params as Parameters<typeof client.createCustomer>[0]);
          return { content: JSON.stringify(customer, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "fortnox_list_articles",
      {
        displayName: "List Articles",
        description: "List products/articles in Fortnox product registry.",
        parametersSchema: {
          type: "object",
          properties: {
            search: { type: "string" },
            limit: { type: "integer", default: 100 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const articles = await client.listArticles(params as Parameters<typeof client.listArticles>[0]);
          return { content: JSON.stringify(articles, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "fortnox_list_vouchers",
      {
        displayName: "List Vouchers",
        description: "List accounting vouchers (journal entries) from Fortnox.",
        parametersSchema: {
          type: "object",
          properties: {
            from_date: { type: "string" },
            to_date: { type: "string" },
            voucher_series: { type: "string" },
            limit: { type: "integer", default: 100 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const vouchers = await client.listVouchers(params as Parameters<typeof client.listVouchers>[0]);
          return { content: JSON.stringify(vouchers, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "fortnox_get_account_balance",
      {
        displayName: "Get Account Balance",
        description: "Get the balance for a specific account number in Fortnox chart of accounts.",
        parametersSchema: {
          type: "object",
          properties: {
            account_number: { type: "integer" },
            financial_year: { type: "integer" },
          },
          required: ["account_number"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { account_number: number; financial_year?: number };
          const account = await client.getAccount(p.account_number, p.financial_year);
          return { content: JSON.stringify(account, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "fortnox_list_suppliers",
      {
        displayName: "List Suppliers",
        description: "List suppliers registered in Fortnox.",
        parametersSchema: {
          type: "object",
          properties: {
            search: { type: "string" },
            limit: { type: "integer", default: 100 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const suppliers = await client.listSuppliers(params as Parameters<typeof client.listSuppliers>[0]);
          return { content: JSON.stringify(suppliers, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Fortnox plugin ready — 10 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "Fortnox plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
