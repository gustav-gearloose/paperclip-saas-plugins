import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.freshsales",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Freshsales",
  description: "Search contacts, accounts, deals, notes, and tasks in Freshsales CRM via API key.",
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
        title: "Freshsales API Key (secret ref)",
        description: "UUID of a Paperclip secret holding a Freshsales API key.",
        default: "",
      },
      domain: {
        type: "string",
        title: "Freshsales Domain",
        description: "Your Freshsales subdomain (e.g. 'mycompany' from mycompany.myfreshworks.com).",
        default: "",
      },
    },
    required: ["apiKeyRef", "domain"],
  },
  tools: [
    {
      name: "freshsales_list_contacts",
      displayName: "List Contacts",
      description: "List contacts in Freshsales CRM.",
      parametersSchema: {
        type: "object",
        properties: {
          page: { type: "integer", description: "Page number (default 1)." },
          limit: { type: "integer", description: "Results per page (default 25)." },
        },
      },
    },
    {
      name: "freshsales_get_contact",
      displayName: "Get Contact",
      description: "Get a contact by ID, including linked accounts, deals, and notes.",
      parametersSchema: {
        type: "object",
        properties: {
          id: { type: "integer", description: "Freshsales contact ID." },
        },
        required: ["id"],
      },
    },
    {
      name: "freshsales_create_contact",
      displayName: "Create Contact",
      description: "Create a new contact in Freshsales.",
      parametersSchema: {
        type: "object",
        properties: {
          first_name: { type: "string", description: "First name." },
          last_name: { type: "string", description: "Last name." },
          email: { type: "string", description: "Email address." },
          mobile_number: { type: "string", description: "Mobile phone number." },
          work_number: { type: "string", description: "Work phone number." },
          job_title: { type: "string", description: "Job title." },
        },
      },
    },
    {
      name: "freshsales_update_contact",
      displayName: "Update Contact",
      description: "Update fields on an existing Freshsales contact.",
      parametersSchema: {
        type: "object",
        properties: {
          id: { type: "integer", description: "Freshsales contact ID to update." },
          first_name: { type: "string", description: "First name." },
          last_name: { type: "string", description: "Last name." },
          email: { type: "string", description: "Email address." },
          mobile_number: { type: "string", description: "Mobile phone number." },
          job_title: { type: "string", description: "Job title." },
        },
        required: ["id"],
      },
    },
    {
      name: "freshsales_list_accounts",
      displayName: "List Accounts",
      description: "List company accounts in Freshsales CRM.",
      parametersSchema: {
        type: "object",
        properties: {
          page: { type: "integer", description: "Page number (default 1)." },
          limit: { type: "integer", description: "Results per page (default 25)." },
        },
      },
    },
    {
      name: "freshsales_get_account",
      displayName: "Get Account",
      description: "Get an account by ID, including linked contacts and deals.",
      parametersSchema: {
        type: "object",
        properties: {
          id: { type: "integer", description: "Freshsales account ID." },
        },
        required: ["id"],
      },
    },
    {
      name: "freshsales_list_deals",
      displayName: "List Deals",
      description: "List deals/opportunities in Freshsales CRM.",
      parametersSchema: {
        type: "object",
        properties: {
          page: { type: "integer", description: "Page number (default 1)." },
          limit: { type: "integer", description: "Results per page (default 25)." },
        },
      },
    },
    {
      name: "freshsales_get_deal",
      displayName: "Get Deal",
      description: "Get a deal by ID, including linked contacts, account, and notes.",
      parametersSchema: {
        type: "object",
        properties: {
          id: { type: "integer", description: "Freshsales deal ID." },
        },
        required: ["id"],
      },
    },
    {
      name: "freshsales_create_deal",
      displayName: "Create Deal",
      description: "Create a new deal/opportunity in Freshsales.",
      parametersSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Deal name." },
          amount: { type: "number", description: "Deal value/amount." },
          close_date: { type: "string", description: "Expected close date (YYYY-MM-DD)." },
          sales_account_id: { type: "integer", description: "Linked account ID." },
        },
        required: ["name"],
      },
    },
    {
      name: "freshsales_add_note",
      displayName: "Add Note",
      description: "Add a note to a contact, account, or deal in Freshsales.",
      parametersSchema: {
        type: "object",
        properties: {
          description: { type: "string", description: "Note text content." },
          targetable_type: { type: "string", enum: ["Contact", "SalesAccount", "Deal"], description: "Type of entity to attach the note to." },
          targetable_id: { type: "integer", description: "ID of the contact, account, or deal." },
        },
        required: ["description", "targetable_type", "targetable_id"],
      },
    },
    {
      name: "freshsales_list_tasks",
      displayName: "List Tasks",
      description: "List tasks in Freshsales, optionally filtered by status.",
      parametersSchema: {
        type: "object",
        properties: {
          filter: { type: "string", enum: ["open", "due_today", "overdue", "completed"], description: "Filter tasks by status." },
          page: { type: "integer", description: "Page number (default 1)." },
        },
      },
    },
    {
      name: "freshsales_search",
      displayName: "Search",
      description: "Search across contacts, accounts, and deals in Freshsales.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query string." },
          include: { type: "string", description: "Comma-separated entity types to search (default: contact,sales_account,deal)." },
        },
        required: ["query"],
      },
    },
  ],
};

export default manifest;
