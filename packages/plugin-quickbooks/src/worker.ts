import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { QuickBooksClient } from "./quickbooks-client.js";

interface QBOConfig {
  clientIdRef?: string;
  clientSecretRef?: string;
  refreshTokenRef?: string;
  realmId?: string;
  sandbox?: boolean;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    let cachedClient: QuickBooksClient | null = null;
    let configError: string | null = null;

    async function getClient(): Promise<QuickBooksClient | null> {
      if (cachedClient) return cachedClient;
      if (configError) return null;

const config = await ctx.config.get() as QBOConfig;
      const { clientIdRef, clientSecretRef, refreshTokenRef, realmId, sandbox } = config;

      if (!clientIdRef || !clientSecretRef || !refreshTokenRef || !realmId) {
        configError = "quickbooks plugin: clientIdRef, clientSecretRef, refreshTokenRef, and realmId are required";
        ctx.logger.warn("config missing");
        return null;
      }

      let clientId: string, clientSecret: string, refreshToken: string;
      try {
        [clientId, clientSecret, refreshToken] = await Promise.all([
          ctx.secrets.resolve(clientIdRef),
          ctx.secrets.resolve(clientSecretRef),
          ctx.secrets.resolve(refreshTokenRef),
        ]);
      } catch (err) {
        configError = `quickbooks plugin: failed to resolve secrets: ${err instanceof Error ? err.message : String(err)}`;
        ctx.logger.warn("config missing");
        return null;
      }

      cachedClient = new QuickBooksClient(clientId, clientSecret, refreshToken, realmId, sandbox ?? false);
      return cachedClient;

      ctx.logger.info("quickbooks plugin: registering tools");
    }

    ctx.tools.register(
      "quickbooks_list_invoices",
      {
        displayName: "List Invoices",
        description: "List QuickBooks Online invoices.",
        parametersSchema: {
          type: "object",
          properties: {
            start_position: { type: "number", description: "1-based start position for pagination." },
            max_results: { type: "number", description: "Max results per page (default 100, max 1000)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.listInvoices(
            p.start_position as number | undefined ?? 1,
            p.max_results as number | undefined ?? 100,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "quickbooks_get_invoice",
      {
        displayName: "Get Invoice",
        description: "Get a single QuickBooks invoice by ID.",
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
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.getInvoice(p.invoice_id as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "quickbooks_create_invoice",
      {
        displayName: "Create Invoice",
        description: "Create a new QuickBooks Online invoice.",
        parametersSchema: {
          type: "object",
          required: ["customer_id", "lines"],
          properties: {
            customer_id: { type: "string", description: "Customer ID (CustomerRef.value)." },
            due_date: { type: "string", description: "Due date in YYYY-MM-DD format." },
            lines: {
              type: "array",
              description: "Invoice line items.",
              items: {
                type: "object",
                properties: {
                  description: { type: "string", description: "Line item description." },
                  amount: { type: "number", description: "Line total amount." },
                  item_id: { type: "string", description: "Item/product ID (ItemRef.value)." },
                  quantity: { type: "number", description: "Quantity." },
                  unit_price: { type: "number", description: "Unit price." },
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
          const data = await client.createInvoice({
            customer_id: p.customer_id as string,
            due_date: p.due_date as string | undefined,
            lines: p.lines as Array<{
              description?: string;
              amount: number;
              item_id?: string;
              quantity?: number;
              unit_price?: number;
            }>,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "quickbooks_list_customers",
      {
        displayName: "List Customers",
        description: "List QuickBooks Online customers.",
        parametersSchema: {
          type: "object",
          properties: {
            start_position: { type: "number", description: "1-based start position for pagination." },
            max_results: { type: "number", description: "Max results per page (default 100, max 1000)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.listCustomers(
            p.start_position as number | undefined ?? 1,
            p.max_results as number | undefined ?? 100,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "quickbooks_get_customer",
      {
        displayName: "Get Customer",
        description: "Get a single QuickBooks customer by ID.",
        parametersSchema: {
          type: "object",
          required: ["customer_id"],
          properties: {
            customer_id: { type: "string", description: "Customer ID." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.getCustomer(p.customer_id as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "quickbooks_create_customer",
      {
        displayName: "Create Customer",
        description: "Create a new customer in QuickBooks Online.",
        parametersSchema: {
          type: "object",
          required: ["display_name"],
          properties: {
            display_name: { type: "string", description: "Customer display name (must be unique)." },
            email: { type: "string", description: "Primary email address." },
            phone: { type: "string", description: "Primary phone number." },
            company_name: { type: "string", description: "Company name." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.createCustomer({
            display_name: p.display_name as string,
            email: p.email as string | undefined,
            phone: p.phone as string | undefined,
            company_name: p.company_name as string | undefined,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "quickbooks_list_accounts",
      {
        displayName: "List Accounts",
        description: "List QuickBooks chart of accounts.",
        parametersSchema: {
          type: "object",
          properties: {
            start_position: { type: "number", description: "1-based start position for pagination." },
            max_results: { type: "number", description: "Max results per page (default 100, max 1000)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.listAccounts(
            p.start_position as number | undefined ?? 1,
            p.max_results as number | undefined ?? 100,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "quickbooks_get_profit_and_loss",
      {
        displayName: "Get Profit & Loss Report",
        description: "Get the QuickBooks Profit & Loss report for a date range.",
        parametersSchema: {
          type: "object",
          required: ["start_date", "end_date"],
          properties: {
            start_date: { type: "string", description: "Start date in YYYY-MM-DD format." },
            end_date: { type: "string", description: "End date in YYYY-MM-DD format." },
            accounting_method: { type: "string", description: "Accrual or Cash (default: Accrual)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.getProfitAndLoss(
            p.start_date as string,
            p.end_date as string,
            p.accounting_method as string | undefined ?? "Accrual",
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "quickbooks_list_vendors",
      {
        displayName: "List Vendors",
        description: "List QuickBooks Online vendors.",
        parametersSchema: {
          type: "object",
          properties: {
            start_position: { type: "number", description: "1-based start position for pagination." },
            max_results: { type: "number", description: "Max results per page (default 100, max 1000)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.listVendors(
            p.start_position as number | undefined ?? 1,
            p.max_results as number | undefined ?? 100,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "quickbooks_list_bills",
      {
        displayName: "List Bills",
        description: "List QuickBooks Online bills (accounts payable).",
        parametersSchema: {
          type: "object",
          properties: {
            start_position: { type: "number", description: "1-based start position for pagination." },
            max_results: { type: "number", description: "Max results per page (default 100, max 1000)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.listBills(
            p.start_position as number | undefined ?? 1,
            p.max_results as number | undefined ?? 100,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      },
    );
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
