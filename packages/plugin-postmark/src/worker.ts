import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { PostmarkClient } from "./postmark-client.js";

interface PostmarkPluginConfig {
  serverTokenRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    let cachedClient: PostmarkClient | null = null;
    let configError: string | null = null;

    async function getClient(): Promise<PostmarkClient | null> {
      if (cachedClient) return cachedClient;
      if (configError) return null;

const config = await ctx.config.get() as PostmarkPluginConfig;

      if (!config.serverTokenRef) {
        configError = "Postmark plugin: serverTokenRef is required";
        ctx.logger.warn("config missing");
        return null;
      }

      let serverToken: string;
      try {
        serverToken = await ctx.secrets.resolve(config.serverTokenRef);
      } catch (err) {
        configError = `Postmark plugin: failed to resolve serverTokenRef: ${err instanceof Error ? err.message : String(err)}`;
        ctx.logger.warn("config missing");
        return null;
      }

      cachedClient = new PostmarkClient(serverToken);
      return cachedClient;
      ctx.logger.info("Postmark plugin: client initialized, registering tools");
    }

    ctx.tools.register(
      "postmark_send_email",
      {
        displayName: "Send Email",
        description: "Send a transactional email via Postmark.",
        parametersSchema: {
          type: "object",
          properties: {
            from: { type: "string", description: "Sender email address." },
            to: { type: "string", description: "Recipient email address." },
            subject: { type: "string", description: "Email subject line." },
            text_body: { type: "string", description: "Plain text body." },
            html_body: { type: "string", description: "HTML body." },
            reply_to: { type: "string", description: "Reply-to email address." },
            cc: { type: "string", description: "CC email addresses (comma-separated)." },
            bcc: { type: "string", description: "BCC email addresses (comma-separated)." },
            tag: { type: "string", description: "Tag for categorising the message." },
            track_opens: { type: "boolean", description: "Whether to track email opens." },
            track_links: { type: "string", description: "Link tracking mode: None, HtmlAndText, HtmlOnly, TextOnly." },
            message_stream: { type: "string", description: "Message stream ID (default: outbound)." },
          },
          required: ["from", "to", "subject"],
        },
      },
      async (params): Promise<ToolResult> => {
        const {
          from, to, subject, text_body, html_body, reply_to, cc, bcc,
          tag, track_opens, track_links, message_stream,
        } = params as {
          from: string; to: string; subject: string;
          text_body?: string; html_body?: string; reply_to?: string;
          cc?: string; bcc?: string; tag?: string;
          track_opens?: boolean; track_links?: string; message_stream?: string;
        };
        try {
          const result = await client.sendEmail({
            From: from,
            To: to,
            Subject: subject,
            TextBody: text_body,
            HtmlBody: html_body,
            ReplyTo: reply_to,
            Cc: cc,
            Bcc: bcc,
            Tag: tag,
            TrackOpens: track_opens,
            TrackLinks: track_links,
            MessageStream: message_stream,
          });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "postmark_send_email_with_template",
      {
        displayName: "Send Email with Template",
        description: "Send an email using a Postmark template.",
        parametersSchema: {
          type: "object",
          properties: {
            from: { type: "string", description: "Sender email address." },
            to: { type: "string", description: "Recipient email address." },
            template_id: { type: "integer", description: "Numeric Postmark template ID." },
            template_alias: { type: "string", description: "Template alias string." },
            template_model: { type: "object", description: "Template variable values.", additionalProperties: true },
            reply_to: { type: "string", description: "Reply-to email address." },
            tag: { type: "string", description: "Tag for categorising the message." },
            message_stream: { type: "string", description: "Message stream ID." },
          },
          required: ["from", "to", "template_model"],
        },
      },
      async (params): Promise<ToolResult> => {
        const {
          from, to, template_id, template_alias, template_model,
          reply_to, tag, message_stream,
        } = params as {
          from: string; to: string;
          template_id?: number; template_alias?: string;
          template_model: Record<string, unknown>;
          reply_to?: string; tag?: string; message_stream?: string;
        };
        try {
          const result = await client.sendEmailWithTemplate({
            From: from,
            To: to,
            TemplateId: template_id,
            TemplateAlias: template_alias,
            TemplateModel: template_model,
            ReplyTo: reply_to,
            Tag: tag,
            MessageStream: message_stream,
          });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "postmark_get_outbound_stats",
      {
        displayName: "Get Outbound Stats",
        description: "Get outbound email delivery statistics from Postmark.",
        parametersSchema: {
          type: "object",
          properties: {
            tag: { type: "string", description: "Filter stats by tag." },
            fromdate: { type: "string", description: "Start date (YYYY-MM-DD)." },
            todate: { type: "string", description: "End date (YYYY-MM-DD)." },
            messagestream: { type: "string", description: "Filter by message stream ID." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { tag, fromdate, todate, messagestream } = params as {
          tag?: string; fromdate?: string; todate?: string; messagestream?: string;
        };
        try {
          const result = await client.getOutboundStats({ tag, fromdate, todate, messagestream });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "postmark_list_outbound_messages",
      {
        displayName: "List Outbound Messages",
        description: "List outbound messages sent through Postmark.",
        parametersSchema: {
          type: "object",
          properties: {
            count: { type: "integer", description: "Number of results to return.", default: 25 },
            offset: { type: "integer", description: "Pagination offset.", default: 0 },
            recipient: { type: "string", description: "Filter by recipient email." },
            tag: { type: "string", description: "Filter by tag." },
            status: { type: "string", description: "Filter by delivery status." },
            fromdate: { type: "string", description: "Start date (YYYY-MM-DD)." },
            todate: { type: "string", description: "End date (YYYY-MM-DD)." },
            messagestream: { type: "string", description: "Filter by message stream ID." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { count, offset, recipient, tag, status, fromdate, todate, messagestream } = params as {
          count?: number; offset?: number; recipient?: string; tag?: string;
          status?: string; fromdate?: string; todate?: string; messagestream?: string;
        };
        try {
          const result = await client.listOutboundMessages({ count, offset, recipient, tag, status, fromdate, todate, messagestream });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "postmark_get_outbound_message_details",
      {
        displayName: "Get Outbound Message Details",
        description: "Get details for a specific outbound message.",
        parametersSchema: {
          type: "object",
          properties: {
            message_id: { type: "string", description: "The message ID to look up." },
          },
          required: ["message_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { message_id } = params as { message_id: string };
        try {
          const result = await client.getOutboundMessageDetails(message_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "postmark_list_inbound_messages",
      {
        displayName: "List Inbound Messages",
        description: "List inbound messages received via Postmark.",
        parametersSchema: {
          type: "object",
          properties: {
            count: { type: "integer", description: "Number of results to return.", default: 25 },
            offset: { type: "integer", description: "Pagination offset.", default: 0 },
            recipient: { type: "string", description: "Filter by recipient email." },
            subject: { type: "string", description: "Filter by subject." },
            mailboxhash: { type: "string", description: "Filter by mailbox hash." },
            status: { type: "string", description: "Filter by status." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { count, offset, recipient, subject, mailboxhash, status } = params as {
          count?: number; offset?: number; recipient?: string;
          subject?: string; mailboxhash?: string; status?: string;
        };
        try {
          const result = await client.listInboundMessages({ count, offset, recipient, subject, mailboxhash, status });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "postmark_list_bounces",
      {
        displayName: "List Bounces",
        description: "List email bounces in Postmark.",
        parametersSchema: {
          type: "object",
          properties: {
            count: { type: "integer", description: "Number of results to return.", default: 25 },
            offset: { type: "integer", description: "Pagination offset.", default: 0 },
            type: { type: "string", description: "Bounce type filter (e.g. HardBounce, SoftBounce)." },
            emailFilter: { type: "string", description: "Filter by recipient email." },
            fromdate: { type: "string", description: "Start date (YYYY-MM-DD)." },
            todate: { type: "string", description: "End date (YYYY-MM-DD)." },
            messagestream: { type: "string", description: "Filter by message stream ID." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { count, offset, type, emailFilter, fromdate, todate, messagestream } = params as {
          count?: number; offset?: number; type?: string; emailFilter?: string;
          fromdate?: string; todate?: string; messagestream?: string;
        };
        try {
          const result = await client.listBounces({ count, offset, type, emailFilter, fromdate, todate, messagestream });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "postmark_get_bounce",
      {
        displayName: "Get Bounce",
        description: "Get details for a specific bounce by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            bounce_id: { type: "integer", description: "The numeric bounce ID." },
          },
          required: ["bounce_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { bounce_id } = params as { bounce_id: number };
        try {
          const result = await client.getBounce(bounce_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "postmark_activate_bounce",
      {
        displayName: "Activate Bounce",
        description: "Reactivate a bounced email address in Postmark.",
        parametersSchema: {
          type: "object",
          properties: {
            bounce_id: { type: "integer", description: "The numeric bounce ID to reactivate." },
          },
          required: ["bounce_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { bounce_id } = params as { bounce_id: number };
        try {
          const result = await client.activateBounce(bounce_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "postmark_list_templates",
      {
        displayName: "List Templates",
        description: "List email templates in Postmark.",
        parametersSchema: {
          type: "object",
          properties: {
            count: { type: "integer", description: "Number of results to return.", default: 25 },
            offset: { type: "integer", description: "Pagination offset.", default: 0 },
            messagestream: { type: "string", description: "Filter by message stream ID." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { count, offset, messagestream } = params as {
          count?: number; offset?: number; messagestream?: string;
        };
        try {
          const result = await client.listTemplates({ count, offset, messagestream });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "postmark_get_template",
      {
        displayName: "Get Template",
        description: "Get a Postmark template by ID or alias.",
        parametersSchema: {
          type: "object",
          properties: {
            id_or_alias: { type: "string", description: "Template numeric ID or alias string." },
          },
          required: ["id_or_alias"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { id_or_alias } = params as { id_or_alias: string };
        const parsed = parseInt(id_or_alias, 10);
        const idOrAlias: string | number = isNaN(parsed) ? id_or_alias : parsed;
        try {
          const result = await client.getTemplate(idOrAlias);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "postmark_list_servers",
      {
        displayName: "List Servers",
        description: "List all Postmark servers on the account.",
        parametersSchema: {
          type: "object",
          properties: {
            count: { type: "integer", description: "Number of results to return.", default: 25 },
            offset: { type: "integer", description: "Pagination offset.", default: 0 },
            name: { type: "string", description: "Filter by server name." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { count, offset, name } = params as { count?: number; offset?: number; name?: string };
        try {
          const result = await client.listServers({ count, offset, name });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "postmark_get_server",
      {
        displayName: "Get Server",
        description: "Get details for the current Postmark server.",
        parametersSchema: {
          type: "object",
          properties: {},
        },
      },
      async (): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.getServer();
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "postmark_list_suppressions",
      {
        displayName: "List Suppressions",
        description: "List suppressed email addresses in Postmark.",
        parametersSchema: {
          type: "object",
          properties: {
            messagestream: { type: "string", description: "Message stream ID (default: outbound)." },
            emailaddress: { type: "string", description: "Filter by email address." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { messagestream, emailaddress } = params as { messagestream?: string; emailaddress?: string };
        try {
          const result = await client.listSuppressions({ messagestream, emailaddress });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Postmark plugin: all tools registered");
  },
});

runWorker(plugin, import.meta.url);
