import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { ZohoCrmClient } from "./zoho-crm-client.js";

interface ZohoCrmPluginConfig {
  accessTokenRef?: string;
  domain?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    let cachedClient: ZohoCrmClient | null = null;
    let configError: string | null = null;

    async function getClient(): Promise<ZohoCrmClient | null> {
      if (cachedClient) return cachedClient;
      if (configError) return null;

const config = await ctx.config.get() as ZohoCrmPluginConfig;

      if (!config.accessTokenRef) {
        configError = "Zoho CRM plugin: accessTokenRef is required";
        ctx.logger.warn("config missing");
        return null;
      }
      if (!config.domain) {
        configError = "Zoho CRM plugin: domain is required";
        ctx.logger.warn("config missing");
        return null;
      }

      let accessToken: string;
      try {
        accessToken = await ctx.secrets.resolve(config.accessTokenRef);
      } catch (err) {
        configError = `Zoho CRM plugin: failed to resolve accessTokenRef: ${err instanceof Error ? err.message : String(err)}`;
        ctx.logger.warn("config missing");
        return null;
      }

      cachedClient = new ZohoCrmClient(accessToken, config.domain);
      return cachedClient;
      ctx.logger.info("Zoho CRM plugin: client initialized, registering tools");
    }

    ctx.tools.register(
      "zoho_crm_list_records",
      {
        displayName: "List Records",
        description: "List records from a Zoho CRM module (Contacts, Leads, Accounts, etc.)",
        parametersSchema: {
          type: "object",
          properties: {
            module: { type: "string", description: "The CRM module name (e.g. Contacts, Leads, Accounts, Deals)." },
            page: { type: "integer", description: "Page number for pagination.", default: 1 },
            per_page: { type: "integer", description: "Number of records per page.", default: 20 },
            sort_by: { type: "string", description: "Field to sort by." },
            sort_order: { type: "string", description: "Sort order: asc or desc.", enum: ["asc", "desc"] },
            fields: { type: "string", description: "Comma-separated list of fields to include." },
          },
          required: ["module"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { module, page, per_page, sort_by, sort_order, fields } = params as {
          module: string; page?: number; per_page?: number; sort_by?: string; sort_order?: string; fields?: string;
        };
        const client = await getClient();
        if (!client) return { error: "Plugin not configured." };
        try {
          const result = await client.listRecords(module, { page, per_page, sort_by, sort_order, fields });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "zoho_crm_get_record",
      {
        displayName: "Get Record",
        description: "Get a single record by ID from a Zoho CRM module.",
        parametersSchema: {
          type: "object",
          properties: {
            module: { type: "string", description: "The CRM module name." },
            id: { type: "string", description: "The record ID." },
          },
          required: ["module", "id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { module, id } = params as { module: string; id: string };
        const client = await getClient();
        if (!client) return { error: "Plugin not configured." };
        try {
          const result = await client.getRecord(module, id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "zoho_crm_create_record",
      {
        displayName: "Create Record",
        description: "Create a new record in a Zoho CRM module.",
        parametersSchema: {
          type: "object",
          properties: {
            module: { type: "string", description: "The CRM module name (e.g. Contacts, Leads, Accounts)." },
            data: { type: "object", description: "Record field values as key-value pairs.", additionalProperties: true },
          },
          required: ["module", "data"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { module, data } = params as { module: string; data: Record<string, unknown> };
        const client = await getClient();
        if (!client) return { error: "Plugin not configured." };
        try {
          const result = await client.createRecord(module, data);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "zoho_crm_update_record",
      {
        displayName: "Update Record",
        description: "Update an existing record in a Zoho CRM module.",
        parametersSchema: {
          type: "object",
          properties: {
            module: { type: "string", description: "The CRM module name." },
            id: { type: "string", description: "The record ID to update." },
            data: { type: "object", description: "Record field values to update.", additionalProperties: true },
          },
          required: ["module", "id", "data"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { module, id, data } = params as { module: string; id: string; data: Record<string, unknown> };
        const client = await getClient();
        if (!client) return { error: "Plugin not configured." };
        try {
          const result = await client.updateRecord(module, id, data);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "zoho_crm_delete_record",
      {
        displayName: "Delete Record",
        description: "Delete a record from a Zoho CRM module.",
        parametersSchema: {
          type: "object",
          properties: {
            module: { type: "string", description: "The CRM module name." },
            id: { type: "string", description: "The record ID to delete." },
          },
          required: ["module", "id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { module, id } = params as { module: string; id: string };
        const client = await getClient();
        if (!client) return { error: "Plugin not configured." };
        try {
          const result = await client.deleteRecord(module, id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "zoho_crm_search_records",
      {
        displayName: "Search Records",
        description: "Search records in a Zoho CRM module by criteria, email, phone, or keyword.",
        parametersSchema: {
          type: "object",
          properties: {
            module: { type: "string", description: "The CRM module name." },
            criteria: { type: "string", description: "Search criteria expression (e.g. (Last_Name:equals:Smith))." },
            email: { type: "string", description: "Email address to search by." },
            phone: { type: "string", description: "Phone number to search by." },
            word: { type: "string", description: "Keyword to search across all fields." },
            page: { type: "integer", description: "Page number for pagination.", default: 1 },
            per_page: { type: "integer", description: "Number of records per page.", default: 20 },
          },
          required: ["module"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { module, criteria, email, phone, word, page, per_page } = params as {
          module: string; criteria?: string; email?: string; phone?: string; word?: string; page?: number; per_page?: number;
        };
        const client = await getClient();
        if (!client) return { error: "Plugin not configured." };
        try {
          const result = await client.searchRecords(module, { criteria, email, phone, word, page, per_page });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "zoho_crm_list_users",
      {
        displayName: "List Users",
        description: "List users in the Zoho CRM organization.",
        parametersSchema: {
          type: "object",
          properties: {
            type: { type: "string", description: "Filter by user type (e.g. AllUsers, ActiveUsers, DeactiveUsers, AdminUsers)." },
            page: { type: "integer", description: "Page number for pagination.", default: 1 },
            per_page: { type: "integer", description: "Number of users per page.", default: 20 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { type, page, per_page } = params as { type?: string; page?: number; per_page?: number };
        const client = await getClient();
        if (!client) return { error: "Plugin not configured." };
        try {
          const result = await client.listUsers({ type, page, per_page });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "zoho_crm_get_organization",
      {
        displayName: "Get Organization",
        description: "Get organization details from Zoho CRM.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        const client = await getClient();
        if (!client) return { error: "Plugin not configured." };
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.getOrganization();
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "zoho_crm_list_deals",
      {
        displayName: "List Deals",
        description: "List deals/opportunities from Zoho CRM.",
        parametersSchema: {
          type: "object",
          properties: {
            page: { type: "integer", description: "Page number for pagination.", default: 1 },
            per_page: { type: "integer", description: "Number of deals per page.", default: 20 },
            sort_by: { type: "string", description: "Field to sort by." },
            sort_order: { type: "string", description: "Sort order: asc or desc.", enum: ["asc", "desc"] },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { page, per_page, sort_by, sort_order } = params as {
          page?: number; per_page?: number; sort_by?: string; sort_order?: string;
        };
        const client = await getClient();
        if (!client) return { error: "Plugin not configured." };
        try {
          const result = await client.listDeals({ page, per_page, sort_by, sort_order });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "zoho_crm_create_note",
      {
        displayName: "Create Note",
        description: "Create a note attached to a Zoho CRM record.",
        parametersSchema: {
          type: "object",
          properties: {
            parentModule: { type: "string", description: "The module of the parent record (e.g. Contacts, Leads, Deals)." },
            parentId: { type: "string", description: "The ID of the parent record." },
            noteTitle: { type: "string", description: "Title of the note." },
            noteContent: { type: "string", description: "Body content of the note." },
          },
          required: ["parentModule", "parentId", "noteTitle", "noteContent"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { parentModule, parentId, noteTitle, noteContent } = params as {
          parentModule: string; parentId: string; noteTitle: string; noteContent: string;
        };
        const client = await getClient();
        if (!client) return { error: "Plugin not configured." };
        try {
          const result = await client.createNote(parentModule, parentId, noteTitle, noteContent);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "zoho_crm_list_activities",
      {
        displayName: "List Activities",
        description: "List activities (calls, meetings, tasks) from Zoho CRM.",
        parametersSchema: {
          type: "object",
          properties: {
            page: { type: "integer", description: "Page number for pagination.", default: 1 },
            per_page: { type: "integer", description: "Number of activities per page.", default: 20 },
            type: { type: "string", description: "Filter by activity type (e.g. calls, meetings, tasks)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { page, per_page, type } = params as { page?: number; per_page?: number; type?: string };
        const client = await getClient();
        if (!client) return { error: "Plugin not configured." };
        try {
          const result = await client.listActivities({ page, per_page, type });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Zoho CRM plugin: all tools registered");
  },
});

runWorker(plugin, import.meta.url);
