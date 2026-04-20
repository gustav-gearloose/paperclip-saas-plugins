import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.mailgun",
  apiVersion: 1,
  version: "1.0.0",
  displayName: "Mailgun",
  description: "Send emails and manage mailing lists via Mailgun",
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
      apiKeyRef: {
        type: "string",
        format: "secret-ref",
        title: "Mailgun API Key (secret ref)",
        description: "UUID of a Paperclip secret holding your Mailgun private API key.",
        default: "",
      },
      domain: {
        type: "string",
        title: "Mailgun Sending Domain",
        description: "Mailgun sending domain (e.g. mg.example.com).",
        default: "",
      },
      region: {
        type: "string",
        title: "Region",
        description: "Region: us or eu (default: us).",
        default: "us",
      },
    },
    required: ["apiKeyRef", "domain"],
  },
  tools: [
    {
      name: "mailgun_send_message",
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
    {
      name: "mailgun_get_events",
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
    {
      name: "mailgun_list_suppressions",
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
    {
      name: "mailgun_delete_suppression",
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
    {
      name: "mailgun_list_domains",
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
    {
      name: "mailgun_get_domain",
      displayName: "Get Domain",
      description: "Get details for the configured Mailgun domain",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "mailgun_list_mailing_lists",
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
    {
      name: "mailgun_get_mailing_list",
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
    {
      name: "mailgun_list_mailing_list_members",
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
    {
      name: "mailgun_add_mailing_list_member",
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
    {
      name: "mailgun_get_stats",
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
  ],
};

export default manifest;
