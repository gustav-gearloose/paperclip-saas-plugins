import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { GoogleCalendarClient } from "./calendar-client.js";

interface CalendarPluginConfig {
  serviceAccountKeyRef?: string;
  calendarId?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as CalendarPluginConfig;
    const { serviceAccountKeyRef } = config;
    const defaultCalendarId = config.calendarId || "primary";

    if (!serviceAccountKeyRef) {
      ctx.logger.error("google-calendar plugin: serviceAccountKeyRef is required");
      return;
    }

    let serviceAccountJson: string;
    try {
      serviceAccountJson = await ctx.secrets.resolve(serviceAccountKeyRef);
    } catch (err) {
      ctx.logger.error(`google-calendar plugin: failed to resolve secret: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    let client: GoogleCalendarClient;
    try {
      client = new GoogleCalendarClient(serviceAccountJson);
    } catch (err) {
      ctx.logger.error(`google-calendar plugin: invalid service account JSON: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    ctx.logger.info("google-calendar plugin: registering tools");

    ctx.tools.register(
      "calendar_list_calendars",
      {
        displayName: "List Calendars",
        description: "List all calendars the service account has access to.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const data = await client.listCalendars();
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "calendar_list_events",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const calId = (p.calendar_id as string) || defaultCalendarId;
          const data = await client.listEvents(calId, {
            timeMin: p.time_min as string | undefined,
            timeMax: p.time_max as string | undefined,
            maxResults: p.max_results as number | undefined,
            q: p.q as string | undefined,
            orderBy: "startTime",
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "calendar_get_event",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const calId = (p.calendar_id as string) || defaultCalendarId;
          const data = await client.getEvent(calId, p.event_id as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "calendar_create_event",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const calId = (p.calendar_id as string) || defaultCalendarId;
          const tz = (p.timezone as string) || "UTC";
          const event: Record<string, unknown> = {
            summary: p.summary,
            start: { dateTime: p.start, timeZone: tz },
            end: { dateTime: p.end, timeZone: tz },
          };
          if (p.description) event.description = p.description;
          if (p.location) event.location = p.location;
          if (Array.isArray(p.attendees)) {
            event.attendees = (p.attendees as string[]).map(email => ({ email }));
          }
          const data = await client.createEvent(calId, event);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "calendar_update_event",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const calId = (p.calendar_id as string) || defaultCalendarId;
          const patch: Record<string, unknown> = {};
          if (p.summary) patch.summary = p.summary;
          if (p.description) patch.description = p.description;
          if (p.location) patch.location = p.location;
          if (p.start) patch.start = { dateTime: p.start };
          if (p.end) patch.end = { dateTime: p.end };
          const data = await client.updateEvent(calId, p.event_id as string, patch);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "calendar_delete_event",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const calId = (p.calendar_id as string) || defaultCalendarId;
          await client.deleteEvent(calId, p.event_id as string);
          return { content: JSON.stringify({ deleted: true, eventId: p.event_id }) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "calendar_find_free_slots",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const calIds = Array.isArray(p.calendar_ids) && (p.calendar_ids as string[]).length > 0
            ? p.calendar_ids as string[]
            : [defaultCalendarId];
          const data = await client.findFreeSlots(calIds, p.time_min as string, p.time_max as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
