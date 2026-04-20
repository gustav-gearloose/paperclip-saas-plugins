import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.sendgrid",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "SendGrid",
  description: "SendGrid — send transactional emails, manage marketing contacts and lists, read delivery stats.",
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
        description: "UUID of a Paperclip secret holding your SendGrid API key.",
        default: "",
      },
    },
    required: ["apiKeyRef"],
  },
  tools: [
    {
      name: "sendgrid_send_email",
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
    {
      name: "sendgrid_list_contacts",
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
    {
      name: "sendgrid_search_contacts",
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
    {
      name: "sendgrid_upsert_contacts",
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
    {
      name: "sendgrid_delete_contacts",
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
    {
      name: "sendgrid_list_lists",
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
    {
      name: "sendgrid_get_list",
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
    {
      name: "sendgrid_create_list",
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
    {
      name: "sendgrid_add_contacts_to_list",
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
    {
      name: "sendgrid_list_templates",
      displayName: "List Email Templates",
      description: "List dynamic email templates in SendGrid.",
      parametersSchema: {
        type: "object",
        properties: {
          page_size: { type: "integer", description: "Results per page.", default: 20 },
        },
      },
    },
    {
      name: "sendgrid_get_template",
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
    {
      name: "sendgrid_get_stats",
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
    {
      name: "sendgrid_list_unsubscribes",
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
    {
      name: "sendgrid_add_global_unsubscribe",
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
  ],
};

export default manifest;
