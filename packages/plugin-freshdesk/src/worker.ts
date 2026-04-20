import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { FreshdeskClient } from "./freshdesk-client.js";

interface FreshdeskPluginConfig {
  apiKeyRef?: string;
  domain?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as FreshdeskPluginConfig;

    if (!config.apiKeyRef) {
      ctx.logger.error("Freshdesk plugin: apiKeyRef is required");
      return;
    }
    if (!config.domain) {
      ctx.logger.error("Freshdesk plugin: domain is required");
      return;
    }

    let apiKey: string;
    try {
      apiKey = await ctx.secrets.resolve(config.apiKeyRef);
    } catch (err) {
      ctx.logger.error(`Freshdesk plugin: failed to resolve apiKeyRef: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    ctx.logger.info("Freshdesk plugin: secret resolved, registering tools");
    const client = new FreshdeskClient(apiKey, config.domain);

    ctx.tools.register(
      "freshdesk_list_tickets",
      {
        displayName: "List Tickets",
        description: "List Freshdesk support tickets with optional status and priority filters.",
        parametersSchema: {
          type: "object",
          properties: {
            status: { type: "integer", description: "Filter by status: 2=Open, 3=Pending, 4=Resolved, 5=Closed." },
            priority: { type: "integer", description: "Filter by priority: 1=Low, 2=Medium, 3=High, 4=Urgent." },
            limit: { type: "integer", description: "Max results per page (default 30).", default: 30 },
            page: { type: "integer", description: "Page number (default 1).", default: 1 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { status?: number; priority?: number; limit?: number; page?: number };
          const result = await client.listTickets(p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "freshdesk_get_ticket",
      {
        displayName: "Get Ticket",
        description: "Get full details for a Freshdesk ticket including all conversation threads.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "integer", description: "Freshdesk ticket ID." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { id: number };
          const result = await client.getTicket(p.id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "freshdesk_create_ticket",
      {
        displayName: "Create Ticket",
        description: "Create a new Freshdesk support ticket.",
        parametersSchema: {
          type: "object",
          properties: {
            subject: { type: "string", description: "Ticket subject." },
            description: { type: "string", description: "Ticket description (HTML supported)." },
            email: { type: "string", description: "Requester email address." },
            priority: { type: "integer", description: "Priority: 1=Low, 2=Medium, 3=High, 4=Urgent (default 1).", default: 1 },
            status: { type: "integer", description: "Status: 2=Open, 3=Pending, 4=Resolved, 5=Closed (default 2).", default: 2 },
            type: { type: "string", description: "Ticket type (e.g. 'Question', 'Incident', 'Problem', 'Feature Request')." },
            tags: { type: "array", items: { type: "string" }, description: "Tags to apply." },
          },
          required: ["subject", "description", "email"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const result = await client.createTicket(params as {
            subject: string;
            description: string;
            email: string;
            priority?: number;
            status?: number;
            type?: string;
            tags?: string[];
          });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "freshdesk_update_ticket",
      {
        displayName: "Update Ticket",
        description: "Update fields on an existing Freshdesk ticket (status, priority, assignee, tags, etc.).",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "integer", description: "Freshdesk ticket ID." },
            subject: { type: "string", description: "New subject." },
            priority: { type: "integer", description: "New priority: 1=Low, 2=Medium, 3=High, 4=Urgent." },
            status: { type: "integer", description: "New status: 2=Open, 3=Pending, 4=Resolved, 5=Closed." },
            type: { type: "string", description: "New ticket type." },
            tags: { type: "array", items: { type: "string" }, description: "Replace tags." },
            assignee_id: { type: "integer", description: "Agent ID to assign to." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const { id, ...updates } = params as { id: number; subject?: string; priority?: number; status?: number; type?: string; tags?: string[]; assignee_id?: number };
          const result = await client.updateTicket(id, updates);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "freshdesk_list_contacts",
      {
        displayName: "List Contacts",
        description: "List or search Freshdesk contacts by name, email, or phone.",
        parametersSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search term to filter contacts by name, email, or phone." },
            limit: { type: "integer", description: "Max results per page (default 30).", default: 30 },
            page: { type: "integer", description: "Page number (default 1).", default: 1 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { query?: string; limit?: number; page?: number };
          const result = await client.listContacts(p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "freshdesk_get_contact",
      {
        displayName: "Get Contact",
        description: "Get details for a specific Freshdesk contact by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "integer", description: "Freshdesk contact ID." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { id: number };
          const result = await client.getContact(p.id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "freshdesk_create_contact",
      {
        displayName: "Create Contact",
        description: "Create a new contact in Freshdesk.",
        parametersSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Contact full name." },
            email: { type: "string", description: "Contact email address." },
            phone: { type: "string", description: "Contact phone number." },
            company_id: { type: "integer", description: "Freshdesk company ID to associate with." },
            tags: { type: "array", items: { type: "string" }, description: "Tags to apply." },
          },
          required: ["name"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const result = await client.createContact(params as {
            name: string;
            email?: string;
            phone?: string;
            company_id?: number;
            tags?: string[];
          });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "freshdesk_list_agents",
      {
        displayName: "List Agents",
        description: "List all support agents in the Freshdesk account.",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Max results (default 50).", default: 50 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { limit?: number };
          const result = await client.listAgents(p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "freshdesk_add_note",
      {
        displayName: "Add Note",
        description: "Add an internal note to a Freshdesk ticket (private by default).",
        parametersSchema: {
          type: "object",
          properties: {
            ticket_id: { type: "integer", description: "Freshdesk ticket ID." },
            body: { type: "string", description: "Note body (HTML supported)." },
            private: { type: "boolean", description: "Whether the note is private/internal (default true).", default: true },
            agent_id: { type: "integer", description: "Agent ID to attribute the note to." },
          },
          required: ["ticket_id", "body"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { ticket_id: number; body: string; private?: boolean; agent_id?: number };
          const result = await client.addNote(p.ticket_id, { body: p.body, private: p.private, agent_id: p.agent_id });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "freshdesk_reply_to_ticket",
      {
        displayName: "Reply to Ticket",
        description: "Send a public reply to a Freshdesk ticket (visible to the requester).",
        parametersSchema: {
          type: "object",
          properties: {
            ticket_id: { type: "integer", description: "Freshdesk ticket ID." },
            body: { type: "string", description: "Reply body (HTML supported)." },
            from_email: { type: "string", description: "From email address (must be a verified Freshdesk email)." },
            cc_emails: { type: "array", items: { type: "string" }, description: "CC recipients." },
          },
          required: ["ticket_id", "body"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { ticket_id: number; body: string; from_email?: string; cc_emails?: string[] };
          const result = await client.replyToTicket(p.ticket_id, { body: p.body, from_email: p.from_email, cc_emails: p.cc_emails });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );
  },
});

runWorker(plugin, import.meta.url);
