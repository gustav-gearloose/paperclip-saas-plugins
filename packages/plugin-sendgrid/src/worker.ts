import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { SendGridClient } from "./sendgrid-client.js";

interface SendGridPluginConfig {
  apiKeyRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as SendGridPluginConfig;

    if (!config.apiKeyRef) {
      ctx.logger.error("SendGrid plugin: apiKeyRef is required");
      return;
    }

    let apiKey: string;
    try {
      apiKey = await ctx.secrets.resolve(config.apiKeyRef);
    } catch (err) {
      ctx.logger.error(`SendGrid plugin: failed to resolve apiKeyRef: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    const client = new SendGridClient(apiKey);
    ctx.logger.info("SendGrid plugin: client initialized, registering tools");

    ctx.tools.register(
      "sendgrid_send_email",
      {
        displayName: "Send Email",
        description: "Send a transactional email via SendGrid.",
        parametersSchema: {
          type: "object",
          properties: {
            to: {
              type: "array",
              description: "List of recipients.",
              items: {
                type: "object",
                properties: {
                  email: { type: "string", description: "Recipient email." },
                  name: { type: "string", description: "Recipient name." },
                },
                required: ["email"],
              },
            },
            from_email: { type: "string", description: "Sender email address." },
            from_name: { type: "string", description: "Sender display name." },
            subject: { type: "string", description: "Email subject line." },
            text: { type: "string", description: "Plain text body." },
            html: { type: "string", description: "HTML body." },
            templateId: { type: "string", description: "SendGrid dynamic template ID." },
            dynamicTemplateData: { type: "object", description: "Template variables.", additionalProperties: true },
            replyTo_email: { type: "string", description: "Reply-to email address." },
            replyTo_name: { type: "string", description: "Reply-to display name." },
          },
          required: ["to", "from_email", "subject"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { to, from_email, from_name, subject, text, html, templateId, dynamicTemplateData, replyTo_email, replyTo_name } = params as {
          to: Array<{ email: string; name?: string }>;
          from_email: string; from_name?: string; subject: string;
          text?: string; html?: string; templateId?: string;
          dynamicTemplateData?: Record<string, unknown>;
          replyTo_email?: string; replyTo_name?: string;
        };
        try {
          const result = await client.sendEmail({
            to,
            from: { email: from_email, name: from_name },
            subject,
            text,
            html,
            templateId,
            dynamicTemplateData,
            replyTo: replyTo_email ? { email: replyTo_email, name: replyTo_name } : undefined,
          });
          return { content: JSON.stringify(result ?? { sent: true }, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "sendgrid_list_contacts",
      {
        displayName: "List Contacts",
        description: "List marketing contacts in SendGrid.",
        parametersSchema: {
          type: "object",
          properties: {
            page_size: { type: "integer", description: "Results per page (max 1000).", default: 50 },
            page_token: { type: "string", description: "Pagination token from previous response." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { page_size, page_token } = params as { page_size?: number; page_token?: string };
        try {
          const result = await client.listContacts({ page_size, page_token });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "sendgrid_search_contacts",
      {
        displayName: "Search Contacts",
        description: "Search marketing contacts using a SGQL query string.",
        parametersSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "SGQL query, e.g. 'email LIKE \\'%@example.com\\''." },
          },
          required: ["query"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { query } = params as { query: string };
        try {
          const result = await client.searchContacts(query);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "sendgrid_upsert_contacts",
      {
        displayName: "Upsert Contacts",
        description: "Add or update marketing contacts in SendGrid (async — returns job ID).",
        parametersSchema: {
          type: "object",
          properties: {
            contacts: {
              type: "array",
              description: "Contacts to upsert.",
              items: {
                type: "object",
                properties: {
                  email: { type: "string", description: "Contact email." },
                  first_name: { type: "string", description: "First name." },
                  last_name: { type: "string", description: "Last name." },
                  custom_fields: { type: "object", description: "Custom field values.", additionalProperties: true },
                },
                required: ["email"],
              },
            },
          },
          required: ["contacts"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { contacts } = params as {
          contacts: Array<{ email: string; first_name?: string; last_name?: string; custom_fields?: Record<string, unknown> }>;
        };
        try {
          const result = await client.upsertContacts(contacts);
          return { content: JSON.stringify(result ?? { queued: true }, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "sendgrid_delete_contacts",
      {
        displayName: "Delete Contacts",
        description: "Delete marketing contacts by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            ids: {
              type: "array",
              items: { type: "string" },
              description: "Contact IDs to delete.",
            },
          },
          required: ["ids"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { ids } = params as { ids: string[] };
        try {
          const result = await client.deleteContacts(ids);
          return { content: JSON.stringify(result ?? { deleted: true }, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "sendgrid_list_lists",
      {
        displayName: "List Contact Lists",
        description: "List all marketing contact lists in SendGrid.",
        parametersSchema: {
          type: "object",
          properties: {
            page_size: { type: "integer", description: "Results per page.", default: 100 },
            page_token: { type: "string", description: "Pagination token." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { page_size, page_token } = params as { page_size?: number; page_token?: string };
        try {
          const result = await client.listLists({ page_size, page_token });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "sendgrid_get_list",
      {
        displayName: "Get Contact List",
        description: "Get details of a specific contact list.",
        parametersSchema: {
          type: "object",
          properties: {
            list_id: { type: "string", description: "The contact list ID." },
          },
          required: ["list_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { list_id } = params as { list_id: string };
        try {
          const result = await client.getList(list_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "sendgrid_create_list",
      {
        displayName: "Create Contact List",
        description: "Create a new marketing contact list.",
        parametersSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the new list." },
          },
          required: ["name"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { name } = params as { name: string };
        try {
          const result = await client.createList(name);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "sendgrid_add_contacts_to_list",
      {
        displayName: "Add Contacts to List",
        description: "Add existing contacts (by ID) to a contact list.",
        parametersSchema: {
          type: "object",
          properties: {
            list_id: { type: "string", description: "The contact list ID." },
            contact_ids: {
              type: "array",
              items: { type: "string" },
              description: "Contact IDs to add.",
            },
          },
          required: ["list_id", "contact_ids"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { list_id, contact_ids } = params as { list_id: string; contact_ids: string[] };
        try {
          const result = await client.addContactsToList(list_id, contact_ids);
          return { content: JSON.stringify(result ?? { queued: true }, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "sendgrid_list_templates",
      {
        displayName: "List Email Templates",
        description: "List dynamic email templates in SendGrid.",
        parametersSchema: {
          type: "object",
          properties: {
            page_size: { type: "integer", description: "Results per page.", default: 20 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { page_size } = params as { page_size?: number };
        try {
          const result = await client.listTemplates({ page_size });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "sendgrid_get_template",
      {
        displayName: "Get Email Template",
        description: "Get details of a specific email template including its versions.",
        parametersSchema: {
          type: "object",
          properties: {
            template_id: { type: "string", description: "The template ID." },
          },
          required: ["template_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { template_id } = params as { template_id: string };
        try {
          const result = await client.getTemplate(template_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "sendgrid_get_stats",
      {
        displayName: "Get Email Stats",
        description: "Get aggregate email delivery statistics (opens, clicks, bounces, spam reports).",
        parametersSchema: {
          type: "object",
          properties: {
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)." },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)." },
            aggregated_by: { type: "string", description: "Group by: day, week, or month.", default: "day" },
          },
          required: ["start_date"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { start_date, end_date, aggregated_by } = params as {
          start_date: string; end_date?: string; aggregated_by?: string;
        };
        try {
          const result = await client.getStats({ start_date, end_date, aggregated_by });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "sendgrid_list_unsubscribes",
      {
        displayName: "List Global Unsubscribes",
        description: "List globally unsubscribed email addresses.",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Number of results.", default: 50 },
            offset: { type: "integer", description: "Pagination offset.", default: 0 },
            start_time: { type: "integer", description: "Unix timestamp to filter from." },
            end_time: { type: "integer", description: "Unix timestamp to filter to." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { limit, offset, start_time, end_time } = params as {
          limit?: number; offset?: number; start_time?: number; end_time?: number;
        };
        try {
          const result = await client.listSuppressions({ limit, offset, start_time, end_time });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "sendgrid_add_global_unsubscribe",
      {
        displayName: "Add Global Unsubscribe",
        description: "Add one or more email addresses to the global unsubscribe list.",
        parametersSchema: {
          type: "object",
          properties: {
            emails: {
              type: "array",
              items: { type: "string" },
              description: "Email addresses to globally unsubscribe.",
            },
          },
          required: ["emails"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { emails } = params as { emails: string[] };
        try {
          const result = await client.addToGlobalUnsubscribes(emails);
          return { content: JSON.stringify(result ?? { added: true }, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("SendGrid plugin: all tools registered");
  },
});

runWorker(plugin, import.meta.url);
