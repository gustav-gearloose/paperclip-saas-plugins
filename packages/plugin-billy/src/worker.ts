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

    ctx.logger.info("Billy plugin ready — 8 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "Billy plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
