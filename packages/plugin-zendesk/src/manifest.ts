import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.zendesk",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Zendesk",
  description: "Access Zendesk Support: tickets, comments, users, and groups.",
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
      subdomain: {
        type: "string",
        title: "Zendesk Subdomain",
        description: "Your Zendesk subdomain (e.g. 'mycompany' for mycompany.zendesk.com).",
        default: "",
      },
      email: {
        type: "string",
        title: "Agent Email",
        description: "Email address of the Zendesk agent used for API access.",
        default: "",
      },
      apiTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "Zendesk API Token (secret ref)",
        description:
          "UUID of a Paperclip secret holding your Zendesk API token (from Admin → Apps & Integrations → Zendesk API).",
        default: "",
      },
    },
    required: ["subdomain", "email", "apiTokenRef"],
  },
  tools: [
    {
      name: "zendesk_list_tickets",
      displayName: "List Tickets",
      description: "List Zendesk support tickets, optionally filtered by status.",
      parametersSchema: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["new", "open", "pending", "hold", "solved", "closed"],
            description: "Filter by ticket status.",
          },
          page_size: { type: "integer", description: "Results per page (max 100, default 50)." },
        },
      },
    },
    {
      name: "zendesk_get_ticket",
      displayName: "Get Ticket",
      description: "Get full details of a specific Zendesk ticket.",
      parametersSchema: {
        type: "object",
        required: ["ticket_id"],
        properties: {
          ticket_id: { type: "integer", description: "The Zendesk ticket ID." },
        },
      },
    },
    {
      name: "zendesk_get_ticket_comments",
      displayName: "Get Ticket Comments",
      description: "Get all comments/replies on a Zendesk ticket.",
      parametersSchema: {
        type: "object",
        required: ["ticket_id"],
        properties: {
          ticket_id: { type: "integer", description: "The Zendesk ticket ID." },
        },
      },
    },
    {
      name: "zendesk_search_tickets",
      displayName: "Search Tickets",
      description: "Search Zendesk tickets using Zendesk search syntax.",
      parametersSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string", description: "Search query (e.g. 'status:open assignee:me tags:billing')." },
          page_size: { type: "integer", description: "Results per page (default 25)." },
        },
      },
    },
    {
      name: "zendesk_create_ticket",
      displayName: "Create Ticket",
      description: "Create a new Zendesk support ticket.",
      parametersSchema: {
        type: "object",
        required: ["subject", "body"],
        properties: {
          subject: { type: "string", description: "Ticket subject line." },
          body: { type: "string", description: "Ticket description / first comment body." },
          requester_name: { type: "string", description: "Name of the requester." },
          requester_email: { type: "string", description: "Email of the requester." },
          priority: {
            type: "string",
            enum: ["low", "normal", "high", "urgent"],
            description: "Ticket priority (default: normal).",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Tags to apply to the ticket.",
          },
        },
      },
    },
    {
      name: "zendesk_list_users",
      displayName: "List Users",
      description: "List Zendesk users (agents and end-users).",
      parametersSchema: {
        type: "object",
        properties: {
          role: {
            type: "string",
            enum: ["end-user", "agent", "admin"],
            description: "Filter by user role.",
          },
          page_size: { type: "integer", description: "Results per page (default 50)." },
        },
      },
    },
    {
      name: "zendesk_search_users",
      displayName: "Search Users",
      description: "Search for Zendesk users by name or email.",
      parametersSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string", description: "Search query (name or email)." },
        },
      },
    },
    {
      name: "zendesk_list_groups",
      displayName: "List Groups",
      description: "List all Zendesk agent groups.",
      parametersSchema: { type: "object", properties: {} },
    },
  ],
};

export default manifest;
