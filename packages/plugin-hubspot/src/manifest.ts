import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.hubspot",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "HubSpot CRM",
  description: "Access HubSpot CRM: search contacts, companies, and deals; view notes; create notes linked to CRM records.",
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
        title: "Private App Access Token (secret ref)",
        description:
          "UUID of a Paperclip secret holding your HubSpot Private App access token (from HubSpot → Settings → Integrations → Private Apps).",
        default: "",
      },
    },
    required: ["accessTokenRef"],
  },
  tools: [
    {
      name: "hubspot_search_contacts",
      displayName: "Search Contacts",
      description: "Search HubSpot contacts by name, email, or free-text query.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text search across contact properties." },
          email: { type: "string", description: "Find contact by exact email address." },
          limit: { type: "integer", description: "Max results (default 20, max 200)." },
        },
      },
    },
    {
      name: "hubspot_get_contact",
      displayName: "Get Contact",
      description: "Get full details of a HubSpot contact by contact ID.",
      parametersSchema: {
        type: "object",
        required: ["contact_id"],
        properties: {
          contact_id: { type: "string", description: "HubSpot contact ID." },
        },
      },
    },
    {
      name: "hubspot_search_companies",
      displayName: "Search Companies",
      description: "Search HubSpot companies by name or free-text query.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text search across company properties." },
          name: { type: "string", description: "Filter by company name (partial match)." },
          limit: { type: "integer", description: "Max results (default 20, max 200)." },
        },
      },
    },
    {
      name: "hubspot_get_company",
      displayName: "Get Company",
      description: "Get full details of a HubSpot company by company ID.",
      parametersSchema: {
        type: "object",
        required: ["company_id"],
        properties: {
          company_id: { type: "string", description: "HubSpot company ID." },
        },
      },
    },
    {
      name: "hubspot_search_deals",
      displayName: "Search Deals",
      description: "Search HubSpot deals by name, deal stage, or free-text query.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text search across deal properties." },
          stage: { type: "string", description: "Filter by deal stage ID (e.g. 'appointmentscheduled', 'closedwon')." },
          limit: { type: "integer", description: "Max results (default 20, max 200)." },
        },
      },
    },
    {
      name: "hubspot_get_deal",
      displayName: "Get Deal",
      description: "Get full details of a HubSpot deal by deal ID.",
      parametersSchema: {
        type: "object",
        required: ["deal_id"],
        properties: {
          deal_id: { type: "string", description: "HubSpot deal ID." },
        },
      },
    },
    {
      name: "hubspot_create_note",
      displayName: "Create Note",
      description: "Create a note in HubSpot and optionally associate it with a contact, deal, or company.",
      parametersSchema: {
        type: "object",
        required: ["body"],
        properties: {
          body: { type: "string", description: "Note content (plain text or HTML)." },
          contact_id: { type: "string", description: "Contact ID to associate the note with." },
          deal_id: { type: "string", description: "Deal ID to associate the note with." },
          company_id: { type: "string", description: "Company ID to associate the note with." },
        },
      },
    },
    {
      name: "hubspot_list_recent_deals",
      displayName: "List Recent Deals",
      description: "List the most recent HubSpot deals sorted by close date.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Max results (default 20, max 100)." },
        },
      },
    },
  ],
};

export default manifest;
