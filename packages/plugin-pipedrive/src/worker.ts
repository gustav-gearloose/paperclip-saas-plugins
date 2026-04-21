import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { PipedriveClient } from "./pipedrive-client.js";

interface PipedrivePluginConfig {
  apiTokenRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    let cachedClient: PipedriveClient | null = null;
    let configError: string | null = null;

    async function getClient(): Promise<PipedriveClient | null> {
      if (cachedClient) return cachedClient;
      if (configError) return null;

const config = await ctx.config.get() as PipedrivePluginConfig;

      if (!config.apiTokenRef) {
        configError = "Pipedrive plugin: apiTokenRef is required";
        ctx.logger.warn("config missing");
        return null;
      }

      let apiToken: string;
      try {
        apiToken = await ctx.secrets.resolve(config.apiTokenRef);
      } catch (err) {
        configError = `Pipedrive plugin: failed to resolve apiTokenRef: ${err instanceof Error ? err.message : String(err)}`;
        ctx.logger.warn("config missing");
        return null;
      }

      ctx.logger.info("Pipedrive plugin: secret resolved, registering tools");
      cachedClient = new PipedriveClient(apiToken);
      return cachedClient;
    }

    ctx.tools.register(
      "pipedrive_search_deals",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const deals = await client.searchDeals(params as Parameters<typeof client.searchDeals>[0]);
          return { content: JSON.stringify(deals, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "pipedrive_get_deal",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { deal_id: number };
          const deal = await client.getDeal(p.deal_id);
          return { content: JSON.stringify(deal, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "pipedrive_create_deal",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const deal = await client.createDeal(params as Parameters<typeof client.createDeal>[0]);
          return { content: JSON.stringify(deal, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "pipedrive_update_deal",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { deal_id: number } & Parameters<typeof client.updateDeal>[1];
          const { deal_id, ...rest } = p;
          const deal = await client.updateDeal(deal_id, rest);
          return { content: JSON.stringify(deal, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "pipedrive_search_persons",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const persons = await client.searchPersons(params as Parameters<typeof client.searchPersons>[0]);
          return { content: JSON.stringify(persons, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "pipedrive_create_person",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const person = await client.createPerson(params as Parameters<typeof client.createPerson>[0]);
          return { content: JSON.stringify(person, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "pipedrive_search_organizations",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const orgs = await client.searchOrganizations(params as Parameters<typeof client.searchOrganizations>[0]);
          return { content: JSON.stringify(orgs, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "pipedrive_create_organization",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const org = await client.createOrganization(params as Parameters<typeof client.createOrganization>[0]);
          return { content: JSON.stringify(org, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "pipedrive_list_activities",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const activities = await client.listActivities(params as Parameters<typeof client.listActivities>[0]);
          return { content: JSON.stringify(activities, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "pipedrive_create_activity",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const activity = await client.createActivity(params as Parameters<typeof client.createActivity>[0]);
          return { content: JSON.stringify(activity, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "pipedrive_list_pipelines",
      {
        displayName: "List Pipelines",
        description: "List all sales pipelines and their stages in Pipedrive.",
        parametersSchema: {
          type: "object",
          properties: {},
        },
      },
      async (_params): Promise<ToolResult> => {
        try {
          const pipelines = await client.listPipelines();
          return { content: JSON.stringify(pipelines, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Pipedrive plugin ready — 11 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "Pipedrive plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
