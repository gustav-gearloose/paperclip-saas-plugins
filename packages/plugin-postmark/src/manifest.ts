import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.postmark",
  apiVersion: 1,
  version: "1.0.0",
  displayName: "Postmark",
  description: "Send transactional emails and manage bounces via Postmark.",
  author: "Gearloose",
  categories: ["connector"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "instance.settings.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      serverTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "Server Token (secret ref)",
        description: "UUID of a Paperclip secret holding your Postmark server API token.",
        default: "",
      },
    },
    required: ["serverTokenRef"],
  },
  tools: [
    {
      name: "postmark_send_email",
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
    {
      name: "postmark_send_email_with_template",
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
    {
      name: "postmark_get_outbound_stats",
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
    {
      name: "postmark_list_outbound_messages",
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
    {
      name: "postmark_get_outbound_message_details",
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
    {
      name: "postmark_list_inbound_messages",
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
    {
      name: "postmark_list_bounces",
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
    {
      name: "postmark_get_bounce",
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
    {
      name: "postmark_activate_bounce",
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
    {
      name: "postmark_list_templates",
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
    {
      name: "postmark_get_template",
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
    {
      name: "postmark_list_servers",
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
    {
      name: "postmark_get_server",
      displayName: "Get Server",
      description: "Get details for the current Postmark server.",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "postmark_list_suppressions",
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
  ],
};

export default manifest;
