import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { CalendlyClient } from "./calendly-client.js";

interface CalendlyPluginConfig {
  apiTokenRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as CalendlyPluginConfig;

    if (!config.apiTokenRef) {
      ctx.logger.error("Calendly plugin: apiTokenRef is required");
      return;
    }

    let apiToken: string;
    try {
      apiToken = await ctx.secrets.resolve(config.apiTokenRef);
    } catch (err) {
      ctx.logger.error(`Calendly plugin: failed to resolve apiTokenRef: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    ctx.logger.info("Calendly plugin: secret resolved, resolving organization URI");
    const client = new CalendlyClient(apiToken);

    // Resolve organization URI once at startup — all list endpoints require it
    let organizationUri: string;
    try {
      const me = await client.getCurrentUser();
      organizationUri = me.resource.organization;
    } catch (err) {
      ctx.logger.error(`Calendly plugin: failed to resolve organization URI: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    ctx.logger.info(`Calendly plugin: organization URI resolved, registering tools`);

    ctx.tools.register(
      "calendly_get_current_user",
      {
        displayName: "Get Current User",
        description: "Get the authenticated Calendly user and their organization URI.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const result = await client.getCurrentUser();
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "calendly_list_event_types",
      {
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
      async (params): Promise<ToolResult> => {
        const { active, count, page_token } = params as { active?: boolean; count?: number; page_token?: string };
        try {
          const result = await client.listEventTypes(organizationUri, { active, count, page_token });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "calendly_list_scheduled_events",
      {
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
      async (params): Promise<ToolResult> => {
        const { count, page_token, min_start_time, max_start_time, status, invitee_email, sort } = params as {
          count?: number; page_token?: string; min_start_time?: string; max_start_time?: string;
          status?: string; invitee_email?: string; sort?: string;
        };
        try {
          const result = await client.listScheduledEvents(organizationUri, {
            count, page_token, min_start_time, max_start_time, status, invitee_email, sort,
          });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "calendly_get_scheduled_event",
      {
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
      async (params): Promise<ToolResult> => {
        const { event_uri } = params as { event_uri: string };
        try {
          const result = await client.getScheduledEvent(event_uri);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "calendly_list_event_invitees",
      {
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
      async (params): Promise<ToolResult> => {
        const { event_uri, count, page_token, status, email } = params as {
          event_uri: string; count?: number; page_token?: string; status?: string; email?: string;
        };
        try {
          const result = await client.listEventInvitees(event_uri, { count, page_token, status, email });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "calendly_cancel_event",
      {
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
      async (params): Promise<ToolResult> => {
        const { event_uri, reason } = params as { event_uri: string; reason?: string };
        try {
          const result = await client.cancelEvent(event_uri, reason);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "calendly_list_organization_invitations",
      {
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
      async (params): Promise<ToolResult> => {
        const { count, page_token, status, email } = params as {
          count?: number; page_token?: string; status?: string; email?: string;
        };
        try {
          const result = await client.listOrganizationInvitations(organizationUri, { count, page_token, status, email });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Calendly plugin: all tools registered");
  },
});

runWorker(plugin, import.meta.url);
