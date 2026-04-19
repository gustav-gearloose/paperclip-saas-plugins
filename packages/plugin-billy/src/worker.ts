import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { BillyClient } from "./billy-client.js";

interface BillyPluginConfig {
  accessTokenRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as BillyPluginConfig;
    const { accessTokenRef } = config;

    if (!accessTokenRef) {
      ctx.logger.error("Billy plugin: accessTokenRef is required");
      return;
    }

    let accessToken: string;
    try {
      accessToken = await ctx.secrets.resolve(accessTokenRef);
    } catch (err) {
      ctx.logger.error(`Billy plugin: failed to resolve secret: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    const client = new BillyClient(accessToken);
    ctx.logger.info("Billy plugin: registering tools");

    ctx.tools.register(
      "billy_list_invoices",
      {
        displayName: "List Invoices",
        description: "List invoices from Billy. Optionally filter by state.",
        parametersSchema: {
          type: "object",
          properties: {
            state: { type: "string", enum: ["draft", "approved", "unpaid", "paid", "voided"] },
            page_size: { type: "integer" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listInvoices({
            state: p.state as string | undefined,
            pageSize: p.page_size as number | undefined,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "billy_get_invoice",
      {
        displayName: "Get Invoice",
        description: "Get full details of a specific Billy invoice including line items.",
        parametersSchema: {
          type: "object",
          required: ["invoice_id"],
          properties: { invoice_id: { type: "string" } },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.getInvoice(p.invoice_id as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "billy_list_contacts",
      {
        displayName: "List Contacts",
        description: "List contacts in Billy.",
        parametersSchema: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["customer", "supplier"] },
            name: { type: "string" },
            page_size: { type: "integer" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listContacts({
            type: p.type as string | undefined,
            name: p.name as string | undefined,
            pageSize: p.page_size as number | undefined,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "billy_get_contact",
      {
        displayName: "Get Contact",
        description: "Get details of a specific Billy contact.",
        parametersSchema: {
          type: "object",
          required: ["contact_id"],
          properties: { contact_id: { type: "string" } },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.getContact(p.contact_id as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "billy_list_accounts",
      {
        displayName: "List Accounts",
        description: "List all accounts (chart of accounts) from Billy.",
        parametersSchema: {
          type: "object",
          properties: { page_size: { type: "integer" } },
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
      "billy_list_products",
      {
        displayName: "List Products",
        description: "List products/services in Billy.",
        parametersSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            page_size: { type: "integer" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listProducts({
            name: p.name as string | undefined,
            pageSize: p.page_size as number | undefined,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "billy_get_organization",
      {
        displayName: "Get Organization",
        description: "Get information about the connected Billy organization.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const data = await client.getOrganization();
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "billy_list_vat_returns",
      {
        displayName: "List VAT Returns",
        description: "List VAT (moms) returns from Billy.",
        parametersSchema: {
          type: "object",
          properties: { page_size: { type: "integer" } },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listSalesTaxReturns({ pageSize: p.page_size as number | undefined });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "billy_create_invoice",
      {
        displayName: "Create Invoice",
        description: "Create a new draft invoice in Billy.",
        parametersSchema: {
          type: "object",
          required: ["contact_id", "entry_date", "lines"],
          properties: {
            contact_id: { type: "string", description: "Billy contact ID for the customer." },
            entry_date: { type: "string", description: "Invoice date (YYYY-MM-DD)." },
            currency_id: { type: "string", description: "ISO currency code, e.g. DKK. Default: DKK." },
            lines: {
              type: "array",
              description: "Invoice lines.",
              items: {
                type: "object",
                required: ["description", "quantity", "unit_price"],
                properties: {
                  product_id: { type: "string" },
                  description: { type: "string" },
                  quantity: { type: "number" },
                  unit_price: { type: "number" },
                  account_id: { type: "string" },
                  tax_rate_id: { type: "string" },
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
            productId: l.product_id as string | undefined,
            description: l.description as string,
            quantity: l.quantity as number,
            unitPrice: l.unit_price as number,
            accountId: l.account_id as string | undefined,
            taxRateId: l.tax_rate_id as string | undefined,
          }));
          const data = await client.createInvoice({
            contactId: p.contact_id as string,
            entryDate: p.entry_date as string,
            currencyId: p.currency_id as string | undefined,
            lines,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "billy_create_contact",
      {
        displayName: "Create Contact",
        description: "Create a new contact (customer or supplier) in Billy.",
        parametersSchema: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", description: "Contact name." },
            contact_no: { type: "string", description: "Optional custom contact number." },
            type: { type: "string", enum: ["company", "person"], description: "Contact type (default: company)." },
            email: { type: "string" },
            phone: { type: "string" },
            street: { type: "string" },
            city: { type: "string" },
            zipcode: { type: "string" },
            country_id: { type: "string", description: "ISO country code, e.g. DK." },
            currency_id: { type: "string", description: "ISO currency code, e.g. DKK." },
            payment_terms_days: { type: "integer", description: "Net payment days." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.createContact({
            name: p.name as string,
            contactNo: p.contact_no as string | undefined,
            type: p.type as "company" | "person" | undefined,
            email: p.email as string | undefined,
            phone: p.phone as string | undefined,
            street: p.street as string | undefined,
            city: p.city as string | undefined,
            zipcode: p.zipcode as string | undefined,
            countryId: p.country_id as string | undefined,
            currencyId: p.currency_id as string | undefined,
            paymentTermsDays: p.payment_terms_days as number | undefined,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Billy plugin ready — 10 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "Billy plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
