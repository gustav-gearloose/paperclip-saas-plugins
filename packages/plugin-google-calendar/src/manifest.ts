import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.google-calendar",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Google Calendar",
  description: "Read and manage Google Calendar events. List, create, update, and delete events; check free/busy slots.",
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
      serviceAccountKeyRef: {
        type: "string",
        format: "secret-ref",
        title: "Service Account JSON (secret ref)",
        description: "UUID of a Paperclip secret holding the Google service account JSON key file contents.",
        default: "",
      },
      calendarId: {
        type: "string",
        title: "Default Calendar ID",
        description: "The calendar ID to operate on by default. Use 'primary' for the service account's primary calendar, or a full calendar email address.",
        default: "primary",
      },
    },
    required: ["serviceAccountKeyRef"],
  },
  tools: [
    {
      name: "calendar_list_calendars",
      displayName: "List Calendars",
      description: "List all calendars the service account has access to.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "calendar_list_events",
      displayName: "List Events",
      description: "List calendar events, optionally filtered by time range or search query.",
      parametersSchema: {
        type: "object",
        properties: {
          calendar_id: { type: "string", description: "Calendar ID to query (default: plugin's configured calendar)." },
          time_min: { type: "string", description: "Start of time range in ISO 8601 format, e.g. 2024-01-01T00:00:00Z." },
          time_max: { type: "string", description: "End of time range in ISO 8601 format." },
          max_results: { type: "number", description: "Maximum number of events to return (default: 25)." },
          q: { type: "string", description: "Free text search query to filter events." },
        },
      },
    },
    {
      name: "calendar_get_event",
      displayName: "Get Event",
      description: "Get a single calendar event by ID.",
      parametersSchema: {
        type: "object",
        required: ["event_id"],
        properties: {
          calendar_id: { type: "string", description: "Calendar ID (default: plugin's configured calendar)." },
          event_id: { type: "string", description: "The event ID." },
        },
      },
    },
    {
      name: "calendar_create_event",
      displayName: "Create Event",
      description: "Create a new calendar event.",
      parametersSchema: {
        type: "object",
        required: ["summary", "start", "end"],
        properties: {
          calendar_id: { type: "string", description: "Calendar ID (default: plugin's configured calendar)." },
          summary: { type: "string", description: "Event title." },
          description: { type: "string", description: "Event description or notes." },
          location: { type: "string", description: "Event location." },
          start: { type: "string", description: "Event start time in ISO 8601 format, e.g. 2024-06-15T10:00:00+02:00." },
          end: { type: "string", description: "Event end time in ISO 8601 format." },
          attendees: {
            type: "array",
            description: "List of attendee email addresses.",
            items: { type: "string" },
          },
          timezone: { type: "string", description: "IANA timezone name, e.g. Europe/Copenhagen (default: UTC)." },
        },
      },
    },
    {
      name: "calendar_update_event",
      displayName: "Update Event",
      description: "Update fields on an existing calendar event.",
      parametersSchema: {
        type: "object",
        required: ["event_id"],
        properties: {
          calendar_id: { type: "string", description: "Calendar ID (default: plugin's configured calendar)." },
          event_id: { type: "string", description: "The event ID to update." },
          summary: { type: "string", description: "New event title." },
          description: { type: "string", description: "New event description." },
          location: { type: "string", description: "New event location." },
          start: { type: "string", description: "New start time in ISO 8601 format." },
          end: { type: "string", description: "New end time in ISO 8601 format." },
        },
      },
    },
    {
      name: "calendar_delete_event",
      displayName: "Delete Event",
      description: "Delete a calendar event permanently.",
      parametersSchema: {
        type: "object",
        required: ["event_id"],
        properties: {
          calendar_id: { type: "string", description: "Calendar ID (default: plugin's configured calendar)." },
          event_id: { type: "string", description: "The event ID to delete." },
        },
      },
    },
    {
      name: "calendar_find_free_slots",
      displayName: "Find Free Slots",
      description: "Check free/busy status for one or more calendars in a time range to find available meeting slots.",
      parametersSchema: {
        type: "object",
        required: ["time_min", "time_max"],
        properties: {
          time_min: { type: "string", description: "Start of range in ISO 8601 format." },
          time_max: { type: "string", description: "End of range in ISO 8601 format." },
          calendar_ids: {
            type: "array",
            description: "Calendar IDs to check (default: [plugin's configured calendar]).",
            items: { type: "string" },
          },
        },
      },
    },
  ],
};

export default manifest;
