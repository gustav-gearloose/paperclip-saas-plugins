import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { FreshBooksClient } from "./freshbooks-client.js";

interface FBConfig {
  clientIdRef?: string;
  clientSecretRef?: string;
  refreshTokenRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as FBConfig;
    const { clientIdRef, clientSecretRef, refreshTokenRef } = config;

    if (!clientIdRef || !clientSecretRef || !refreshTokenRef) {
      ctx.logger.error("freshbooks plugin: clientIdRef, clientSecretRef, and refreshTokenRef are required");
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
      ctx.logger.error(`freshbooks plugin: failed to resolve secrets: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    const client = new FreshBooksClient(clientId, clientSecret, refreshToken);

    ctx.logger.info("freshbooks plugin: registering tools");

    ctx.tools.register(
      "freshbooks_list_invoices",
      {
        displayName: "List Invoices",
        description: "List FreshBooks invoices.",
        parametersSchema: {
          type: "object",
          properties: {
            page: { type: "number", description: "Page number (1-based, default 1)." },
            per_page: { type: "number", description: "Results per page (max 100, default 25)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listInvoices(
            p.page as number | undefined ?? 1,
            p.per_page as number | undefined ?? 25,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "freshbooks_get_invoice",
      {
        displayName: "Get Invoice",
        description: "Get a single FreshBooks invoice by ID.",
        parametersSchema: {
          type: "object",
          required: ["invoice_id"],
          properties: {
            invoice_id: { type: "string", description: "Invoice ID." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.getInvoice(p.invoice_id as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "freshbooks_create_invoice",
      {
        displayName: "Create Invoice",
        description: "Create a new FreshBooks invoice.",
        parametersSchema: {
          type: "object",
          required: ["client_id", "lines"],
          properties: {
            client_id: { type: "number", description: "FreshBooks client ID." },
            create_date: { type: "string", description: "Invoice date in YYYY-MM-DD format." },
            due_date: { type: "string", description: "Due date in YYYY-MM-DD format." },
            currency_code: { type: "string", description: "Currency code (e.g. USD, DKK). Defaults to account currency." },
            lines: {
              type: "array",
              description: "Invoice line items.",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Line item name/description." },
                  qty: { type: "number", description: "Quantity." },
                  unit_cost: { type: "number", description: "Unit price." },
                },
              },
            },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.createInvoice({
            client_id: p.client_id as number,
            create_date: p.create_date as string | undefined,
            due_date: p.due_date as string | undefined,
            currency_code: p.currency_code as string | undefined,
            lines: p.lines as Array<{ name: string; qty: number; unit_cost: number }>,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "freshbooks_list_clients",
      {
        displayName: "List Clients",
        description: "List FreshBooks clients.",
        parametersSchema: {
          type: "object",
          properties: {
            page: { type: "number", description: "Page number (1-based, default 1)." },
            per_page: { type: "number", description: "Results per page (max 100, default 25)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listClients(
            p.page as number | undefined ?? 1,
            p.per_page as number | undefined ?? 25,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "freshbooks_get_client",
      {
        displayName: "Get Client",
        description: "Get a single FreshBooks client by ID.",
        parametersSchema: {
          type: "object",
          required: ["client_id"],
          properties: {
            client_id: { type: "string", description: "Client ID." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.getClient(p.client_id as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "freshbooks_create_client",
      {
        displayName: "Create Client",
        description: "Create a new FreshBooks client.",
        parametersSchema: {
          type: "object",
          required: ["fname", "lname"],
          properties: {
            fname: { type: "string", description: "First name." },
            lname: { type: "string", description: "Last name." },
            email: { type: "string", description: "Email address." },
            organization: { type: "string", description: "Company/organization name." },
            currency_code: { type: "string", description: "Default currency code (e.g. DKK, USD)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.createClient({
            fname: p.fname as string,
            lname: p.lname as string,
            email: p.email as string | undefined,
            organization: p.organization as string | undefined,
            currency_code: p.currency_code as string | undefined,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "freshbooks_list_expenses",
      {
        displayName: "List Expenses",
        description: "List FreshBooks expenses.",
        parametersSchema: {
          type: "object",
          properties: {
            page: { type: "number", description: "Page number (1-based, default 1)." },
            per_page: { type: "number", description: "Results per page (max 100, default 25)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listExpenses(
            p.page as number | undefined ?? 1,
            p.per_page as number | undefined ?? 25,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "freshbooks_get_expense",
      {
        displayName: "Get Expense",
        description: "Get a single FreshBooks expense by ID.",
        parametersSchema: {
          type: "object",
          required: ["expense_id"],
          properties: {
            expense_id: { type: "string", description: "Expense ID." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.getExpense(p.expense_id as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "freshbooks_list_payments",
      {
        displayName: "List Payments",
        description: "List FreshBooks payments.",
        parametersSchema: {
          type: "object",
          properties: {
            page: { type: "number", description: "Page number (1-based, default 1)." },
            per_page: { type: "number", description: "Results per page (max 100, default 25)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listPayments(
            p.page as number | undefined ?? 1,
            p.per_page as number | undefined ?? 25,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "freshbooks_list_time_entries",
      {
        displayName: "List Time Entries",
        description: "List FreshBooks time entries.",
        parametersSchema: {
          type: "object",
          properties: {
            page: { type: "number", description: "Page number (1-based, default 1)." },
            per_page: { type: "number", description: "Results per page (max 100, default 25)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listTimeEntries(
            p.page as number | undefined ?? 1,
            p.per_page as number | undefined ?? 25,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      },
    );
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
