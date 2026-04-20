import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.activecampaign",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "ActiveCampaign",
  description: "ActiveCampaign CRM & automation — contacts, lists, deals, tags, and automations.",
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
        description: "UUID of a Paperclip secret holding your ActiveCampaign API key.",
        default: "",
      },
      accountUrl: {
        type: "string",
        title: "Account URL",
        description: "Your ActiveCampaign account URL (e.g. https://youraccountname.api-us1.com).",
        default: "",
      },
    },
    required: ["apiKeyRef", "accountUrl"],
  },
  tools: [
    {
      name: "activecampaign_list_contacts",
      displayName: "List Contacts",
      description: "List ActiveCampaign contacts, optionally filtered by email, search query, status, list, or tag.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Number of results (default 20, max 100).", default: 20 },
          offset: { type: "integer", description: "Pagination offset.", default: 0 },
          email: { type: "string", description: "Filter by exact email address." },
          search: { type: "string", description: "Search contacts by name or email." },
          status: { type: "integer", description: "Filter by status: 1=active, 2=unsubscribed, 3=bounced." },
          listid: { type: "string", description: "Filter by list ID." },
          tagid: { type: "string", description: "Filter by tag ID." },
        },
      },
    },
    {
      name: "activecampaign_get_contact",
      displayName: "Get Contact",
      description: "Get details of a specific ActiveCampaign contact by ID.",
      parametersSchema: {
        type: "object",
        properties: {
          contact_id: { type: "string", description: "The ActiveCampaign contact ID." },
        },
        required: ["contact_id"],
      },
    },
    {
      name: "activecampaign_create_contact",
      displayName: "Create Contact",
      description: "Create a new contact in ActiveCampaign.",
      parametersSchema: {
        type: "object",
        properties: {
          email: { type: "string", description: "Contact email address." },
          firstName: { type: "string", description: "Contact first name." },
          lastName: { type: "string", description: "Contact last name." },
          phone: { type: "string", description: "Contact phone number." },
          fieldValues: {
            type: "array",
            description: "Custom field values.",
            items: {
              type: "object",
              properties: {
                field: { type: "string", description: "Field ID." },
                value: { type: "string", description: "Field value." },
              },
              required: ["field", "value"],
            },
          },
        },
        required: ["email"],
      },
    },
    {
      name: "activecampaign_update_contact",
      displayName: "Update Contact",
      description: "Update an existing ActiveCampaign contact.",
      parametersSchema: {
        type: "object",
        properties: {
          contact_id: { type: "string", description: "The ActiveCampaign contact ID." },
          email: { type: "string", description: "New email address." },
          firstName: { type: "string", description: "New first name." },
          lastName: { type: "string", description: "New last name." },
          phone: { type: "string", description: "New phone number." },
          fieldValues: {
            type: "array",
            description: "Custom field values to update.",
            items: {
              type: "object",
              properties: {
                field: { type: "string", description: "Field ID." },
                value: { type: "string", description: "Field value." },
              },
              required: ["field", "value"],
            },
          },
        },
        required: ["contact_id"],
      },
    },
    {
      name: "activecampaign_list_lists",
      displayName: "List Lists",
      description: "List all ActiveCampaign contact lists.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Number of results (default 20).", default: 20 },
          offset: { type: "integer", description: "Pagination offset.", default: 0 },
        },
      },
    },
    {
      name: "activecampaign_list_tags",
      displayName: "List Tags",
      description: "List all tags in ActiveCampaign.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Number of results (default 20).", default: 20 },
          offset: { type: "integer", description: "Pagination offset.", default: 0 },
          search: { type: "string", description: "Search tags by name." },
        },
      },
    },
    {
      name: "activecampaign_add_tag_to_contact",
      displayName: "Add Tag to Contact",
      description: "Add a tag to an ActiveCampaign contact.",
      parametersSchema: {
        type: "object",
        properties: {
          contact_id: { type: "string", description: "The ActiveCampaign contact ID." },
          tag_id: { type: "string", description: "The tag ID to add." },
        },
        required: ["contact_id", "tag_id"],
      },
    },
    {
      name: "activecampaign_list_deals",
      displayName: "List Deals",
      description: "List CRM deals in ActiveCampaign, optionally filtered by search, stage, or status.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Number of results (default 20).", default: 20 },
          offset: { type: "integer", description: "Pagination offset.", default: 0 },
          search: { type: "string", description: "Search deals by title." },
          stage: { type: "string", description: "Filter by stage ID." },
          group: { type: "string", description: "Filter by pipeline (group) ID." },
          status: { type: "integer", description: "Filter by status: 0=open, 1=won, 2=lost." },
        },
      },
    },
    {
      name: "activecampaign_get_deal",
      displayName: "Get Deal",
      description: "Get details of a specific ActiveCampaign CRM deal.",
      parametersSchema: {
        type: "object",
        properties: {
          deal_id: { type: "string", description: "The ActiveCampaign deal ID." },
        },
        required: ["deal_id"],
      },
    },
    {
      name: "activecampaign_create_deal",
      displayName: "Create Deal",
      description: "Create a new CRM deal in ActiveCampaign.",
      parametersSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Deal title." },
          contact: { type: "string", description: "Contact ID to associate with the deal." },
          value: { type: "integer", description: "Deal value in cents (e.g. 5000 = $50.00)." },
          currency: { type: "string", description: "Currency code (e.g. usd, eur, dkk).", default: "usd" },
          pipeline: { type: "string", description: "Pipeline (group) ID." },
          stage: { type: "string", description: "Stage ID within the pipeline." },
          owner: { type: "string", description: "Owner (user) ID." },
        },
        required: ["title", "contact"],
      },
    },
    {
      name: "activecampaign_list_automations",
      displayName: "List Automations",
      description: "List all automation workflows in ActiveCampaign.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Number of results (default 20).", default: 20 },
          offset: { type: "integer", description: "Pagination offset.", default: 0 },
        },
      },
    },
    {
      name: "activecampaign_add_contact_to_automation",
      displayName: "Add Contact to Automation",
      description: "Enroll a contact into an ActiveCampaign automation workflow.",
      parametersSchema: {
        type: "object",
        properties: {
          contact_id: { type: "string", description: "The ActiveCampaign contact ID." },
          automation_id: { type: "string", description: "The automation ID to enroll the contact in." },
        },
        required: ["contact_id", "automation_id"],
      },
    },
  ],
};

export default manifest;
