import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { SageClient } from "./sage-client.js";

interface SageConfig {
  clientIdRef?: string;
  clientSecretRef?: string;
  refreshTokenRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as SageConfig;
    const { clientIdRef, clientSecretRef, refreshTokenRef } = config;

    if (!clientIdRef || !clientSecretRef || !refreshTokenRef) {
      ctx.logger.error("sage plugin: clientIdRef, clientSecretRef, and refreshTokenRef are required");
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
      ctx.logger.error(`sage plugin: failed to resolve secrets: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    const client = new SageClient(clientId, clientSecret, refreshToken);

    ctx.logger.info("sage plugin: registering tools");

    ctx.tools.register(
      "sage_list_sales_invoices",
      {
        displayName: "List Sales Invoices",
        description: "List Sage Business Cloud sales invoices.",
        parametersSchema: {
          type: "object",
          properties: {
            page: { type: "number", description: "Page number (1-based, default 1)." },
            per_page: { type: "number", description: "Results per page (default 25)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listSalesInvoices(
            p.page as number | undefined ?? 1,
            p.per_page as number | undefined ?? 25,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "sage_get_sales_invoice",
      {
        displayName: "Get Sales Invoice",
        description: "Get a single Sage sales invoice by ID.",
        parametersSchema: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Sales invoice ID." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          return { content: JSON.stringify(await client.getSalesInvoice(p.id as string), null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "sage_create_sales_invoice",
      {
        displayName: "Create Sales Invoice",
        description: "Create a new Sage sales invoice.",
        parametersSchema: {
          type: "object",
          required: ["contact_id", "invoice_lines"],
          properties: {
            contact_id: { type: "string", description: "Sage contact ID (customer)." },
            date: { type: "string", description: "Invoice date YYYY-MM-DD." },
            due_date: { type: "string", description: "Due date YYYY-MM-DD." },
            reference: { type: "string", description: "Optional reference/PO number." },
            invoice_lines: {
              type: "array",
              description: "Invoice line items.",
              items: {
                type: "object",
                properties: {
                  description: { type: "string", description: "Line item description." },
                  quantity: { type: "number", description: "Quantity." },
                  unit_price: { type: "number", description: "Unit price." },
                  ledger_account_id: { type: "string", description: "Ledger account ID (optional)." },
                },
              },
            },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.createSalesInvoice({
            contact_id: p.contact_id as string,
            date: p.date as string | undefined,
            due_date: p.due_date as string | undefined,
            reference: p.reference as string | undefined,
            invoice_lines: p.invoice_lines as Array<{ description: string; quantity: number; unit_price: number; ledger_account_id?: string }>,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "sage_list_contacts",
      {
        displayName: "List Contacts",
        description: "List Sage contacts (customers and suppliers).",
        parametersSchema: {
          type: "object",
          properties: {
            page: { type: "number", description: "Page number (1-based, default 1)." },
            per_page: { type: "number", description: "Results per page (default 25)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          return { content: JSON.stringify(await client.listContacts(p.page as number | undefined ?? 1, p.per_page as number | undefined ?? 25), null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "sage_get_contact",
      {
        displayName: "Get Contact",
        description: "Get a single Sage contact by ID.",
        parametersSchema: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Contact ID." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          return { content: JSON.stringify(await client.getContact(p.id as string), null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "sage_create_contact",
      {
        displayName: "Create Contact",
        description: "Create a new Sage contact.",
        parametersSchema: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", description: "Contact name." },
            email: { type: "string", description: "Email address." },
            phone: { type: "string", description: "Phone number." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          return { content: JSON.stringify(await client.createContact({ name: p.name as string, email: p.email as string | undefined, phone: p.phone as string | undefined }), null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "sage_list_purchase_invoices",
      {
        displayName: "List Purchase Invoices",
        description: "List Sage purchase invoices (supplier bills).",
        parametersSchema: {
          type: "object",
          properties: {
            page: { type: "number", description: "Page number (1-based, default 1)." },
            per_page: { type: "number", description: "Results per page (default 25)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          return { content: JSON.stringify(await client.listPurchaseInvoices(p.page as number | undefined ?? 1, p.per_page as number | undefined ?? 25), null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "sage_get_purchase_invoice",
      {
        displayName: "Get Purchase Invoice",
        description: "Get a single Sage purchase invoice by ID.",
        parametersSchema: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Purchase invoice ID." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          return { content: JSON.stringify(await client.getPurchaseInvoice(p.id as string), null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "sage_list_ledger_accounts",
      {
        displayName: "List Ledger Accounts",
        description: "List Sage ledger accounts (chart of accounts).",
        parametersSchema: {
          type: "object",
          properties: {
            page: { type: "number", description: "Page number (1-based, default 1)." },
            per_page: { type: "number", description: "Results per page (default 25)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          return { content: JSON.stringify(await client.listLedgerAccounts(p.page as number | undefined ?? 1, p.per_page as number | undefined ?? 25), null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "sage_list_payments",
      {
        displayName: "List Payments",
        description: "List Sage payments.",
        parametersSchema: {
          type: "object",
          properties: {
            page: { type: "number", description: "Page number (1-based, default 1)." },
            per_page: { type: "number", description: "Results per page (default 25)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          return { content: JSON.stringify(await client.listPayments(p.page as number | undefined ?? 1, p.per_page as number | undefined ?? 25), null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "sage_list_bank_accounts",
      {
        displayName: "List Bank Accounts",
        description: "List Sage bank accounts.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          return { content: JSON.stringify(await client.listBankAccounts(), null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "sage_get_trial_balance",
      {
        displayName: "Get Trial Balance",
        description: "Get the Sage trial balance report.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          return { content: JSON.stringify(await client.getTrialBalance(), null, 2) };
        } catch (err) { return errResult(err); }
      },
    );
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
