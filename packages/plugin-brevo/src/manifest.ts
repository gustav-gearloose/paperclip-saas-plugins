import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.brevo",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Brevo",
  description: "Brevo (Sendinblue) — send transactional emails, manage contacts and lists, read campaign reports.",
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
        description: "UUID of a Paperclip secret holding your Brevo API key.",
        default: "",
      },
    },
    required: ["apiKeyRef"],
  },
  tools: [
    {
      name: "brevo_get_account_info",
      displayName: "Get Account Info",
      description: "Get Brevo account details including plan, credits, and sender addresses.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "brevo_send_transactional_email",
      displayName: "Send Transactional Email",
      description: "Send a transactional email via Brevo to one or more recipients.",
      parametersSchema: {
        type: "object",
        properties: {
          to: {
            type: "array",
            description: "List of recipients.",
            items: {
              type: "object",
              properties: {
                email: { type: "string", description: "Recipient email address." },
                name: { type: "string", description: "Recipient display name." },
              },
              required: ["email"],
            },
          },
          sender_email: { type: "string", description: "Sender email address." },
          sender_name: { type: "string", description: "Sender display name." },
          subject: { type: "string", description: "Email subject line." },
          htmlContent: { type: "string", description: "HTML body of the email." },
          textContent: { type: "string", description: "Plain text body of the email." },
          templateId: { type: "integer", description: "Brevo template ID to use instead of htmlContent/textContent." },
          params: { type: "object", description: "Template parameters.", additionalProperties: true },
        },
        required: ["to", "sender_email", "subject"],
      },
    },
    {
      name: "brevo_list_contacts",
      displayName: "List Contacts",
      description: "List Brevo contacts.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Number of results (default 50, max 1000).", default: 50 },
          offset: { type: "integer", description: "Pagination offset.", default: 0 },
          sort: { type: "string", description: "Sort order: asc or desc.", default: "desc" },
          email: { type: "string", description: "Filter by email address." },
        },
      },
    },
    {
      name: "brevo_get_contact",
      displayName: "Get Contact",
      description: "Get details of a Brevo contact by email address or contact ID.",
      parametersSchema: {
        type: "object",
        properties: {
          email_or_id: { type: "string", description: "Contact email address or numeric ID." },
        },
        required: ["email_or_id"],
      },
    },
    {
      name: "brevo_create_contact",
      displayName: "Create Contact",
      description: "Create a new contact in Brevo.",
      parametersSchema: {
        type: "object",
        properties: {
          email: { type: "string", description: "Contact email address." },
          attributes: { type: "object", description: "Contact attributes (e.g. FIRSTNAME, LASTNAME).", additionalProperties: true },
          listIds: { type: "array", items: { type: "integer" }, description: "List IDs to add the contact to." },
          emailBlacklisted: { type: "boolean", description: "Mark contact as email blacklisted." },
        },
        required: ["email"],
      },
    },
    {
      name: "brevo_update_contact",
      displayName: "Update Contact",
      description: "Update an existing Brevo contact.",
      parametersSchema: {
        type: "object",
        properties: {
          email_or_id: { type: "string", description: "Contact email address or numeric ID." },
          attributes: { type: "object", description: "Attributes to update.", additionalProperties: true },
          listIds: { type: "array", items: { type: "integer" }, description: "List IDs to add the contact to." },
          unlinkListIds: { type: "array", items: { type: "integer" }, description: "List IDs to remove the contact from." },
          emailBlacklisted: { type: "boolean", description: "Update email blacklist status." },
        },
        required: ["email_or_id"],
      },
    },
    {
      name: "brevo_list_contact_lists",
      displayName: "List Contact Lists",
      description: "List all contact lists in Brevo.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Number of results (default 10).", default: 10 },
          offset: { type: "integer", description: "Pagination offset.", default: 0 },
          sort: { type: "string", description: "Sort order: asc or desc.", default: "desc" },
        },
      },
    },
    {
      name: "brevo_list_email_campaigns",
      displayName: "List Email Campaigns",
      description: "List Brevo email campaigns, optionally filtered by type or status.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Number of results (default 10).", default: 10 },
          offset: { type: "integer", description: "Pagination offset.", default: 0 },
          type: { type: "string", description: "Campaign type: classic or trigger." },
          status: { type: "string", description: "Filter by status: draft, sent, archive, queued, suspended, inProcess." },
          sort: { type: "string", description: "Sort order: asc or desc.", default: "desc" },
        },
      },
    },
    {
      name: "brevo_get_email_campaign",
      displayName: "Get Email Campaign",
      description: "Get details of a specific Brevo email campaign.",
      parametersSchema: {
        type: "object",
        properties: {
          campaign_id: { type: "integer", description: "The Brevo campaign ID." },
        },
        required: ["campaign_id"],
      },
    },
    {
      name: "brevo_get_campaign_report",
      displayName: "Get Campaign Report",
      description: "Get performance report for a Brevo email campaign (opens, clicks, bounces, unsubscribes).",
      parametersSchema: {
        type: "object",
        properties: {
          campaign_id: { type: "integer", description: "The Brevo campaign ID." },
        },
        required: ["campaign_id"],
      },
    },
    {
      name: "brevo_list_transactional_email_logs",
      displayName: "List Transactional Email Logs",
      description: "List logs of transactional emails sent via Brevo.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Number of results (default 50, max 1000).", default: 50 },
          offset: { type: "integer", description: "Pagination offset.", default: 0 },
          email: { type: "string", description: "Filter by recipient email." },
          sort: { type: "string", description: "Sort order: asc or desc.", default: "desc" },
          startDate: { type: "string", description: "Filter logs from this date (YYYY-MM-DD)." },
          endDate: { type: "string", description: "Filter logs up to this date (YYYY-MM-DD)." },
        },
      },
    },
  ],
};

export default manifest;
