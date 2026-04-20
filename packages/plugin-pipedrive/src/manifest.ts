import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.pipedrive",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Pipedrive",
  description: "Manage Pipedrive CRM: deals, persons, organizations, activities, and pipeline stages.",
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
      apiTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "Pipedrive API Token (ref)",
        description: "UUID of a Paperclip secret holding your Pipedrive API token.",
        default: "",
      },
    },
    required: ["apiTokenRef"],
  },
  tools: [
    {
      name: "pipedrive_search_deals",
      displayName: "Search Deals",
      description: "Search deals in Pipedrive by title, status, or pipeline.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term (matches deal title)." },
          status: { type: "string", enum: ["open", "won", "lost", "deleted", "all_not_deleted"], description: "Deal status filter." },
          pipeline_id: { type: "integer", description: "Filter by pipeline ID." },
          stage_id: { type: "integer", description: "Filter by stage ID." },
          limit: { type: "integer", description: "Max results (default 50).", default: 50 },
        },
      },
    },
    {
      name: "pipedrive_get_deal",
      displayName: "Get Deal",
      description: "Get full details for a specific Pipedrive deal by ID.",
      parametersSchema: {
        type: "object",
        properties: {
          deal_id: { type: "integer", description: "Pipedrive deal ID." },
        },
        required: ["deal_id"],
      },
    },
    {
      name: "pipedrive_create_deal",
      displayName: "Create Deal",
      description: "Create a new deal in Pipedrive.",
      parametersSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Deal title (required)." },
          value: { type: "number", description: "Deal value." },
          currency: { type: "string", description: "Currency code (e.g. DKK, EUR, SEK).", default: "DKK" },
          person_id: { type: "integer", description: "Associated person ID." },
          org_id: { type: "integer", description: "Associated organization ID." },
          pipeline_id: { type: "integer", description: "Pipeline ID." },
          stage_id: { type: "integer", description: "Stage ID within the pipeline." },
          expected_close_date: { type: "string", description: "Expected close date (YYYY-MM-DD)." },
        },
        required: ["title"],
      },
    },
    {
      name: "pipedrive_update_deal",
      displayName: "Update Deal",
      description: "Update deal status, stage, value, or other fields.",
      parametersSchema: {
        type: "object",
        properties: {
          deal_id: { type: "integer", description: "Deal ID to update." },
          title: { type: "string", description: "New title." },
          status: { type: "string", enum: ["open", "won", "lost"], description: "New status." },
          value: { type: "number", description: "New deal value." },
          stage_id: { type: "integer", description: "Move to stage ID." },
          expected_close_date: { type: "string", description: "New expected close date (YYYY-MM-DD)." },
        },
        required: ["deal_id"],
      },
    },
    {
      name: "pipedrive_search_persons",
      displayName: "Search Persons",
      description: "Search persons (contacts) in Pipedrive by name or email.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term (name or email)." },
          limit: { type: "integer", description: "Max results (default 50).", default: 50 },
        },
      },
    },
    {
      name: "pipedrive_create_person",
      displayName: "Create Person",
      description: "Create a new person (contact) in Pipedrive.",
      parametersSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Full name (required)." },
          email: { type: "string", description: "Email address." },
          phone: { type: "string", description: "Phone number." },
          org_id: { type: "integer", description: "Associated organization ID." },
        },
        required: ["name"],
      },
    },
    {
      name: "pipedrive_search_organizations",
      displayName: "Search Organizations",
      description: "Search organizations (companies) in Pipedrive by name.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Organization name search term." },
          limit: { type: "integer", description: "Max results (default 50).", default: 50 },
        },
      },
    },
    {
      name: "pipedrive_create_organization",
      displayName: "Create Organization",
      description: "Create a new organization (company) in Pipedrive.",
      parametersSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Organization name (required)." },
          address: { type: "string", description: "Street address." },
        },
        required: ["name"],
      },
    },
    {
      name: "pipedrive_list_activities",
      displayName: "List Activities",
      description: "List activities (calls, meetings, tasks) in Pipedrive.",
      parametersSchema: {
        type: "object",
        properties: {
          deal_id: { type: "integer", description: "Filter by deal ID." },
          person_id: { type: "integer", description: "Filter by person ID." },
          done: { type: "boolean", description: "Filter by completion status." },
          limit: { type: "integer", description: "Max results (default 50).", default: 50 },
        },
      },
    },
    {
      name: "pipedrive_create_activity",
      displayName: "Create Activity",
      description: "Create a new activity (call, meeting, task, etc.) in Pipedrive.",
      parametersSchema: {
        type: "object",
        properties: {
          subject: { type: "string", description: "Activity subject/title (required)." },
          type: { type: "string", description: "Activity type: call, meeting, task, deadline, email, lunch (required)." },
          due_date: { type: "string", description: "Due date (YYYY-MM-DD)." },
          due_time: { type: "string", description: "Due time (HH:MM)." },
          deal_id: { type: "integer", description: "Link to deal ID." },
          person_id: { type: "integer", description: "Link to person ID." },
          note: { type: "string", description: "Activity notes." },
        },
        required: ["subject", "type"],
      },
    },
    {
      name: "pipedrive_list_pipelines",
      displayName: "List Pipelines",
      description: "List all sales pipelines and their stages in Pipedrive.",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
  ],
};

export default manifest;
