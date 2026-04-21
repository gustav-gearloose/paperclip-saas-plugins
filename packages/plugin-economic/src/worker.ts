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
    let cachedClient: EconomicClient | null = null;
    let configError: string | null = null;

    async function getClient(): Promise<EconomicClient | null> {
      if (cachedClient) return cachedClient;
      if (configError) return null;

const config = await ctx.config.get() as EconomicPluginConfig;
      const { appSecretTokenRef, agreementGrantTokenRef } = config;

      if (!appSecretTokenRef || !agreementGrantTokenRef) {
        configError = "e-conomic plugin: appSecretTokenRef and agreementGrantTokenRef are required";
        ctx.logger.warn("config missing");
        return null;
      }

      let appSecret: string, grantToken: string;
      try {
        [appSecret, grantToken] = await Promise.all([
          ctx.secrets.resolve(appSecretTokenRef),
          ctx.secrets.resolve(agreementGrantTokenRef),
        ]);
      } catch (err) {
        configError = `e-conomic plugin: failed to resolve secrets: ${err instanceof Error ? err.message : String(err)}`;
        ctx.logger.warn("config missing");
        return null;
      }

      cachedClient = new EconomicClient(appSecret, grantToken);
      return cachedClient;

      ctx.logger.info("e-conomic plugin: registering tools");
    }

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
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
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
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
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
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
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
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
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
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
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
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
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
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const data = await client.getCompanyInfo();
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "economic_create_draft_invoice",
      {
        displayName: "Create Draft Invoice",
        description: "Create a new draft invoice in e-conomic.",
        parametersSchema: {
          type: "object",
          required: ["customer_number", "date", "currency", "payment_terms_number", "recipient_name", "lines"],
          properties: {
            customer_number: { type: "integer", description: "e-conomic customer number." },
            date: { type: "string", description: "Invoice date (YYYY-MM-DD)." },
            currency: { type: "string", description: "ISO currency code, e.g. DKK." },
            payment_terms_number: { type: "integer", description: "e-conomic payment terms number." },
            recipient_name: { type: "string", description: "Recipient name on invoice." },
            recipient_address: { type: "string" },
            recipient_city: { type: "string" },
            recipient_zip: { type: "string" },
            lines: {
              type: "array",
              description: "Invoice lines.",
              items: {
                type: "object",
                required: ["description", "quantity", "unit_net_price"],
                properties: {
                  product_number: { type: "string" },
                  description: { type: "string" },
                  quantity: { type: "number" },
                  unit_net_price: { type: "number" },
                },
              },
            },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const lines = (p.lines as Array<Record<string, unknown>>).map((l, i) => ({
            lineNumber: i + 1,
            ...(l.product_number ? { product: { productNumber: l.product_number as string } } : {}),
            description: l.description as string,
            quantity: l.quantity as number,
            unitNetPrice: l.unit_net_price as number,
          }));
          const data = await client.createDraftInvoice({
            customer: { customerNumber: p.customer_number as number },
            date: p.date as string,
            currency: p.currency as string,
            paymentTerms: { paymentTermsNumber: p.payment_terms_number as number },
            recipient: {
              name: p.recipient_name as string,
              address: p.recipient_address as string | undefined,
              city: p.recipient_city as string | undefined,
              zip: p.recipient_zip as string | undefined,
            },
            lines,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "economic_list_journal_entries",
      {
        displayName: "List Journal Entries",
        description: "List journal voucher entries from e-conomic.",
        parametersSchema: {
          type: "object",
          properties: {
            journal_number: { type: "integer", description: "Journal number to fetch entries from. If omitted, lists all journals." },
            page_size: { type: "integer" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const journalNumber = p.journal_number as number | undefined;
          const data = journalNumber
            ? await client.getJournalEntries(journalNumber, { pageSize: p.page_size as number | undefined })
            : await client.listJournalEntries({ pageSize: p.page_size as number | undefined });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "economic_create_customer",
      {
        displayName: "Create Customer",
        description: "Create a new customer in e-conomic.",
        parametersSchema: {
          type: "object",
          required: ["name", "customer_group_number"],
          properties: {
            name: { type: "string", description: "Customer name." },
            customer_group_number: { type: "integer", description: "e-conomic customer group number (find via list_customers)." },
            currency: { type: "string", description: "ISO currency code (default DKK)." },
            payment_terms_number: { type: "integer", description: "Payment terms number (default 14)." },
            address: { type: "string" },
            city: { type: "string" },
            zip: { type: "string" },
            country: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.createCustomer({
            name: p.name as string,
            customerGroupNumber: p.customer_group_number as number,
            currency: p.currency as string | undefined,
            paymentTermsNumber: p.payment_terms_number as number | undefined,
            address: p.address as string | undefined,
            city: p.city as string | undefined,
            zip: p.zip as string | undefined,
            country: p.country as string | undefined,
            email: p.email as string | undefined,
            phone: p.phone as string | undefined,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "economic_book_draft_invoice",
      {
        displayName: "Book Draft Invoice",
        description: "Book (finalize) a draft invoice in e-conomic, converting it to a booked invoice with a permanent invoice number.",
        parametersSchema: {
          type: "object",
          required: ["draft_invoice_number"],
          properties: {
            draft_invoice_number: { type: "integer", description: "The draft invoice number to book." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.bookDraftInvoice(p.draft_invoice_number as number);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("e-conomic plugin ready — 11 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "e-conomic plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
