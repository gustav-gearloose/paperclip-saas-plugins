import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { VismaClient } from "./visma-client.js";

interface VismaPluginConfig {
  clientIdRef?: string;
  clientSecretRef?: string;
  refreshTokenRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as VismaPluginConfig;
    const { clientIdRef, clientSecretRef, refreshTokenRef } = config;

    if (!clientIdRef || !clientSecretRef || !refreshTokenRef) {
      ctx.logger.error("visma plugin: clientIdRef, clientSecretRef, and refreshTokenRef are required");
      return;
    }

    let clientId: string, clientSecret: string, refreshToken: string;
    try {
      [clientId, clientSecret, refreshToken] = await Promise.all([
        ctx.secrets.resolve(clientIdRef),
        ctx.secrets.resolve(clientSecretRef),
        ctx.secrets.resolve(refreshTokenRef),
      ]);
    } catch (err) {
      ctx.logger.error(`visma plugin: failed to resolve secrets: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    const client = new VismaClient(clientId, clientSecret, refreshToken);

    ctx.logger.info("visma plugin: registering tools");

    ctx.tools.register(
      "visma_list_invoices",
      {
        displayName: "List Customer Invoices",
        description: "List Visma eAccounting customer invoices.",
        parametersSchema: {
          type: "object",
          properties: {
            page: { type: "number", description: "Page number (100 invoices per page)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listCustomerInvoices({ page: p.page as number | undefined });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "visma_get_invoice",
      {
        displayName: "Get Customer Invoice",
        description: "Get a single Visma customer invoice by ID.",
        parametersSchema: {
          type: "object",
          required: ["invoice_id"],
          properties: {
            invoice_id: { type: "string", description: "Customer invoice ID (UUID)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.getCustomerInvoice(p.invoice_id as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "visma_create_invoice",
      {
        displayName: "Create Customer Invoice",
        description: "Create a new customer invoice in Visma eAccounting.",
        parametersSchema: {
          type: "object",
          required: ["customer_id", "rows"],
          properties: {
            customer_id: { type: "string", description: "Visma customer ID." },
            your_reference: { type: "string", description: "Your reference text shown on the invoice." },
            rows: {
              type: "array",
              description: "Invoice rows.",
              items: {
                type: "object",
                properties: {
                  article_id: { type: "string" },
                  article_number: { type: "string" },
                  description: { type: "string" },
                  quantity: { type: "number" },
                  unit_price: { type: "number" },
                },
              },
            },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const rows = (p.rows as Array<Record<string, unknown>>).map(r => ({
            ArticleId: r.article_id,
            ArticleNumber: r.article_number,
            Description: r.description,
            Quantity: r.quantity ?? 1,
            UnitPrice: r.unit_price,
          }));
          const invoice: Record<string, unknown> = {
            Customer: { Id: p.customer_id },
            Rows: rows,
          };
          if (p.your_reference) invoice.YourReference = p.your_reference;
          const data = await client.createCustomerInvoice(invoice);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "visma_list_customers",
      {
        displayName: "List Customers",
        description: "List customers in Visma eAccounting.",
        parametersSchema: {
          type: "object",
          properties: {
            page: { type: "number", description: "Page number (100 per page)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listCustomers({ page: p.page as number | undefined });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "visma_get_customer",
      {
        displayName: "Get Customer",
        description: "Get a single Visma customer by ID.",
        parametersSchema: {
          type: "object",
          required: ["customer_id"],
          properties: {
            customer_id: { type: "string", description: "Customer ID (UUID)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.getCustomer(p.customer_id as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "visma_create_customer",
      {
        displayName: "Create Customer",
        description: "Create a new customer in Visma eAccounting.",
        parametersSchema: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", description: "Customer name." },
            email: { type: "string", description: "Customer email address." },
            phone: { type: "string", description: "Customer phone number." },
            vat_number: { type: "string", description: "Customer VAT registration number." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const customer: Record<string, unknown> = { Name: p.name };
          if (p.email) customer.Email = p.email;
          if (p.phone) customer.Phone = p.phone;
          if (p.vat_number) customer.VatNumber = p.vat_number;
          const data = await client.createCustomer(customer);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "visma_list_articles",
      {
        displayName: "List Articles",
        description: "List articles (products/services) in Visma eAccounting.",
        parametersSchema: {
          type: "object",
          properties: {
            page: { type: "number", description: "Page number (100 per page)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listArticles({ page: p.page as number | undefined });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "visma_get_account_balances",
      {
        displayName: "Get Account Balances",
        description: "Get account balance snapshot for a given date in Visma eAccounting.",
        parametersSchema: {
          type: "object",
          required: ["date"],
          properties: {
            date: { type: "string", description: "Date in YYYY-MM-DD format." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.getAccountBalances(p.date as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "visma_list_vouchers",
      {
        displayName: "List Vouchers",
        description: "List accounting vouchers (journal entries) in Visma eAccounting.",
        parametersSchema: {
          type: "object",
          properties: {
            page: { type: "number", description: "Page number (100 per page)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listVouchers({ page: p.page as number | undefined });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "visma_list_fiscal_years",
      {
        displayName: "List Fiscal Years",
        description: "List all fiscal years configured in Visma eAccounting.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const data = await client.listFiscalYears();
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
