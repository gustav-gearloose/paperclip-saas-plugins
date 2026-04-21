import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { GraphClient } from "./graph-client.js";

interface OutlookPluginConfig {
  tenantId?: string;
  userPrincipalName?: string;
  clientIdRef?: string;
  clientSecretRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    let cachedClient: GraphClient | null = null;
    let configError: string | null = null;

    async function getClient(): Promise<GraphClient | null> {
      if (cachedClient) return cachedClient;
      if (configError) return null;

const config = await ctx.config.get() as OutlookPluginConfig;
      const { tenantId, userPrincipalName, clientIdRef, clientSecretRef } = config;

      if (!tenantId || !userPrincipalName || !clientIdRef || !clientSecretRef) {
        configError = "Outlook plugin: tenantId, userPrincipalName, clientIdRef, clientSecretRef are all required";
        ctx.logger.warn("config missing");
        return null;
      }

      let clientId: string, clientSecret: string;
      try {
        [clientId, clientSecret] = await Promise.all([
          ctx.secrets.resolve(clientIdRef),
          ctx.secrets.resolve(clientSecretRef),
        ]);
      } catch (err) {
        configError = `Outlook plugin: failed to resolve secrets: ${err instanceof Error ? err.message : String(err)}`;
        ctx.logger.warn("config missing");
        return null;
      }

      cachedClient = new GraphClient({ tenantId, clientId, clientSecret, defaultUser: userPrincipalName });
      return cachedClient;
      ctx.logger.info(`Outlook plugin: initialized for ${userPrincipalName}, registering tools`);
    }

    ctx.tools.register(
      "outlook_list_messages",
      {
        displayName: "List Messages",
        description: "List recent email messages from an Outlook mailbox folder.",
        parametersSchema: {
          type: "object",
          properties: {
            folder: { type: "string", description: "Folder name or ID (default: inbox)." },
            search: { type: "string", description: "Search query (e.g. 'subject:invoice')." },
            from_date: { type: "string", description: "Filter messages received after this date (ISO 8601)." },
            limit: { type: "integer", description: "Max messages to return (default 20)." },
            user: { type: "string", description: "Override configured userPrincipalName." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const messages = await client.listMessages(params as Parameters<typeof client.listMessages>[0]);
          return { content: JSON.stringify(messages, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "outlook_get_message",
      {
        displayName: "Get Message",
        description: "Get full details and body of a specific email message by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            message_id: { type: "string", description: "Message ID from list_messages." },
            user: { type: "string", description: "Override configured userPrincipalName." },
          },
          required: ["message_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { message_id: string; user?: string };
          const msg = await client.getMessage(p.message_id, p.user);
          return { content: JSON.stringify(msg, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "outlook_send_message",
      {
        displayName: "Send Message",
        description: "Send an email from the configured Outlook mailbox.",
        parametersSchema: {
          type: "object",
          properties: {
            to: { type: "array", items: { type: "string" }, description: "Recipient email addresses." },
            subject: { type: "string", description: "Email subject." },
            body: { type: "string", description: "Email body (plain text or HTML)." },
            body_type: { type: "string", enum: ["Text", "HTML"], description: "Body content type (default: Text)." },
            cc: { type: "array", items: { type: "string" }, description: "CC recipients." },
            user: { type: "string", description: "Override configured userPrincipalName." },
          },
          required: ["to", "subject", "body"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.sendMessage(params as Parameters<typeof client.sendMessage>[0]);
          return { content: JSON.stringify(result) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "outlook_reply_message",
      {
        displayName: "Reply to Message",
        description: "Reply to an existing email message.",
        parametersSchema: {
          type: "object",
          properties: {
            message_id: { type: "string", description: "Message ID to reply to." },
            body: { type: "string", description: "Reply body text." },
            user: { type: "string", description: "Override configured userPrincipalName." },
          },
          required: ["message_id", "body"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { message_id: string; body: string; user?: string };
          const result = await client.replyMessage(p.message_id, p.body, p.user);
          return { content: JSON.stringify(result) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "outlook_list_folders",
      {
        displayName: "List Mail Folders",
        description: "List mail folders in the Outlook mailbox.",
        parametersSchema: {
          type: "object",
          properties: {
            user: { type: "string", description: "Override configured userPrincipalName." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { user?: string };
          const folders = await client.listFolders(p.user);
          return { content: JSON.stringify(folders, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "outlook_list_events",
      {
        displayName: "List Calendar Events",
        description: "List upcoming calendar events from the Outlook calendar.",
        parametersSchema: {
          type: "object",
          properties: {
            start: { type: "string", description: "Start of time range (ISO 8601, default: now)." },
            end: { type: "string", description: "End of time range (ISO 8601, default: 7 days from now)." },
            limit: { type: "integer", description: "Max events to return (default 20)." },
            user: { type: "string", description: "Override configured userPrincipalName." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const events = await client.listEvents(params as Parameters<typeof client.listEvents>[0]);
          return { content: JSON.stringify(events, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "outlook_get_event",
      {
        displayName: "Get Calendar Event",
        description: "Get full details of a specific calendar event by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            event_id: { type: "string", description: "Event ID from list_events." },
            user: { type: "string", description: "Override configured userPrincipalName." },
          },
          required: ["event_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { event_id: string; user?: string };
          const event = await client.getEvent(p.event_id, p.user);
          return { content: JSON.stringify(event, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "outlook_create_event",
      {
        displayName: "Create Calendar Event",
        description: "Create a new calendar event in the Outlook calendar.",
        parametersSchema: {
          type: "object",
          properties: {
            subject: { type: "string", description: "Event title." },
            start: { type: "string", description: "Start datetime (ISO 8601)." },
            end: { type: "string", description: "End datetime (ISO 8601)." },
            timezone: { type: "string", description: "Timezone (e.g. Europe/Copenhagen). Default: UTC." },
            body: { type: "string", description: "Event description." },
            attendees: { type: "array", items: { type: "string" }, description: "Attendee email addresses." },
            location: { type: "string", description: "Event location." },
            user: { type: "string", description: "Override configured userPrincipalName." },
          },
          required: ["subject", "start", "end"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const event = await client.createEvent(params as Parameters<typeof client.createEvent>[0]);
          return { content: JSON.stringify(event, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "outlook_update_event",
      {
        displayName: "Update Calendar Event",
        description: "Update an existing calendar event (subject, time, attendees, etc.).",
        parametersSchema: {
          type: "object",
          properties: {
            event_id: { type: "string", description: "Event ID to update." },
            subject: { type: "string", description: "New event title." },
            start: { type: "string", description: "New start datetime (ISO 8601)." },
            end: { type: "string", description: "New end datetime (ISO 8601)." },
            timezone: { type: "string", description: "Timezone (e.g. Europe/Copenhagen)." },
            body: { type: "string", description: "New event description." },
            location: { type: "string", description: "New event location." },
            user: { type: "string", description: "Override configured userPrincipalName." },
          },
          required: ["event_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const event = await client.updateEvent(params as Parameters<typeof client.updateEvent>[0]);
          return { content: JSON.stringify(event, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "outlook_delete_event",
      {
        displayName: "Delete Calendar Event",
        description: "Delete a calendar event by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            event_id: { type: "string", description: "Event ID to delete." },
            user: { type: "string", description: "Override configured userPrincipalName." },
          },
          required: ["event_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { event_id: string; user?: string };
          const result = await client.deleteEvent(p.event_id, p.user);
          return { content: JSON.stringify(result) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Outlook plugin ready — 10 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "Outlook plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
