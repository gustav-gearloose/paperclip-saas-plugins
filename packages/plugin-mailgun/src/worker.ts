import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { MailgunClient } from "./mailgun-client.js";

interface MailgunPluginConfig {
  apiKeyRef?: string;
  domain?: string;
  region?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as MailgunPluginConfig;

    if (!config.apiKeyRef) {
      ctx.logger.error("Mailgun plugin: apiKeyRef is required");
      return;
    }
    if (!config.domain) {
      ctx.logger.error("Mailgun plugin: domain is required");
      return;
    }

    let apiKey: string;
    try {
      apiKey = await ctx.secrets.resolve(config.apiKeyRef);
    } catch (err) {
      ctx.logger.error(`Mailgun plugin: failed to resolve apiKeyRef: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    const client = new MailgunClient(apiKey, config.domain, config.region ?? "us");
    ctx.logger.info("Mailgun plugin: client initialized, registering tools");

    ctx.tools.register(
      "mailgun_send_message",
      {
        displayName: "Send Message",
        description: "Send an email via Mailgun",
        parametersSchema: {
          type: "object",
          properties: {
            from: { type: "string", description: "Sender email address (e.g. Mailgun Sandbox <mailgun@mg.example.com>)." },
            to: { type: "string", description: "Recipient email address." },
            subject: { type: "string", description: "Email subject line." },
            text: { type: "string", description: "Plain text body of the email." },
            html: { type: "string", description: "HTML body of the email." },
            cc: { type: "string", description: "CC email address." },
            bcc: { type: "string", description: "BCC email address." },
            reply_to: { type: "string", description: "Reply-To email address." },
            tag: { type: "string", description: "Tag to apply to the message (single tag)." },
            tracking: { type: "boolean", description: "Enable or disable open/click tracking." },
            template: { type: "string", description: "Name of a Mailgun template to use." },
            variables: { type: "string", description: "JSON string of template variables (h:X-Mailgun-Variables)." },
          },
          required: ["from", "to", "subject"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { from, to, subject, text, html, cc, bcc, reply_to, tag, tracking, template, variables } = params as {
          from: string; to: string; subject: string;
          text?: string; html?: string; cc?: string; bcc?: string;
          reply_to?: string; tag?: string; tracking?: boolean;
          template?: string; variables?: string;
        };
        try {
          const result = await client.sendMessage({
            from,
            to: [to],
            subject,
            ...(text && { text }),
            ...(html && { html }),
            ...(cc && { cc: [cc] }),
            ...(bcc && { bcc: [bcc] }),
            ...(reply_to && { "h:Reply-To": reply_to }),
            ...(tag && { "o:tag": [tag] }),
            ...(tracking !== undefined && { "o:tracking": tracking }),
            ...(template && { template }),
            ...(variables && { "h:X-Mailgun-Variables": variables }),
          });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "mailgun_get_events",
      {
        displayName: "Get Events",
        description: "Get Mailgun email events log",
        parametersSchema: {
          type: "object",
          properties: {
            event: { type: "string", description: "Filter by event type (e.g. accepted, delivered, failed, opened, clicked, unsubscribed, complained, stored)." },
            limit: { type: "integer", description: "Number of results to return.", default: 25 },
            begin: { type: "string", description: "Start of the time range (RFC 2822 date or Unix timestamp)." },
            end: { type: "string", description: "End of the time range (RFC 2822 date or Unix timestamp)." },
            ascending: { type: "string", description: "Set to 'yes' to return events in ascending order.", enum: ["yes", "no"] },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { event, limit, begin, end, ascending } = params as {
          event?: string; limit?: number; begin?: string; end?: string; ascending?: string;
        };
        try {
          const result = await client.getEvents({ event, limit, begin, end, ascending });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "mailgun_list_suppressions",
      {
        displayName: "List Suppressions",
        description: "List bounces, unsubscribes, or complaints",
        parametersSchema: {
          type: "object",
          properties: {
            type: { type: "string", description: "Suppression list type.", enum: ["bounces", "unsubscribes", "complaints"] },
            limit: { type: "integer", description: "Number of results to return.", default: 100 },
            p: { type: "string", description: "Page token for pagination." },
          },
          required: ["type"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { type, limit, p } = params as {
          type: "bounces" | "unsubscribes" | "complaints"; limit?: number; p?: string;
        };
        try {
          const result = await client.listSuppressions(type, { limit, p });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "mailgun_delete_suppression",
      {
        displayName: "Delete Suppression",
        description: "Remove an address from the bounce/unsubscribe/complaint list",
        parametersSchema: {
          type: "object",
          properties: {
            type: { type: "string", description: "Suppression list type.", enum: ["bounces", "unsubscribes", "complaints"] },
            address: { type: "string", description: "Email address to remove from the suppression list." },
          },
          required: ["type", "address"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { type, address } = params as {
          type: "bounces" | "unsubscribes" | "complaints"; address: string;
        };
        try {
          const result = await client.deleteSuppressions(type, address);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "mailgun_list_domains",
      {
        displayName: "List Domains",
        description: "List all Mailgun domains on the account",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Number of results to return.", default: 100 },
            skip: { type: "integer", description: "Number of results to skip for pagination.", default: 0 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { limit, skip } = params as { limit?: number; skip?: number };
        try {
          const result = await client.listDomains({ limit, skip });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "mailgun_get_domain",
      {
        displayName: "Get Domain",
        description: "Get details for the configured Mailgun domain",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const result = await client.getDomain();
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "mailgun_list_mailing_lists",
      {
        displayName: "List Mailing Lists",
        description: "List Mailgun mailing lists",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Number of results to return.", default: 100 },
            p: { type: "string", description: "Page token for pagination." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { limit, p } = params as { limit?: number; p?: string };
        try {
          const result = await client.listMailingLists({ limit, p });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "mailgun_get_mailing_list",
      {
        displayName: "Get Mailing List",
        description: "Get a Mailgun mailing list by address",
        parametersSchema: {
          type: "object",
          properties: {
            address: { type: "string", description: "The mailing list email address." },
          },
          required: ["address"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { address } = params as { address: string };
        try {
          const result = await client.getMailingList(address);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "mailgun_list_mailing_list_members",
      {
        displayName: "List Mailing List Members",
        description: "List members of a Mailgun mailing list",
        parametersSchema: {
          type: "object",
          properties: {
            address: { type: "string", description: "The mailing list email address." },
            limit: { type: "integer", description: "Number of results to return.", default: 100 },
            subscribed: { type: "boolean", description: "Filter by subscription status (true = subscribed only, false = unsubscribed only)." },
          },
          required: ["address"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { address, limit, subscribed } = params as {
          address: string; limit?: number; subscribed?: boolean;
        };
        try {
          const result = await client.listMailingListMembers(address, { limit, subscribed });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "mailgun_add_mailing_list_member",
      {
        displayName: "Add Mailing List Member",
        description: "Add or update a member in a Mailgun mailing list",
        parametersSchema: {
          type: "object",
          properties: {
            list_address: { type: "string", description: "The mailing list email address." },
            member_email: { type: "string", description: "The member's email address to add." },
            name: { type: "string", description: "Display name for the member." },
            upsert: { type: "boolean", description: "If true, update existing member instead of failing (default: true).", default: true },
          },
          required: ["list_address", "member_email"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { list_address, member_email, name, upsert } = params as {
          list_address: string; member_email: string; name?: string; upsert?: boolean;
        };
        try {
          const result = await client.addMailingListMember(list_address, member_email, name, upsert ?? true);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "mailgun_get_stats",
      {
        displayName: "Get Stats",
        description: "Get email delivery stats for the Mailgun domain",
        parametersSchema: {
          type: "object",
          properties: {
            events: { type: "string", description: "Comma-separated list of event types to include (e.g. accepted,delivered,failed,opened,clicked)." },
            start: { type: "string", description: "Start of the time range (RFC 2822 date or Unix timestamp)." },
            end: { type: "string", description: "End of the time range (RFC 2822 date or Unix timestamp)." },
            resolution: { type: "string", description: "Resolution of the stats: hour, day, or month.", enum: ["hour", "day", "month"] },
          },
          required: ["events"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { events, start, end, resolution } = params as {
          events: string; start?: string; end?: string; resolution?: string;
        };
        try {
          const result = await client.getStats({
            event: events.split(",").map((e) => e.trim()),
            start,
            end,
            resolution,
          });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Mailgun plugin: all tools registered");
  },
});

runWorker(plugin, import.meta.url);
