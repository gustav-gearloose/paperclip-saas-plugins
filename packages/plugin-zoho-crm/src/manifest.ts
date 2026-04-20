import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.zoho-crm",
  apiVersion: 1,
  version: "1.0.0",
  displayName: "Zoho CRM",
  description: "Manage Zoho CRM records, deals, contacts, and activities.",
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
        title: "Access Token (secret ref)",
        description: "UUID of a Paperclip secret holding your Zoho OAuth2 access token.",
        default: "",
      },
      domain: {
        type: "string",
        title: "Zoho API Domain",
        description: "Zoho CRM API domain (e.g. zohoapis.com, zohoapis.eu, zohoapis.in).",
        default: "zohoapis.com",
      },
    },
    required: ["accessTokenRef", "domain"],
  },
  tools: [
    {
      name: "zoho_crm_list_records",
      displayName: "List Records",
      description: "List records from a Zoho CRM module (Contacts, Leads, Accounts, etc.)",
      parametersSchema: {
        type: "object",
        properties: {
          module: { type: "string", description: "The CRM module name (e.g. Contacts, Leads, Accounts, Deals)." },
          page: { type: "integer", description: "Page number for pagination.", default: 1 },
          per_page: { type: "integer", description: "Number of records per page.", default: 20 },
          sort_by: { type: "string", description: "Field to sort by." },
          sort_order: { type: "string", description: "Sort order: asc or desc.", enum: ["asc", "desc"] },
          fields: { type: "string", description: "Comma-separated list of fields to include." },
        },
        required: ["module"],
      },
    },
    {
      name: "zoho_crm_get_record",
      displayName: "Get Record",
      description: "Get a single record by ID from a Zoho CRM module.",
      parametersSchema: {
        type: "object",
        properties: {
          module: { type: "string", description: "The CRM module name." },
          id: { type: "string", description: "The record ID." },
        },
        required: ["module", "id"],
      },
    },
    {
      name: "zoho_crm_create_record",
      displayName: "Create Record",
      description: "Create a new record in a Zoho CRM module.",
      parametersSchema: {
        type: "object",
        properties: {
          module: { type: "string", description: "The CRM module name (e.g. Contacts, Leads, Accounts)." },
          data: { type: "object", description: "Record field values as key-value pairs.", additionalProperties: true },
        },
        required: ["module", "data"],
      },
    },
    {
      name: "zoho_crm_update_record",
      displayName: "Update Record",
      description: "Update an existing record in a Zoho CRM module.",
      parametersSchema: {
        type: "object",
        properties: {
          module: { type: "string", description: "The CRM module name." },
          id: { type: "string", description: "The record ID to update." },
          data: { type: "object", description: "Record field values to update.", additionalProperties: true },
        },
        required: ["module", "id", "data"],
      },
    },
    {
      name: "zoho_crm_delete_record",
      displayName: "Delete Record",
      description: "Delete a record from a Zoho CRM module.",
      parametersSchema: {
        type: "object",
        properties: {
          module: { type: "string", description: "The CRM module name." },
          id: { type: "string", description: "The record ID to delete." },
        },
        required: ["module", "id"],
      },
    },
    {
      name: "zoho_crm_search_records",
      displayName: "Search Records",
      description: "Search records in a Zoho CRM module by criteria, email, phone, or keyword.",
      parametersSchema: {
        type: "object",
        properties: {
          module: { type: "string", description: "The CRM module name." },
          criteria: { type: "string", description: "Search criteria expression (e.g. (Last_Name:equals:Smith))." },
          email: { type: "string", description: "Email address to search by." },
          phone: { type: "string", description: "Phone number to search by." },
          word: { type: "string", description: "Keyword to search across all fields." },
          page: { type: "integer", description: "Page number for pagination.", default: 1 },
          per_page: { type: "integer", description: "Number of records per page.", default: 20 },
        },
        required: ["module"],
      },
    },
    {
      name: "zoho_crm_list_users",
      displayName: "List Users",
      description: "List users in the Zoho CRM organization.",
      parametersSchema: {
        type: "object",
        properties: {
          type: { type: "string", description: "Filter by user type (e.g. AllUsers, ActiveUsers, DeactiveUsers, AdminUsers)." },
          page: { type: "integer", description: "Page number for pagination.", default: 1 },
          per_page: { type: "integer", description: "Number of users per page.", default: 20 },
        },
      },
    },
    {
      name: "zoho_crm_get_organization",
      displayName: "Get Organization",
      description: "Get organization details from Zoho CRM.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "zoho_crm_list_deals",
      displayName: "List Deals",
      description: "List deals/opportunities from Zoho CRM.",
      parametersSchema: {
        type: "object",
        properties: {
          page: { type: "integer", description: "Page number for pagination.", default: 1 },
          per_page: { type: "integer", description: "Number of deals per page.", default: 20 },
          sort_by: { type: "string", description: "Field to sort by." },
          sort_order: { type: "string", description: "Sort order: asc or desc.", enum: ["asc", "desc"] },
        },
      },
    },
    {
      name: "zoho_crm_create_note",
      displayName: "Create Note",
      description: "Create a note attached to a Zoho CRM record.",
      parametersSchema: {
        type: "object",
        properties: {
          parentModule: { type: "string", description: "The module of the parent record (e.g. Contacts, Leads, Deals)." },
          parentId: { type: "string", description: "The ID of the parent record." },
          noteTitle: { type: "string", description: "Title of the note." },
          noteContent: { type: "string", description: "Body content of the note." },
        },
        required: ["parentModule", "parentId", "noteTitle", "noteContent"],
      },
    },
    {
      name: "zoho_crm_list_activities",
      displayName: "List Activities",
      description: "List activities (calls, meetings, tasks) from Zoho CRM.",
      parametersSchema: {
        type: "object",
        properties: {
          page: { type: "integer", description: "Page number for pagination.", default: 1 },
          per_page: { type: "integer", description: "Number of activities per page.", default: 20 },
          type: { type: "string", description: "Filter by activity type (e.g. calls, meetings, tasks)." },
        },
      },
    },
  ],
};

export default manifest;
