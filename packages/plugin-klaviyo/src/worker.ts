import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { KlaviyoClient } from "./klaviyo-client.js";

interface KlaviyoPluginConfig {
  apiKeyRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as KlaviyoPluginConfig;

    if (!config.apiKeyRef) {
      ctx.logger.error("Klaviyo plugin: apiKeyRef is required");
      return;
    }

    let apiKey: string;
    try {
      apiKey = await ctx.secrets.resolve(config.apiKeyRef);
    } catch (err) {
      ctx.logger.error(`Klaviyo plugin: failed to resolve apiKeyRef: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    const client = new KlaviyoClient(apiKey);
    ctx.logger.info("Klaviyo plugin: client initialized, registering tools");

    ctx.tools.register(
      "klaviyo_list_profiles",
      {
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
      async (params): Promise<ToolResult> => {
        const { page_size, page_cursor, filter } = params as { page_size?: number; page_cursor?: string; filter?: string };
        try {
          const result = await client.getProfiles({ "page[size]": page_size, "page[cursor]": page_cursor, filter });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "klaviyo_get_profile",
      {
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
      async (params): Promise<ToolResult> => {
        const { profile_id } = params as { profile_id: string };
        try {
          const result = await client.getProfile(profile_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "klaviyo_create_profile",
      {
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
      async (params): Promise<ToolResult> => {
        const { email, phone_number, first_name, last_name, properties } = params as {
          email?: string; phone_number?: string; first_name?: string; last_name?: string;
          properties?: Record<string, unknown>;
        };
        try {
          const result = await client.createProfile({ email, phone_number, first_name, last_name, properties });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "klaviyo_update_profile",
      {
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
      async (params): Promise<ToolResult> => {
        const { profile_id, email, phone_number, first_name, last_name, properties } = params as {
          profile_id: string; email?: string; phone_number?: string;
          first_name?: string; last_name?: string; properties?: Record<string, unknown>;
        };
        try {
          const result = await client.updateProfile(profile_id, { email, phone_number, first_name, last_name, properties });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "klaviyo_list_lists",
      {
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
      async (params): Promise<ToolResult> => {
        const { page_size, page_cursor } = params as { page_size?: number; page_cursor?: string };
        try {
          const result = await client.getLists({ "page[size]": page_size, "page[cursor]": page_cursor });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "klaviyo_get_list",
      {
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
      async (params): Promise<ToolResult> => {
        const { list_id } = params as { list_id: string };
        try {
          const result = await client.getList(list_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "klaviyo_create_list",
      {
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
      async (params): Promise<ToolResult> => {
        const { name } = params as { name: string };
        try {
          const result = await client.createList(name);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "klaviyo_add_profiles_to_list",
      {
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
      async (params): Promise<ToolResult> => {
        const { list_id, profile_ids } = params as { list_id: string; profile_ids: string[] };
        try {
          const result = await client.addProfilesToList(list_id, profile_ids);
          return { content: JSON.stringify(result ?? { added: true }, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "klaviyo_remove_profiles_from_list",
      {
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
      async (params): Promise<ToolResult> => {
        const { list_id, profile_ids } = params as { list_id: string; profile_ids: string[] };
        try {
          const result = await client.removeProfilesFromList(list_id, profile_ids);
          return { content: JSON.stringify(result ?? { removed: true }, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "klaviyo_list_campaigns",
      {
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
      async (params): Promise<ToolResult> => {
        const { page_size, page_cursor, sort } = params as { page_size?: number; page_cursor?: string; sort?: string };
        try {
          const result = await client.getCampaigns({ "page[size]": page_size, "page[cursor]": page_cursor, sort });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "klaviyo_get_campaign",
      {
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
      async (params): Promise<ToolResult> => {
        const { campaign_id } = params as { campaign_id: string };
        try {
          const result = await client.getCampaign(campaign_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "klaviyo_list_flows",
      {
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
      async (params): Promise<ToolResult> => {
        const { page_size, page_cursor, filter } = params as { page_size?: number; page_cursor?: string; filter?: string };
        try {
          const result = await client.getFlows({ "page[size]": page_size, "page[cursor]": page_cursor, filter });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "klaviyo_list_segments",
      {
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
      async (params): Promise<ToolResult> => {
        const { page_size, page_cursor } = params as { page_size?: number; page_cursor?: string };
        try {
          const result = await client.getSegments({ "page[size]": page_size, "page[cursor]": page_cursor });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "klaviyo_list_metrics",
      {
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
      async (params): Promise<ToolResult> => {
        const { page_size, page_cursor } = params as { page_size?: number; page_cursor?: string };
        try {
          const result = await client.getMetrics({ "page[size]": page_size, "page[cursor]": page_cursor });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "klaviyo_create_event",
      {
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
      async (params): Promise<ToolResult> => {
        const { event_name, profile_email, profile_id, properties, time } = params as {
          event_name: string; profile_email?: string; profile_id?: string;
          properties?: Record<string, unknown>; time?: string;
        };
        try {
          const result = await client.createEvent({ event_name, profile_email, profile_id, properties, time });
          return { content: JSON.stringify(result ?? { tracked: true }, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "klaviyo_list_templates",
      {
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
      async (params): Promise<ToolResult> => {
        const { page_size, page_cursor } = params as { page_size?: number; page_cursor?: string };
        try {
          const result = await client.getTemplates({ "page[size]": page_size, "page[cursor]": page_cursor });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Klaviyo plugin: all tools registered");
  },
});

runWorker(plugin, import.meta.url);
