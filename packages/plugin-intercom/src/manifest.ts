import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.intercom",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Intercom",
  description: "Access Intercom customer conversations, contacts, and support data.",
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
      accessTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "Intercom Access Token (ref)",
        description: "UUID of a Paperclip secret holding your Intercom API access token.",
        default: "",
      },
    },
    required: ["accessTokenRef"],
  },
  tools: [
    {
      name: "intercom_search_contacts",
      displayName: "Search Contacts",
      description: "Search Intercom contacts (leads and users) by email, name, or custom attributes.",
      parametersSchema: {
        type: "object",
        properties: {
          email: { type: "string", description: "Filter by exact email address." },
          query: { type: "string", description: "Full-text search query across name and email." },
          limit: { type: "integer", description: "Max results (default 20).", default: 20 },
        },
      },
    },
    {
      name: "intercom_get_contact",
      displayName: "Get Contact",
      description: "Get full details for a specific Intercom contact by ID.",
      parametersSchema: {
        type: "object",
        properties: {
          contact_id: { type: "string", description: "Intercom contact ID." },
        },
        required: ["contact_id"],
      },
    },
    {
      name: "intercom_create_contact",
      displayName: "Create Contact",
      description: "Create a new contact (lead or user) in Intercom.",
      parametersSchema: {
        type: "object",
        properties: {
          email: { type: "string", description: "Contact email address." },
          name: { type: "string", description: "Contact display name." },
          phone: { type: "string", description: "Phone number." },
          role: { type: "string", enum: ["user", "lead"], description: "Contact role.", default: "lead" },
          custom_attributes: { type: "object", description: "Key/value custom attributes to set on the contact." },
        },
        required: ["email"],
      },
    },
    {
      name: "intercom_list_conversations",
      displayName: "List Conversations",
      description: "List Intercom conversations, optionally filtered by status or assignee.",
      parametersSchema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["open", "closed", "pending", "snoozed", "all"], description: "Conversation status filter.", default: "open" },
          assignee_id: { type: "string", description: "Filter by assigned admin ID." },
          limit: { type: "integer", description: "Max results (default 20).", default: 20 },
        },
      },
    },
    {
      name: "intercom_get_conversation",
      displayName: "Get Conversation",
      description: "Get full details and message thread for a specific Intercom conversation.",
      parametersSchema: {
        type: "object",
        properties: {
          conversation_id: { type: "string", description: "Intercom conversation ID." },
        },
        required: ["conversation_id"],
      },
    },
    {
      name: "intercom_reply_to_conversation",
      displayName: "Reply to Conversation",
      description: "Send an admin reply to an Intercom conversation.",
      parametersSchema: {
        type: "object",
        properties: {
          conversation_id: { type: "string", description: "Conversation ID to reply to." },
          message: { type: "string", description: "Reply message body (plain text or HTML)." },
          admin_id: { type: "string", description: "Admin ID sending the reply." },
        },
        required: ["conversation_id", "message", "admin_id"],
      },
    },
    {
      name: "intercom_close_conversation",
      displayName: "Close Conversation",
      description: "Close an open Intercom conversation.",
      parametersSchema: {
        type: "object",
        properties: {
          conversation_id: { type: "string", description: "Conversation ID to close." },
          admin_id: { type: "string", description: "Admin ID performing the close." },
        },
        required: ["conversation_id", "admin_id"],
      },
    },
    {
      name: "intercom_create_note",
      displayName: "Create Note",
      description: "Add an internal note to an Intercom conversation (not visible to customer).",
      parametersSchema: {
        type: "object",
        properties: {
          conversation_id: { type: "string", description: "Conversation ID to add the note to." },
          note: { type: "string", description: "Note text content." },
          admin_id: { type: "string", description: "Admin ID adding the note." },
        },
        required: ["conversation_id", "note", "admin_id"],
      },
    },
    {
      name: "intercom_list_admins",
      displayName: "List Admins",
      description: "List all admin team members in the Intercom workspace.",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "intercom_create_conversation",
      displayName: "Create Conversation",
      description: "Start a new outbound conversation with a contact in Intercom.",
      parametersSchema: {
        type: "object",
        properties: {
          from_admin_id: { type: "string", description: "Admin ID sending the message." },
          to_contact_id: { type: "string", description: "Contact ID to message." },
          message: { type: "string", description: "Opening message body." },
          subject: { type: "string", description: "Conversation subject (for email channel)." },
        },
        required: ["from_admin_id", "to_contact_id", "message"],
      },
    },
  ],
};

export default manifest;
