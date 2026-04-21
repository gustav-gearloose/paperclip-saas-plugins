import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { IntercomClient } from "./intercom-client.js";

interface IntercomPluginConfig {
  accessTokenRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    let cachedClient: IntercomClient | null = null;
    let configError: string | null = null;

    async function getClient(): Promise<IntercomClient | null> {
      if (cachedClient) return cachedClient;
      if (configError) return null;

const config = await ctx.config.get() as IntercomPluginConfig;

      if (!config.accessTokenRef) {
        configError = "Intercom plugin: accessTokenRef is required";
        ctx.logger.warn("config missing");
        return null;
      }

      let accessToken: string;
      try {
        accessToken = await ctx.secrets.resolve(config.accessTokenRef);
      } catch (err) {
        configError = `Intercom plugin: failed to resolve accessTokenRef: ${err instanceof Error ? err.message : String(err)}`;
        ctx.logger.warn("config missing");
        return null;
      }

      ctx.logger.info("Intercom plugin: secret resolved, registering tools");
      cachedClient = new IntercomClient(accessToken);
      return cachedClient;
    }

    ctx.tools.register(
      "intercom_search_contacts",
      {
        displayName: "Search Contacts",
        description: "Search Intercom contacts (leads and users) by email, name, or custom attributes.",
        parametersSchema: {
          type: "object",
          properties: {
            email: { type: "string", description: "Filter by exact email address." },
            query: { type: "string", description: "Full-text search query across name and email." },
            limit: { type: "integer", description: "Max results (default 20).", default: 20 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.searchContacts(params as { email?: string; query?: string; limit?: number });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "intercom_get_contact",
      {
        displayName: "Get Contact",
        description: "Get full details for a specific Intercom contact by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            contact_id: { type: "string", description: "Intercom contact ID." },
          },
          required: ["contact_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { contact_id: string };
          const result = await client.getContact(p.contact_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "intercom_create_contact",
      {
        displayName: "Create Contact",
        description: "Create a new contact (lead or user) in Intercom.",
        parametersSchema: {
          type: "object",
          properties: {
            email: { type: "string", description: "Contact email address." },
            name: { type: "string", description: "Contact display name." },
            phone: { type: "string", description: "Phone number." },
            role: { type: "string", enum: ["user", "lead"], description: "Contact role.", default: "lead" },
            custom_attributes: { type: "object", description: "Key/value custom attributes to set on the contact." },
          },
          required: ["email"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.createContact(params as { email: string; name?: string; phone?: string; role?: string; custom_attributes?: Record<string, unknown> });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "intercom_list_conversations",
      {
        displayName: "List Conversations",
        description: "List Intercom conversations, optionally filtered by status or assignee.",
        parametersSchema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["open", "closed", "pending", "snoozed", "all"], description: "Conversation status filter.", default: "open" },
            assignee_id: { type: "string", description: "Filter by assigned admin ID." },
            limit: { type: "integer", description: "Max results (default 20).", default: 20 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.listConversations(params as { status?: string; assignee_id?: string; limit?: number });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "intercom_get_conversation",
      {
        displayName: "Get Conversation",
        description: "Get full details and message thread for a specific Intercom conversation.",
        parametersSchema: {
          type: "object",
          properties: {
            conversation_id: { type: "string", description: "Intercom conversation ID." },
          },
          required: ["conversation_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { conversation_id: string };
          const result = await client.getConversation(p.conversation_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "intercom_reply_to_conversation",
      {
        displayName: "Reply to Conversation",
        description: "Send an admin reply to an Intercom conversation.",
        parametersSchema: {
          type: "object",
          properties: {
            conversation_id: { type: "string", description: "Conversation ID to reply to." },
            message: { type: "string", description: "Reply message body (plain text or HTML)." },
            admin_id: { type: "string", description: "Admin ID sending the reply." },
          },
          required: ["conversation_id", "message", "admin_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.replyToConversation(params as { conversation_id: string; message: string; admin_id: string });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "intercom_close_conversation",
      {
        displayName: "Close Conversation",
        description: "Close an open Intercom conversation.",
        parametersSchema: {
          type: "object",
          properties: {
            conversation_id: { type: "string", description: "Conversation ID to close." },
            admin_id: { type: "string", description: "Admin ID performing the close." },
          },
          required: ["conversation_id", "admin_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.closeConversation(params as { conversation_id: string; admin_id: string });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "intercom_create_note",
      {
        displayName: "Create Note",
        description: "Add an internal note to an Intercom conversation (not visible to customer).",
        parametersSchema: {
          type: "object",
          properties: {
            conversation_id: { type: "string", description: "Conversation ID to add the note to." },
            note: { type: "string", description: "Note text content." },
            admin_id: { type: "string", description: "Admin ID adding the note." },
          },
          required: ["conversation_id", "note", "admin_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.createNote(params as { conversation_id: string; note: string; admin_id: string });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "intercom_list_admins",
      {
        displayName: "List Admins",
        description: "List all admin team members in the Intercom workspace.",
        parametersSchema: {
          type: "object",
          properties: {},
        },
      },
      async (_params): Promise<ToolResult> => {
        try {
          const result = await client.listAdmins();
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "intercom_create_conversation",
      {
        displayName: "Create Conversation",
        description: "Start a new outbound conversation with a contact in Intercom.",
        parametersSchema: {
          type: "object",
          properties: {
            from_admin_id: { type: "string", description: "Admin ID sending the message." },
            to_contact_id: { type: "string", description: "Contact ID to message." },
            message: { type: "string", description: "Opening message body." },
            subject: { type: "string", description: "Conversation subject (for email channel)." },
          },
          required: ["from_admin_id", "to_contact_id", "message"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.createConversation(params as { from_admin_id: string; to_contact_id: string; message: string; subject?: string });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );
  },
});

runWorker(plugin, import.meta.url);
