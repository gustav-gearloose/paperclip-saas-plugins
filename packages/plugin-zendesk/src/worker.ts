import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { ZendeskClient } from "./zendesk-client.js";

interface ZendeskPluginConfig {
  subdomain?: string;
  email?: string;
  apiTokenRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as ZendeskPluginConfig;
    const { subdomain, email, apiTokenRef } = config;

    if (!subdomain || !email || !apiTokenRef) {
      ctx.logger.error("Zendesk plugin: subdomain, email, and apiTokenRef are required");
      return;
    }

    let apiToken: string;
    try {
      apiToken = await ctx.secrets.resolve(apiTokenRef);
    } catch (err) {
      ctx.logger.error(`Zendesk plugin: failed to resolve secret: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    const client = new ZendeskClient(subdomain, email, apiToken);
    ctx.logger.info("Zendesk plugin: registering tools");

    ctx.tools.register(
      "zendesk_list_tickets",
      {
        displayName: "List Tickets",
        description: "List Zendesk support tickets, optionally filtered by status.",
        parametersSchema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["new", "open", "pending", "hold", "solved", "closed"] },
            page_size: { type: "integer" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listTickets({
            status: p.status as string | undefined,
            pageSize: p.page_size as number | undefined,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "zendesk_get_ticket",
      {
        displayName: "Get Ticket",
        description: "Get full details of a specific Zendesk ticket.",
        parametersSchema: {
          type: "object",
          required: ["ticket_id"],
          properties: { ticket_id: { type: "integer" } },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.getTicket(p.ticket_id as number);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "zendesk_get_ticket_comments",
      {
        displayName: "Get Ticket Comments",
        description: "Get all comments/replies on a Zendesk ticket.",
        parametersSchema: {
          type: "object",
          required: ["ticket_id"],
          properties: { ticket_id: { type: "integer" } },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.getTicketComments(p.ticket_id as number);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "zendesk_search_tickets",
      {
        displayName: "Search Tickets",
        description: "Search Zendesk tickets using Zendesk search syntax.",
        parametersSchema: {
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string" },
            page_size: { type: "integer" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.searchTickets(p.query as string, {
            pageSize: p.page_size as number | undefined,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "zendesk_create_ticket",
      {
        displayName: "Create Ticket",
        description: "Create a new Zendesk support ticket.",
        parametersSchema: {
          type: "object",
          required: ["subject", "body"],
          properties: {
            subject: { type: "string" },
            body: { type: "string" },
            requester_name: { type: "string" },
            requester_email: { type: "string" },
            priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
            tags: { type: "array", items: { type: "string" } },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.createTicket({
            subject: p.subject as string,
            body: p.body as string,
            requesterName: p.requester_name as string | undefined,
            requesterEmail: p.requester_email as string | undefined,
            priority: p.priority as string | undefined,
            tags: p.tags as string[] | undefined,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "zendesk_list_users",
      {
        displayName: "List Users",
        description: "List Zendesk users (agents and end-users).",
        parametersSchema: {
          type: "object",
          properties: {
            role: { type: "string", enum: ["end-user", "agent", "admin"] },
            page_size: { type: "integer" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listUsers({
            role: p.role as string | undefined,
            pageSize: p.page_size as number | undefined,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "zendesk_search_users",
      {
        displayName: "Search Users",
        description: "Search for Zendesk users by name or email.",
        parametersSchema: {
          type: "object",
          required: ["query"],
          properties: { query: { type: "string" } },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.searchUsers(p.query as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "zendesk_list_groups",
      {
        displayName: "List Groups",
        description: "List all Zendesk agent groups.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const data = await client.listGroups();
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Zendesk plugin ready — 8 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "Zendesk plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
