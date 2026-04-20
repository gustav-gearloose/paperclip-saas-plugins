import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.calendly",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Calendly",
  description: "Calendly scheduling — list event types, scheduled meetings, invitees, and cancel events.",
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
        title: "Personal Access Token (secret ref)",
        description: "UUID of a Paperclip secret holding your Calendly personal access token.",
        default: "",
      },
    },
    required: ["apiTokenRef"],
  },
  tools: [
    {
      name: "calendly_get_current_user",
      displayName: "Get Current User",
      description: "Get the authenticated Calendly user and their organization URI.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "calendly_list_event_types",
      displayName: "List Event Types",
      description: "List all Calendly event types (meeting templates) for the organization.",
      parametersSchema: {
        type: "object",
        properties: {
          active: { type: "boolean", description: "Filter by active status." },
          count: { type: "integer", description: "Number of results (max 100, default 20).", default: 20 },
          page_token: { type: "string", description: "Pagination token for next page." },
        },
      },
    },
    {
      name: "calendly_list_scheduled_events",
      displayName: "List Scheduled Events",
      description: "List scheduled Calendly meetings, optionally filtered by date range, status, or invitee email.",
      parametersSchema: {
        type: "object",
        properties: {
          count: { type: "integer", description: "Number of results (max 100, default 20).", default: 20 },
          page_token: { type: "string", description: "Pagination token for next page." },
          min_start_time: { type: "string", description: "Filter events starting after this ISO 8601 datetime." },
          max_start_time: { type: "string", description: "Filter events starting before this ISO 8601 datetime." },
          status: { type: "string", description: "Filter by status: active or canceled." },
          invitee_email: { type: "string", description: "Filter by invitee email address." },
          sort: { type: "string", description: "Sort order: start_time:asc or start_time:desc." },
        },
      },
    },
    {
      name: "calendly_get_scheduled_event",
      displayName: "Get Scheduled Event",
      description: "Get details of a specific scheduled Calendly event by URI.",
      parametersSchema: {
        type: "object",
        properties: {
          event_uri: { type: "string", description: "Full Calendly event URI (e.g. https://api.calendly.com/scheduled_events/UUID)." },
        },
        required: ["event_uri"],
      },
    },
    {
      name: "calendly_list_event_invitees",
      displayName: "List Event Invitees",
      description: "List invitees for a specific scheduled Calendly event.",
      parametersSchema: {
        type: "object",
        properties: {
          event_uri: { type: "string", description: "Full Calendly event URI." },
          count: { type: "integer", description: "Number of results (max 100, default 20).", default: 20 },
          page_token: { type: "string", description: "Pagination token." },
          status: { type: "string", description: "Filter by status: active or canceled." },
          email: { type: "string", description: "Filter by invitee email." },
        },
        required: ["event_uri"],
      },
    },
    {
      name: "calendly_cancel_event",
      displayName: "Cancel Event",
      description: "Cancel a scheduled Calendly event.",
      parametersSchema: {
        type: "object",
        properties: {
          event_uri: { type: "string", description: "Full Calendly event URI to cancel." },
          reason: { type: "string", description: "Cancellation reason (optional)." },
        },
        required: ["event_uri"],
      },
    },
    {
      name: "calendly_list_organization_invitations",
      displayName: "List Organization Invitations",
      description: "List pending invitations to join the Calendly organization.",
      parametersSchema: {
        type: "object",
        properties: {
          count: { type: "integer", description: "Number of results (max 100, default 20).", default: 20 },
          page_token: { type: "string", description: "Pagination token." },
          status: { type: "string", description: "Filter by status: pending or accepted." },
          email: { type: "string", description: "Filter by invitee email." },
        },
      },
    },
  ],
};

export default manifest;
