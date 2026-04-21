import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { XeroClient } from "./xero-client.js";

interface XeroPluginConfig {
  clientIdRef?: string;
  clientSecretRef?: string;
  refreshTokenRef?: string;
  tenantId?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    let cachedClient: XeroClient | null = null;
    let configError: string | null = null;

    async function getClient(): Promise<XeroClient | null> {
      if (cachedClient) return cachedClient;
      if (configError) return null;

const config = await ctx.config.get() as XeroPluginConfig;
      const { clientIdRef, clientSecretRef, refreshTokenRef, tenantId } = config;

      if (!clientIdRef || !clientSecretRef || !refreshTokenRef || !tenantId) {
        configError = "xero plugin: clientIdRef, clientSecretRef, refreshTokenRef, and tenantId are required";
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
        configError = `xero plugin: failed to resolve secrets: ${err instanceof Error ? err.message : String(err)}`;
        ctx.logger.warn("config missing");
        return null;
      }

      cachedClient = new XeroClient(clientId, clientSecret, refreshToken, tenantId);
      return cachedClient;

      ctx.logger.info("xero plugin: registering tools");
    }

    ctx.tools.register(
      "xero_list_invoices",
      {
        displayName: "List Invoices",
        description: "List Xero invoices, optionally filtered by status (DRAFT, AUTHORISED, PAID, VOIDED).",
        parametersSchema: {
          type: "object",
          properties: {
            status: { type: "string", description: "Filter by invoice status: DRAFT, SUBMITTED, AUTHORISED, PAID, VOIDED." },
            page: { type: "number", description: "Page number (100 invoices per page)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.listInvoices({ status: p.status as string, page: p.page as number });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "xero_get_invoice",
      {
        displayName: "Get Invoice",
        description: "Get a single Xero invoice by ID or invoice number.",
        parametersSchema: {
          type: "object",
          required: ["invoice_id"],
          properties: {
            invoice_id: { type: "string", description: "Invoice ID (UUID) or invoice number." },
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
      }
    );

    ctx.tools.register(
      "xero_create_invoice",
      {
        displayName: "Create Invoice",
        description: "Create a new invoice in Xero.",
        parametersSchema: {
          type: "object",
          required: ["contact_id", "line_items"],
          properties: {
            contact_id: { type: "string", description: "Xero contact ID for the customer." },
            type: { type: "string", description: "ACCREC (accounts receivable) or ACCPAY (accounts payable). Default: ACCREC." },
            date: { type: "string", description: "Invoice date in YYYY-MM-DD format (default: today)." },
            due_date: { type: "string", description: "Due date in YYYY-MM-DD format." },
            reference: { type: "string", description: "Your reference number or description." },
            line_items: {
              type: "array",
              description: "Array of line items with description, quantity, unit_amount, and account_code.",
              items: { type: "object", properties: {
                description: { type: "string", description: "Line item description." },
                quantity: { type: "number", description: "Quantity." },
                unit_amount: { type: "number", description: "Unit price." },
                account_code: { type: "string", description: "Xero account code." },
              }},
            },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const lineItems = (p.line_items as Array<Record<string, unknown>>).map(li => ({
            Description: li.description,
            Quantity: li.quantity ?? 1,
            UnitAmount: li.unit_amount,
            AccountCode: li.account_code,
          }));
          const invoice: Record<string, unknown> = {
            Type: (p.type as string) || "ACCREC",
            Contact: { ContactID: p.contact_id },
            LineItems: lineItems,
          };
          if (p.date) invoice.Date = p.date;
          if (p.due_date) invoice.DueDate = p.due_date;
          if (p.reference) invoice.Reference = p.reference;
          const data = await client.createInvoice(invoice);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "xero_list_contacts",
      {
        displayName: "List Contacts",
        description: "List Xero contacts (customers and suppliers).",
        parametersSchema: {
          type: "object",
          properties: {
            search: { type: "string", description: "Search contacts by name." },
            page: { type: "number", description: "Page number (100 per page)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.listContacts({ search: p.search as string, page: p.page as number });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "xero_get_contact",
      {
        displayName: "Get Contact",
        description: "Get a single Xero contact by ID.",
        parametersSchema: {
          type: "object",
          required: ["contact_id"],
          properties: {
            contact_id: { type: "string", description: "Contact ID (UUID)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.getContact(p.contact_id as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "xero_create_contact",
      {
        displayName: "Create Contact",
        description: "Create a new contact in Xero.",
        parametersSchema: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", description: "Contact name." },
            email: { type: "string", description: "Contact email address." },
            phone: { type: "string", description: "Contact phone number." },
            is_customer: { type: "boolean", description: "Mark as customer (default: true)." },
            is_supplier: { type: "boolean", description: "Mark as supplier (default: false)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const contact: Record<string, unknown> = { Name: p.name };
          if (p.email) contact.EmailAddress = p.email;
          if (p.phone) contact.Phones = [{ PhoneType: "DEFAULT", PhoneNumber: p.phone }];
          contact.IsCustomer = p.is_customer !== false;
          contact.IsSupplier = p.is_supplier === true;
          const data = await client.createContact(contact);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "xero_list_accounts",
      {
        displayName: "List Accounts",
        description: "List all chart of accounts entries in Xero.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const data = await client.listAccounts();
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "xero_get_balance_sheet",
      {
        displayName: "Get Balance Sheet",
        description: "Get the Xero balance sheet report for a given date.",
        parametersSchema: {
          type: "object",
          properties: {
            date: { type: "string", description: "Report date in YYYY-MM-DD format (default: today)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.getBalanceSheet(p.date as string | undefined);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "xero_list_payments",
      {
        displayName: "List Payments",
        description: "List invoice payments recorded in Xero.",
        parametersSchema: {
          type: "object",
          properties: {
            status: { type: "string", description: "Filter by status: AUTHORISED, DELETED." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.listPayments({ status: p.status as string | undefined });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "xero_list_credit_notes",
      {
        displayName: "List Credit Notes",
        description: "List credit notes in Xero.",
        parametersSchema: {
          type: "object",
          properties: {
            status: { type: "string", description: "Filter by status: DRAFT, SUBMITTED, AUTHORISED, PAID, VOIDED." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.listCreditNotes({ status: p.status as string | undefined });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
