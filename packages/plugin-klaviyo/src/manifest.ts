import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.klaviyo",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Klaviyo",
  description: "Klaviyo — manage profiles, lists, segments, campaigns, flows, and track events for email/SMS marketing.",
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
        description: "UUID of a Paperclip secret holding your Klaviyo private API key.",
        default: "",
      },
    },
    required: ["apiKeyRef"],
  },
  tools: [
    {
      name: "klaviyo_list_profiles",
      displayName: "List Profiles",
      description: "List Klaviyo profiles with optional filter.",
      parametersSchema: {
        type: "object",
        properties: {
          page_size: { type: "integer", description: "Results per page (max 100).", default: 20 },
          page_cursor: { type: "string", description: "Pagination cursor from previous response." },
          filter: { type: "string", description: "Filter string, e.g. equals(email,'test@example.com')." },
        },
      },
    },
    {
      name: "klaviyo_get_profile",
      displayName: "Get Profile",
      description: "Get a specific Klaviyo profile by ID.",
      parametersSchema: {
        type: "object",
        properties: {
          profile_id: { type: "string", description: "Klaviyo profile ID." },
        },
        required: ["profile_id"],
      },
    },
    {
      name: "klaviyo_create_profile",
      displayName: "Create Profile",
      description: "Create a new Klaviyo profile.",
      parametersSchema: {
        type: "object",
        properties: {
          email: { type: "string", description: "Profile email address." },
          phone_number: { type: "string", description: "Phone number in E.164 format." },
          first_name: { type: "string", description: "First name." },
          last_name: { type: "string", description: "Last name." },
          properties: { type: "object", description: "Custom profile properties.", additionalProperties: true },
        },
      },
    },
    {
      name: "klaviyo_update_profile",
      displayName: "Update Profile",
      description: "Update an existing Klaviyo profile.",
      parametersSchema: {
        type: "object",
        properties: {
          profile_id: { type: "string", description: "Klaviyo profile ID." },
          email: { type: "string", description: "New email address." },
          phone_number: { type: "string", description: "New phone number." },
          first_name: { type: "string", description: "First name." },
          last_name: { type: "string", description: "Last name." },
          properties: { type: "object", description: "Custom properties to update.", additionalProperties: true },
        },
        required: ["profile_id"],
      },
    },
    {
      name: "klaviyo_list_lists",
      displayName: "List Lists",
      description: "List all Klaviyo lists.",
      parametersSchema: {
        type: "object",
        properties: {
          page_size: { type: "integer", description: "Results per page.", default: 20 },
          page_cursor: { type: "string", description: "Pagination cursor." },
        },
      },
    },
    {
      name: "klaviyo_get_list",
      displayName: "Get List",
      description: "Get details of a specific Klaviyo list.",
      parametersSchema: {
        type: "object",
        properties: {
          list_id: { type: "string", description: "Klaviyo list ID." },
        },
        required: ["list_id"],
      },
    },
    {
      name: "klaviyo_create_list",
      displayName: "Create List",
      description: "Create a new Klaviyo list.",
      parametersSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the new list." },
        },
        required: ["name"],
      },
    },
    {
      name: "klaviyo_add_profiles_to_list",
      displayName: "Add Profiles to List",
      description: "Add one or more profiles to a Klaviyo list by profile ID.",
      parametersSchema: {
        type: "object",
        properties: {
          list_id: { type: "string", description: "Klaviyo list ID." },
          profile_ids: { type: "array", items: { type: "string" }, description: "Profile IDs to add." },
        },
        required: ["list_id", "profile_ids"],
      },
    },
    {
      name: "klaviyo_remove_profiles_from_list",
      displayName: "Remove Profiles from List",
      description: "Remove one or more profiles from a Klaviyo list.",
      parametersSchema: {
        type: "object",
        properties: {
          list_id: { type: "string", description: "Klaviyo list ID." },
          profile_ids: { type: "array", items: { type: "string" }, description: "Profile IDs to remove." },
        },
        required: ["list_id", "profile_ids"],
      },
    },
    {
      name: "klaviyo_list_campaigns",
      displayName: "List Campaigns",
      description: "List Klaviyo email campaigns.",
      parametersSchema: {
        type: "object",
        properties: {
          page_size: { type: "integer", description: "Results per page.", default: 20 },
          page_cursor: { type: "string", description: "Pagination cursor." },
          sort: { type: "string", description: "Sort field, e.g. -created_at." },
        },
      },
    },
    {
      name: "klaviyo_get_campaign",
      displayName: "Get Campaign",
      description: "Get details of a specific Klaviyo campaign.",
      parametersSchema: {
        type: "object",
        properties: {
          campaign_id: { type: "string", description: "Klaviyo campaign ID." },
        },
        required: ["campaign_id"],
      },
    },
    {
      name: "klaviyo_list_flows",
      displayName: "List Flows",
      description: "List Klaviyo automation flows.",
      parametersSchema: {
        type: "object",
        properties: {
          page_size: { type: "integer", description: "Results per page.", default: 20 },
          page_cursor: { type: "string", description: "Pagination cursor." },
          filter: { type: "string", description: "Filter string." },
        },
      },
    },
    {
      name: "klaviyo_list_segments",
      displayName: "List Segments",
      description: "List Klaviyo segments.",
      parametersSchema: {
        type: "object",
        properties: {
          page_size: { type: "integer", description: "Results per page.", default: 20 },
          page_cursor: { type: "string", description: "Pagination cursor." },
        },
      },
    },
    {
      name: "klaviyo_list_metrics",
      displayName: "List Metrics",
      description: "List all Klaviyo metrics (event types).",
      parametersSchema: {
        type: "object",
        properties: {
          page_size: { type: "integer", description: "Results per page.", default: 50 },
          page_cursor: { type: "string", description: "Pagination cursor." },
        },
      },
    },
    {
      name: "klaviyo_create_event",
      displayName: "Track Event",
      description: "Track a custom event for a Klaviyo profile (triggers flows and updates segments).",
      parametersSchema: {
        type: "object",
        properties: {
          event_name: { type: "string", description: "Name of the event (metric name)." },
          profile_email: { type: "string", description: "Email to identify the profile." },
          profile_id: { type: "string", description: "Klaviyo profile ID (alternative to email)." },
          properties: { type: "object", description: "Event properties.", additionalProperties: true },
          time: { type: "string", description: "ISO 8601 timestamp of the event." },
        },
        required: ["event_name"],
      },
    },
    {
      name: "klaviyo_list_templates",
      displayName: "List Templates",
      description: "List Klaviyo email templates.",
      parametersSchema: {
        type: "object",
        properties: {
          page_size: { type: "integer", description: "Results per page.", default: 20 },
          page_cursor: { type: "string", description: "Pagination cursor." },
        },
      },
    },
  ],
};

export default manifest;
