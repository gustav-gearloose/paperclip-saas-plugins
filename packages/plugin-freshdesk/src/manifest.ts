import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.freshdesk",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Freshdesk",
  description: "Access Freshdesk support: list and manage tickets, contacts, agents, notes, and replies.",
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
        title: "Freshdesk API Key (secret ref)",
        description: "UUID of a Paperclip secret holding your Freshdesk API key (from Profile Settings → API Key).",
        default: "",
      },
      domain: {
        type: "string",
        title: "Freshdesk subdomain",
        description: "Your Freshdesk subdomain — the part before .freshdesk.com (e.g. 'mycompany').",
        default: "",
      },
    },
    required: ["apiKeyRef", "domain"],
  },
  tools: [
    {
      name: "freshdesk_list_tickets",
      displayName: "List Tickets",
      description: "List Freshdesk support tickets with optional status and priority filters.",
      parametersSchema: {
        type: "object",
        properties: {
          status: { type: "integer", description: "Filter by status: 2=Open, 3=Pending, 4=Resolved, 5=Closed." },
          priority: { type: "integer", description: "Filter by priority: 1=Low, 2=Medium, 3=High, 4=Urgent." },
          limit: { type: "integer", description: "Max results per page (default 30).", default: 30 },
          page: { type: "integer", description: "Page number (default 1).", default: 1 },
        },
      },
    },
    {
      name: "freshdesk_get_ticket",
      displayName: "Get Ticket",
      description: "Get full details for a Freshdesk ticket including all conversation threads.",
      parametersSchema: {
        type: "object",
        properties: {
          id: { type: "integer", description: "Freshdesk ticket ID." },
        },
        required: ["id"],
      },
    },
    {
      name: "freshdesk_create_ticket",
      displayName: "Create Ticket",
      description: "Create a new Freshdesk support ticket.",
      parametersSchema: {
        type: "object",
        properties: {
          subject: { type: "string", description: "Ticket subject." },
          description: { type: "string", description: "Ticket description (HTML supported)." },
          email: { type: "string", description: "Requester email address." },
          priority: { type: "integer", description: "Priority: 1=Low, 2=Medium, 3=High, 4=Urgent (default 1).", default: 1 },
          status: { type: "integer", description: "Status: 2=Open, 3=Pending, 4=Resolved, 5=Closed (default 2).", default: 2 },
          type: { type: "string", description: "Ticket type (e.g. 'Question', 'Incident', 'Problem', 'Feature Request')." },
          tags: { type: "array", items: { type: "string" }, description: "Tags to apply." },
        },
        required: ["subject", "description", "email"],
      },
    },
    {
      name: "freshdesk_update_ticket",
      displayName: "Update Ticket",
      description: "Update fields on an existing Freshdesk ticket (status, priority, assignee, tags, etc.).",
      parametersSchema: {
        type: "object",
        properties: {
          id: { type: "integer", description: "Freshdesk ticket ID." },
          subject: { type: "string", description: "New subject." },
          priority: { type: "integer", description: "New priority: 1=Low, 2=Medium, 3=High, 4=Urgent." },
          status: { type: "integer", description: "New status: 2=Open, 3=Pending, 4=Resolved, 5=Closed." },
          type: { type: "string", description: "New ticket type." },
          tags: { type: "array", items: { type: "string" }, description: "Replace tags." },
          assignee_id: { type: "integer", description: "Agent ID to assign to." },
        },
        required: ["id"],
      },
    },
    {
      name: "freshdesk_list_contacts",
      displayName: "List Contacts",
      description: "List or search Freshdesk contacts by name, email, or phone.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term to filter contacts by name, email, or phone." },
          limit: { type: "integer", description: "Max results per page (default 30).", default: 30 },
          page: { type: "integer", description: "Page number (default 1).", default: 1 },
        },
      },
    },
    {
      name: "freshdesk_get_contact",
      displayName: "Get Contact",
      description: "Get details for a specific Freshdesk contact by ID.",
      parametersSchema: {
        type: "object",
        properties: {
          id: { type: "integer", description: "Freshdesk contact ID." },
        },
        required: ["id"],
      },
    },
    {
      name: "freshdesk_create_contact",
      displayName: "Create Contact",
      description: "Create a new contact in Freshdesk.",
      parametersSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Contact full name." },
          email: { type: "string", description: "Contact email address." },
          phone: { type: "string", description: "Contact phone number." },
          company_id: { type: "integer", description: "Freshdesk company ID to associate with." },
          tags: { type: "array", items: { type: "string" }, description: "Tags to apply." },
        },
        required: ["name"],
      },
    },
    {
      name: "freshdesk_list_agents",
      displayName: "List Agents",
      description: "List all support agents in the Freshdesk account.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Max results (default 50).", default: 50 },
        },
      },
    },
    {
      name: "freshdesk_add_note",
      displayName: "Add Note",
      description: "Add an internal note to a Freshdesk ticket (private by default).",
      parametersSchema: {
        type: "object",
        properties: {
          ticket_id: { type: "integer", description: "Freshdesk ticket ID." },
          body: { type: "string", description: "Note body (HTML supported)." },
          private: { type: "boolean", description: "Whether the note is private/internal (default true).", default: true },
          agent_id: { type: "integer", description: "Agent ID to attribute the note to." },
        },
        required: ["ticket_id", "body"],
      },
    },
    {
      name: "freshdesk_reply_to_ticket",
      displayName: "Reply to Ticket",
      description: "Send a public reply to a Freshdesk ticket (visible to the requester).",
      parametersSchema: {
        type: "object",
        properties: {
          ticket_id: { type: "integer", description: "Freshdesk ticket ID." },
          body: { type: "string", description: "Reply body (HTML supported)." },
          from_email: { type: "string", description: "From email address (must be a verified Freshdesk email)." },
          cc_emails: { type: "array", items: { type: "string" }, description: "CC recipients." },
        },
        required: ["ticket_id", "body"],
      },
    },
  ],
};

export default manifest;
