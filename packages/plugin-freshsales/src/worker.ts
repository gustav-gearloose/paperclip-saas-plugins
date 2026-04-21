import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { FreshsalesClient } from "./freshsales-client.js";

interface FreshsalesPluginConfig {
  apiKeyRef?: string;
  domain?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    let cachedClient: FreshsalesClient | null = null;
    let configError: string | null = null;

    async function getClient(): Promise<FreshsalesClient | null> {
      if (cachedClient) return cachedClient;
      if (configError) return null;

const config = await ctx.config.get() as FreshsalesPluginConfig;
      const { apiKeyRef, domain } = config;

      if (!apiKeyRef || !domain) {
        configError = "Freshsales plugin: apiKeyRef and domain are required";
        ctx.logger.warn("config missing");
        return null;
      }

      let apiKey: string;
      try {
        apiKey = await ctx.secrets.resolve(apiKeyRef);
      } catch (err) {
        configError = `Freshsales plugin: failed to resolve secret: ${err instanceof Error ? err.message : String(err)}`;
        ctx.logger.warn("config missing");
        return null;
      }

      cachedClient = new FreshsalesClient(apiKey, domain);
      return cachedClient;
      ctx.logger.info(`Freshsales plugin: initialized for ${domain}.myfreshworks.com, registering tools`);
    }

    ctx.tools.register(
      "freshsales_list_contacts",
      {
        displayName: "List Contacts",
        description: "List contacts in Freshsales CRM.",
        parametersSchema: {
          type: "object",
          properties: {
            page: { type: "integer", description: "Page number (default 1)." },
            limit: { type: "integer", description: "Results per page (default 25)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.listContacts(params as Parameters<typeof client.listContacts>[0]);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "freshsales_get_contact",
      {
        displayName: "Get Contact",
        description: "Get a contact by ID, including linked accounts, deals, and notes.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "integer", description: "Freshsales contact ID." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { id: number };
          const result = await client.getContact(p.id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "freshsales_create_contact",
      {
        displayName: "Create Contact",
        description: "Create a new contact in Freshsales.",
        parametersSchema: {
          type: "object",
          properties: {
            first_name: { type: "string", description: "First name." },
            last_name: { type: "string", description: "Last name." },
            email: { type: "string", description: "Email address." },
            mobile_number: { type: "string", description: "Mobile phone number." },
            work_number: { type: "string", description: "Work phone number." },
            job_title: { type: "string", description: "Job title." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.createContact(params as Parameters<typeof client.createContact>[0]);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "freshsales_update_contact",
      {
        displayName: "Update Contact",
        description: "Update fields on an existing Freshsales contact.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "integer", description: "Freshsales contact ID to update." },
            first_name: { type: "string", description: "First name." },
            last_name: { type: "string", description: "Last name." },
            email: { type: "string", description: "Email address." },
            mobile_number: { type: "string", description: "Mobile phone number." },
            job_title: { type: "string", description: "Job title." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { id: number } & Record<string, unknown>;
          const { id, ...rest } = p;
          const result = await client.updateContact(id, rest);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "freshsales_list_accounts",
      {
        displayName: "List Accounts",
        description: "List company accounts in Freshsales CRM.",
        parametersSchema: {
          type: "object",
          properties: {
            page: { type: "integer", description: "Page number (default 1)." },
            limit: { type: "integer", description: "Results per page (default 25)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.listAccounts(params as Parameters<typeof client.listAccounts>[0]);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "freshsales_get_account",
      {
        displayName: "Get Account",
        description: "Get an account by ID, including linked contacts and deals.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "integer", description: "Freshsales account ID." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { id: number };
          const result = await client.getAccount(p.id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "freshsales_list_deals",
      {
        displayName: "List Deals",
        description: "List deals/opportunities in Freshsales CRM.",
        parametersSchema: {
          type: "object",
          properties: {
            page: { type: "integer", description: "Page number (default 1)." },
            limit: { type: "integer", description: "Results per page (default 25)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.listDeals(params as Parameters<typeof client.listDeals>[0]);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "freshsales_get_deal",
      {
        displayName: "Get Deal",
        description: "Get a deal by ID, including linked contacts, account, and notes.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "integer", description: "Freshsales deal ID." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { id: number };
          const result = await client.getDeal(p.id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "freshsales_create_deal",
      {
        displayName: "Create Deal",
        description: "Create a new deal/opportunity in Freshsales.",
        parametersSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Deal name." },
            amount: { type: "number", description: "Deal value/amount." },
            close_date: { type: "string", description: "Expected close date (YYYY-MM-DD)." },
            sales_account_id: { type: "integer", description: "Linked account ID." },
          },
          required: ["name"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.createDeal(params as Parameters<typeof client.createDeal>[0]);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "freshsales_add_note",
      {
        displayName: "Add Note",
        description: "Add a note to a contact, account, or deal in Freshsales.",
        parametersSchema: {
          type: "object",
          properties: {
            description: { type: "string", description: "Note text content." },
            targetable_type: { type: "string", enum: ["Contact", "SalesAccount", "Deal"], description: "Type of entity to attach the note to." },
            targetable_id: { type: "integer", description: "ID of the contact, account, or deal." },
          },
          required: ["description", "targetable_type", "targetable_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.createNote(params as Parameters<typeof client.createNote>[0]);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "freshsales_list_tasks",
      {
        displayName: "List Tasks",
        description: "List tasks in Freshsales, optionally filtered by status.",
        parametersSchema: {
          type: "object",
          properties: {
            filter: { type: "string", enum: ["open", "due_today", "overdue", "completed"], description: "Filter tasks by status." },
            page: { type: "integer", description: "Page number (default 1)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.listTasks(params as Parameters<typeof client.listTasks>[0]);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "freshsales_search",
      {
        displayName: "Search",
        description: "Search across contacts, accounts, and deals in Freshsales.",
        parametersSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query string." },
            include: { type: "string", description: "Comma-separated entity types to search (default: contact,sales_account,deal)." },
          },
          required: ["query"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.search(params as Parameters<typeof client.search>[0]);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Freshsales plugin ready — 12 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "Freshsales plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
