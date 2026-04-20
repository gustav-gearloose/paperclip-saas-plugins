import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.outlook",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Microsoft Outlook",
  description: "Read and send Outlook email, manage calendar events via Microsoft Graph API.",
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
      tenantId: {
        type: "string",
        title: "Azure Tenant ID",
        description: "Your Azure AD tenant ID (Azure Portal → Azure Active Directory → Overview).",
        default: "",
      },
      userPrincipalName: {
        type: "string",
        title: "User Principal Name (UPN)",
        description: "The Outlook mailbox to access, e.g. user@company.com. Required for app-only (client credentials) access.",
        default: "",
      },
      clientIdRef: {
        type: "string",
        format: "secret-ref",
        title: "App Client ID (secret ref)",
        description: "UUID of a Paperclip secret holding your Azure AD app Client ID.",
        default: "",
      },
      clientSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "App Client Secret (secret ref)",
        description: "UUID of a Paperclip secret holding your Azure AD app Client Secret.",
        default: "",
      },
    },
    required: ["tenantId", "userPrincipalName", "clientIdRef", "clientSecretRef"],
  },
  tools: [
    {
      name: "outlook_list_messages",
      displayName: "List Messages",
      description: "List recent email messages from an Outlook mailbox folder.",
      parametersSchema: {
        type: "object",
        properties: {
          folder: { type: "string", description: "Folder name or ID (default: inbox)." },
          search: { type: "string", description: "Search query (OData $search syntax, e.g. 'subject:invoice')." },
          from_date: { type: "string", description: "Filter messages received after this date (ISO 8601)." },
          limit: { type: "integer", description: "Max messages to return (default 20)." },
          user: { type: "string", description: "Override the configured userPrincipalName for this call." },
        },
      },
    },
    {
      name: "outlook_get_message",
      displayName: "Get Message",
      description: "Get full details and body of a specific email message by ID.",
      parametersSchema: {
        type: "object",
        properties: {
          message_id: { type: "string", description: "Message ID from list_messages." },
          user: { type: "string", description: "Override the configured userPrincipalName." },
        },
        required: ["message_id"],
      },
    },
    {
      name: "outlook_send_message",
      displayName: "Send Message",
      description: "Send an email from the configured Outlook mailbox.",
      parametersSchema: {
        type: "object",
        properties: {
          to: { type: "array", items: { type: "string" }, description: "Recipient email addresses." },
          subject: { type: "string", description: "Email subject." },
          body: { type: "string", description: "Email body (plain text or HTML)." },
          body_type: { type: "string", enum: ["Text", "HTML"], description: "Body content type (default: Text)." },
          cc: { type: "array", items: { type: "string" }, description: "CC recipients." },
          user: { type: "string", description: "Override the configured userPrincipalName." },
        },
        required: ["to", "subject", "body"],
      },
    },
    {
      name: "outlook_reply_message",
      displayName: "Reply to Message",
      description: "Reply to an existing email message.",
      parametersSchema: {
        type: "object",
        properties: {
          message_id: { type: "string", description: "Message ID to reply to." },
          body: { type: "string", description: "Reply body text." },
          user: { type: "string", description: "Override the configured userPrincipalName." },
        },
        required: ["message_id", "body"],
      },
    },
    {
      name: "outlook_list_folders",
      displayName: "List Mail Folders",
      description: "List mail folders in the Outlook mailbox.",
      parametersSchema: {
        type: "object",
        properties: {
          user: { type: "string", description: "Override the configured userPrincipalName." },
        },
      },
    },
    {
      name: "outlook_list_events",
      displayName: "List Calendar Events",
      description: "List upcoming calendar events from the Outlook calendar.",
      parametersSchema: {
        type: "object",
        properties: {
          start: { type: "string", description: "Start of time range (ISO 8601, default: now)." },
          end: { type: "string", description: "End of time range (ISO 8601, default: 7 days from now)." },
          limit: { type: "integer", description: "Max events to return (default 20)." },
          user: { type: "string", description: "Override the configured userPrincipalName." },
        },
      },
    },
    {
      name: "outlook_get_event",
      displayName: "Get Calendar Event",
      description: "Get full details of a specific calendar event by ID.",
      parametersSchema: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event ID from list_events." },
          user: { type: "string", description: "Override the configured userPrincipalName." },
        },
        required: ["event_id"],
      },
    },
    {
      name: "outlook_create_event",
      displayName: "Create Calendar Event",
      description: "Create a new calendar event in the Outlook calendar.",
      parametersSchema: {
        type: "object",
        properties: {
          subject: { type: "string", description: "Event title." },
          start: { type: "string", description: "Start datetime (ISO 8601)." },
          end: { type: "string", description: "End datetime (ISO 8601)." },
          timezone: { type: "string", description: "Timezone (e.g. Europe/Copenhagen). Default: UTC." },
          body: { type: "string", description: "Event description/body." },
          attendees: { type: "array", items: { type: "string" }, description: "Attendee email addresses." },
          location: { type: "string", description: "Event location." },
          user: { type: "string", description: "Override the configured userPrincipalName." },
        },
        required: ["subject", "start", "end"],
      },
    },
    {
      name: "outlook_update_event",
      displayName: "Update Calendar Event",
      description: "Update an existing calendar event (subject, time, attendees, etc.).",
      parametersSchema: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event ID to update." },
          subject: { type: "string", description: "New event title." },
          start: { type: "string", description: "New start datetime (ISO 8601)." },
          end: { type: "string", description: "New end datetime (ISO 8601)." },
          timezone: { type: "string", description: "Timezone (e.g. Europe/Copenhagen)." },
          body: { type: "string", description: "New event description." },
          location: { type: "string", description: "New event location." },
          user: { type: "string", description: "Override the configured userPrincipalName." },
        },
        required: ["event_id"],
      },
    },
    {
      name: "outlook_delete_event",
      displayName: "Delete Calendar Event",
      description: "Delete a calendar event by ID.",
      parametersSchema: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Event ID to delete." },
          user: { type: "string", description: "Override the configured userPrincipalName." },
        },
        required: ["event_id"],
      },
    },
  ],
};

export default manifest;
