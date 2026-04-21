import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { MailchimpClient } from "./mailchimp-client.js";

interface MailchimpPluginConfig {
  apiKeyRef?: string;
  serverPrefix?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    let cachedClient: MailchimpClient | null = null;
    let configError: string | null = null;

    async function getClient(): Promise<MailchimpClient | null> {
      if (cachedClient) return cachedClient;
      if (configError) return null;

const config = await ctx.config.get() as MailchimpPluginConfig;

      if (!config.apiKeyRef) {
        configError = "Mailchimp plugin: apiKeyRef is required";
        ctx.logger.warn("config missing");
        return null;
      }
      if (!config.serverPrefix) {
        configError = "Mailchimp plugin: serverPrefix is required";
        ctx.logger.warn("config missing");
        return null;
      }

      let apiKey: string;
      try {
        apiKey = await ctx.secrets.resolve(config.apiKeyRef);
      } catch (err) {
        configError = `Mailchimp plugin: failed to resolve apiKeyRef: ${err instanceof Error ? err.message : String(err)}`;
        ctx.logger.warn("config missing");
        return null;
      }

      cachedClient = new MailchimpClient(apiKey, config.serverPrefix);
      return cachedClient;
      ctx.logger.info("Mailchimp plugin: client initialized, registering tools");
    }

    ctx.tools.register(
      "mailchimp_get_account_info",
      {
        displayName: "Get Account Info",
        description: "Get Mailchimp account details and connected audiences.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.getAccountInfo();
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "mailchimp_list_audiences",
      {
        displayName: "List Audiences",
        description: "List all Mailchimp audiences (lists).",
        parametersSchema: {
          type: "object",
          properties: {
            count: { type: "integer", description: "Number of results (default 10, max 1000).", default: 10 },
            offset: { type: "integer", description: "Pagination offset.", default: 0 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { count, offset } = params as { count?: number; offset?: number };
        try {
          const result = await client.listAudiences({ count, offset });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "mailchimp_get_audience",
      {
        displayName: "Get Audience",
        description: "Get details of a specific Mailchimp audience.",
        parametersSchema: {
          type: "object",
          properties: {
            list_id: { type: "string", description: "The Mailchimp audience (list) ID." },
          },
          required: ["list_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { list_id } = params as { list_id: string };
        try {
          const result = await client.getAudience(list_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "mailchimp_list_members",
      {
        displayName: "List Members",
        description: "List members of a Mailchimp audience, optionally filtered by status or email.",
        parametersSchema: {
          type: "object",
          properties: {
            list_id: { type: "string", description: "The Mailchimp audience (list) ID." },
            count: { type: "integer", description: "Number of results (default 10, max 1000).", default: 10 },
            offset: { type: "integer", description: "Pagination offset.", default: 0 },
            status: { type: "string", description: "Filter by status: subscribed, unsubscribed, cleaned, pending, transactional." },
            email_address: { type: "string", description: "Filter by exact email address." },
          },
          required: ["list_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { list_id, count, offset, status, email_address } = params as {
          list_id: string; count?: number; offset?: number; status?: string; email_address?: string;
        };
        try {
          const result = await client.listMembers(list_id, { count, offset, status, email_address });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "mailchimp_get_member",
      {
        displayName: "Get Member",
        description: "Get details of a specific member in a Mailchimp audience by email address.",
        parametersSchema: {
          type: "object",
          properties: {
            list_id: { type: "string", description: "The Mailchimp audience (list) ID." },
            email: { type: "string", description: "The member's email address." },
          },
          required: ["list_id", "email"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { list_id, email } = params as { list_id: string; email: string };
        try {
          const result = await client.getMember(list_id, email);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "mailchimp_add_or_update_member",
      {
        displayName: "Add or Update Member",
        description: "Add a new member or update an existing member in a Mailchimp audience (upsert by email).",
        parametersSchema: {
          type: "object",
          properties: {
            list_id: { type: "string", description: "The Mailchimp audience (list) ID." },
            email: { type: "string", description: "The member's email address." },
            status: { type: "string", description: "Subscription status: subscribed, unsubscribed, pending, cleaned." },
            merge_fields: { type: "object", description: "Merge fields (e.g. FNAME, LNAME).", additionalProperties: true },
            tags: { type: "array", items: { type: "string" }, description: "Tags to assign to the member." },
          },
          required: ["list_id", "email"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { list_id, email, status, merge_fields, tags } = params as {
          list_id: string; email: string; status?: string;
          merge_fields?: Record<string, unknown>; tags?: string[];
        };
        try {
          const result = await client.addOrUpdateMember(list_id, email, { status, merge_fields, tags });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "mailchimp_archive_member",
      {
        displayName: "Archive Member",
        description: "Archive (soft-delete) a member from a Mailchimp audience.",
        parametersSchema: {
          type: "object",
          properties: {
            list_id: { type: "string", description: "The Mailchimp audience (list) ID." },
            email: { type: "string", description: "The member's email address." },
          },
          required: ["list_id", "email"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { list_id, email } = params as { list_id: string; email: string };
        try {
          const result = await client.archiveMember(list_id, email);
          return { content: JSON.stringify(result ?? { archived: true }, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "mailchimp_list_campaigns",
      {
        displayName: "List Campaigns",
        description: "List Mailchimp campaigns, optionally filtered by status or audience.",
        parametersSchema: {
          type: "object",
          properties: {
            count: { type: "integer", description: "Number of results (default 10, max 1000).", default: 10 },
            offset: { type: "integer", description: "Pagination offset.", default: 0 },
            status: { type: "string", description: "Filter by status: save, paused, schedule, sending, sent." },
            list_id: { type: "string", description: "Filter by audience ID." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { count, offset, status, list_id } = params as {
          count?: number; offset?: number; status?: string; list_id?: string;
        };
        try {
          const result = await client.listCampaigns({ count, offset, status, list_id });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "mailchimp_get_campaign",
      {
        displayName: "Get Campaign",
        description: "Get details of a specific Mailchimp campaign.",
        parametersSchema: {
          type: "object",
          properties: {
            campaign_id: { type: "string", description: "The Mailchimp campaign ID." },
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
      "mailchimp_get_campaign_report",
      {
        displayName: "Get Campaign Report",
        description: "Get performance report for a sent Mailchimp campaign (opens, clicks, bounces).",
        parametersSchema: {
          type: "object",
          properties: {
            campaign_id: { type: "string", description: "The Mailchimp campaign ID." },
          },
          required: ["campaign_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { campaign_id } = params as { campaign_id: string };
        try {
          const result = await client.getCampaignReport(campaign_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "mailchimp_add_tags_to_member",
      {
        displayName: "Add Tags to Member",
        description: "Add one or more tags to a Mailchimp audience member.",
        parametersSchema: {
          type: "object",
          properties: {
            list_id: { type: "string", description: "The Mailchimp audience (list) ID." },
            email: { type: "string", description: "The member's email address." },
            tags: { type: "array", items: { type: "string" }, description: "Tags to add to the member." },
          },
          required: ["list_id", "email", "tags"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { list_id, email, tags } = params as { list_id: string; email: string; tags: string[] };
        try {
          const result = await client.addTagsToMember(list_id, email, tags);
          return { content: JSON.stringify(result ?? { tagged: true }, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Mailchimp plugin: all tools registered");
  },
});

runWorker(plugin, import.meta.url);
