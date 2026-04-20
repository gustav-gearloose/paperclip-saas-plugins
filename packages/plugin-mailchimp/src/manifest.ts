import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.mailchimp",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Mailchimp",
  description: "Mailchimp email marketing — manage audiences, members, campaigns, and tags.",
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
        title: "API Key (secret ref)",
        description: "UUID of a Paperclip secret holding your Mailchimp API key.",
        default: "",
      },
      serverPrefix: {
        type: "string",
        title: "Server Prefix",
        description: "The server prefix from your Mailchimp API key (e.g. 'us14' from the key suffix).",
        default: "",
      },
    },
    required: ["apiKeyRef", "serverPrefix"],
  },
  tools: [
    {
      name: "mailchimp_get_account_info",
      displayName: "Get Account Info",
      description: "Get Mailchimp account details and connected audiences.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "mailchimp_list_audiences",
      displayName: "List Audiences",
      description: "List all Mailchimp audiences (lists).",
      parametersSchema: {
        type: "object",
        properties: {
          count: { type: "integer", description: "Number of results (default 10, max 1000).", default: 10 },
          offset: { type: "integer", description: "Pagination offset.", default: 0 },
        },
      },
    },
    {
      name: "mailchimp_get_audience",
      displayName: "Get Audience",
      description: "Get details of a specific Mailchimp audience.",
      parametersSchema: {
        type: "object",
        properties: {
          list_id: { type: "string", description: "The Mailchimp audience (list) ID." },
        },
        required: ["list_id"],
      },
    },
    {
      name: "mailchimp_list_members",
      displayName: "List Members",
      description: "List members of a Mailchimp audience, optionally filtered by status or email.",
      parametersSchema: {
        type: "object",
        properties: {
          list_id: { type: "string", description: "The Mailchimp audience (list) ID." },
          count: { type: "integer", description: "Number of results (default 10, max 1000).", default: 10 },
          offset: { type: "integer", description: "Pagination offset.", default: 0 },
          status: { type: "string", description: "Filter by status: subscribed, unsubscribed, cleaned, pending, transactional." },
          email_address: { type: "string", description: "Filter by exact email address." },
        },
        required: ["list_id"],
      },
    },
    {
      name: "mailchimp_get_member",
      displayName: "Get Member",
      description: "Get details of a specific member in a Mailchimp audience by email address.",
      parametersSchema: {
        type: "object",
        properties: {
          list_id: { type: "string", description: "The Mailchimp audience (list) ID." },
          email: { type: "string", description: "The member's email address." },
        },
        required: ["list_id", "email"],
      },
    },
    {
      name: "mailchimp_add_or_update_member",
      displayName: "Add or Update Member",
      description: "Add a new member or update an existing member in a Mailchimp audience (upsert by email).",
      parametersSchema: {
        type: "object",
        properties: {
          list_id: { type: "string", description: "The Mailchimp audience (list) ID." },
          email: { type: "string", description: "The member's email address." },
          status: { type: "string", description: "Subscription status: subscribed, unsubscribed, pending, cleaned." },
          merge_fields: { type: "object", description: "Merge fields (e.g. FNAME, LNAME).", additionalProperties: true },
          tags: { type: "array", items: { type: "string" }, description: "Tags to assign to the member." },
        },
        required: ["list_id", "email"],
      },
    },
    {
      name: "mailchimp_archive_member",
      displayName: "Archive Member",
      description: "Archive (soft-delete) a member from a Mailchimp audience.",
      parametersSchema: {
        type: "object",
        properties: {
          list_id: { type: "string", description: "The Mailchimp audience (list) ID." },
          email: { type: "string", description: "The member's email address." },
        },
        required: ["list_id", "email"],
      },
    },
    {
      name: "mailchimp_list_campaigns",
      displayName: "List Campaigns",
      description: "List Mailchimp campaigns, optionally filtered by status or audience.",
      parametersSchema: {
        type: "object",
        properties: {
          count: { type: "integer", description: "Number of results (default 10, max 1000).", default: 10 },
          offset: { type: "integer", description: "Pagination offset.", default: 0 },
          status: { type: "string", description: "Filter by status: save, paused, schedule, sending, sent." },
          list_id: { type: "string", description: "Filter by audience ID." },
        },
      },
    },
    {
      name: "mailchimp_get_campaign",
      displayName: "Get Campaign",
      description: "Get details of a specific Mailchimp campaign.",
      parametersSchema: {
        type: "object",
        properties: {
          campaign_id: { type: "string", description: "The Mailchimp campaign ID." },
        },
        required: ["campaign_id"],
      },
    },
    {
      name: "mailchimp_get_campaign_report",
      displayName: "Get Campaign Report",
      description: "Get performance report for a sent Mailchimp campaign (opens, clicks, bounces).",
      parametersSchema: {
        type: "object",
        properties: {
          campaign_id: { type: "string", description: "The Mailchimp campaign ID." },
        },
        required: ["campaign_id"],
      },
    },
    {
      name: "mailchimp_add_tags_to_member",
      displayName: "Add Tags to Member",
      description: "Add one or more tags to a Mailchimp audience member.",
      parametersSchema: {
        type: "object",
        properties: {
          list_id: { type: "string", description: "The Mailchimp audience (list) ID." },
          email: { type: "string", description: "The member's email address." },
          tags: { type: "array", items: { type: "string" }, description: "Tags to add to the member." },
        },
        required: ["list_id", "email", "tags"],
      },
    },
  ],
};

export default manifest;
