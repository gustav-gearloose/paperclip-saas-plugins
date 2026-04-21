import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { BrevoClient } from "./brevo-client.js";

interface BrevoPluginConfig {
  apiKeyRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    let cachedClient: BrevoClient | null = null;
    let configError: string | null = null;

    async function getClient(): Promise<BrevoClient | null> {
      if (cachedClient) return cachedClient;
      if (configError) return null;

const config = await ctx.config.get() as BrevoPluginConfig;

      if (!config.apiKeyRef) {
        configError = "Brevo plugin: apiKeyRef is required";
        ctx.logger.warn("config missing");
        return null;
      }

      let apiKey: string;
      try {
        apiKey = await ctx.secrets.resolve(config.apiKeyRef);
      } catch (err) {
        configError = `Brevo plugin: failed to resolve apiKeyRef: ${err instanceof Error ? err.message : String(err)}`;
        ctx.logger.warn("config missing");
        return null;
      }

      cachedClient = new BrevoClient(apiKey);
      return cachedClient;
      ctx.logger.info("Brevo plugin: client initialized, registering tools");
    }

    ctx.tools.register(
      "brevo_get_account_info",
      {
        displayName: "Get Account Info",
        description: "Get Brevo account details including plan, credits, and sender addresses.",
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
      "brevo_send_transactional_email",
      {
        displayName: "Send Transactional Email",
        description: "Send a transactional email via Brevo to one or more recipients.",
        parametersSchema: {
          type: "object",
          properties: {
            to: {
              type: "array",
              description: "List of recipients.",
              items: {
                type: "object",
                properties: {
                  email: { type: "string", description: "Recipient email address." },
                  name: { type: "string", description: "Recipient display name." },
                },
                required: ["email"],
              },
            },
            sender_email: { type: "string", description: "Sender email address." },
            sender_name: { type: "string", description: "Sender display name." },
            subject: { type: "string", description: "Email subject line." },
            htmlContent: { type: "string", description: "HTML body of the email." },
            textContent: { type: "string", description: "Plain text body of the email." },
            templateId: { type: "integer", description: "Brevo template ID to use instead of htmlContent/textContent." },
            params: { type: "object", description: "Template parameters.", additionalProperties: true },
          },
          required: ["to", "sender_email", "subject"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { to, sender_email, sender_name, subject, htmlContent, textContent, templateId, params: tmplParams } = params as {
          to: Array<{ email: string; name?: string }>;
          sender_email: string; sender_name?: string; subject: string;
          htmlContent?: string; textContent?: string; templateId?: number;
          params?: Record<string, unknown>;
        };
        try {
          const result = await client.sendTransactionalEmail({
            to,
            sender: { email: sender_email, name: sender_name },
            subject,
            htmlContent,
            textContent,
            templateId,
            params: tmplParams,
          });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "brevo_list_contacts",
      {
        displayName: "List Contacts",
        description: "List Brevo contacts.",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Number of results (default 50, max 1000).", default: 50 },
            offset: { type: "integer", description: "Pagination offset.", default: 0 },
            sort: { type: "string", description: "Sort order: asc or desc.", default: "desc" },
            email: { type: "string", description: "Filter by email address." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { limit, offset, sort, email } = params as {
          limit?: number; offset?: number; sort?: string; email?: string;
        };
        try {
          const result = await client.listContacts({ limit, offset, sort, email });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "brevo_get_contact",
      {
        displayName: "Get Contact",
        description: "Get details of a Brevo contact by email address or contact ID.",
        parametersSchema: {
          type: "object",
          properties: {
            email_or_id: { type: "string", description: "Contact email address or numeric ID." },
          },
          required: ["email_or_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { email_or_id } = params as { email_or_id: string };
        try {
          const result = await client.getContact(email_or_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "brevo_create_contact",
      {
        displayName: "Create Contact",
        description: "Create a new contact in Brevo.",
        parametersSchema: {
          type: "object",
          properties: {
            email: { type: "string", description: "Contact email address." },
            attributes: { type: "object", description: "Contact attributes (e.g. FIRSTNAME, LASTNAME).", additionalProperties: true },
            listIds: { type: "array", items: { type: "integer" }, description: "List IDs to add the contact to." },
            emailBlacklisted: { type: "boolean", description: "Mark contact as email blacklisted." },
          },
          required: ["email"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { email, attributes, listIds, emailBlacklisted } = params as {
          email: string; attributes?: Record<string, unknown>;
          listIds?: number[]; emailBlacklisted?: boolean;
        };
        try {
          const result = await client.createContact({ email, attributes, listIds, emailBlacklisted });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "brevo_update_contact",
      {
        displayName: "Update Contact",
        description: "Update an existing Brevo contact.",
        parametersSchema: {
          type: "object",
          properties: {
            email_or_id: { type: "string", description: "Contact email address or numeric ID." },
            attributes: { type: "object", description: "Attributes to update.", additionalProperties: true },
            listIds: { type: "array", items: { type: "integer" }, description: "List IDs to add the contact to." },
            unlinkListIds: { type: "array", items: { type: "integer" }, description: "List IDs to remove the contact from." },
            emailBlacklisted: { type: "boolean", description: "Update email blacklist status." },
          },
          required: ["email_or_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { email_or_id, attributes, listIds, unlinkListIds, emailBlacklisted } = params as {
          email_or_id: string; attributes?: Record<string, unknown>;
          listIds?: number[]; unlinkListIds?: number[]; emailBlacklisted?: boolean;
        };
        try {
          const result = await client.updateContact(email_or_id, { attributes, listIds, unlinkListIds, emailBlacklisted });
          return { content: JSON.stringify(result ?? { updated: true }, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "brevo_list_contact_lists",
      {
        displayName: "List Contact Lists",
        description: "List all contact lists in Brevo.",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Number of results (default 10).", default: 10 },
            offset: { type: "integer", description: "Pagination offset.", default: 0 },
            sort: { type: "string", description: "Sort order: asc or desc.", default: "desc" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { limit, offset, sort } = params as { limit?: number; offset?: number; sort?: string };
        try {
          const result = await client.listLists({ limit, offset, sort });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "brevo_list_email_campaigns",
      {
        displayName: "List Email Campaigns",
        description: "List Brevo email campaigns, optionally filtered by type or status.",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Number of results (default 10).", default: 10 },
            offset: { type: "integer", description: "Pagination offset.", default: 0 },
            type: { type: "string", description: "Campaign type: classic or trigger." },
            status: { type: "string", description: "Filter by status: draft, sent, archive, queued, suspended, inProcess." },
            sort: { type: "string", description: "Sort order: asc or desc.", default: "desc" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { limit, offset, type, status, sort } = params as {
          limit?: number; offset?: number; type?: string; status?: string; sort?: string;
        };
        try {
          const result = await client.listEmailCampaigns({ limit, offset, type, status, sort });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "brevo_get_email_campaign",
      {
        displayName: "Get Email Campaign",
        description: "Get details of a specific Brevo email campaign.",
        parametersSchema: {
          type: "object",
          properties: {
            campaign_id: { type: "integer", description: "The Brevo campaign ID." },
          },
          required: ["campaign_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { campaign_id } = params as { campaign_id: number };
        try {
          const result = await client.getEmailCampaign(campaign_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "brevo_get_campaign_report",
      {
        displayName: "Get Campaign Report",
        description: "Get performance report for a Brevo email campaign (opens, clicks, bounces, unsubscribes).",
        parametersSchema: {
          type: "object",
          properties: {
            campaign_id: { type: "integer", description: "The Brevo campaign ID." },
          },
          required: ["campaign_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { campaign_id } = params as { campaign_id: number };
        try {
          const result = await client.getEmailCampaignReport(campaign_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "brevo_list_transactional_email_logs",
      {
        displayName: "List Transactional Email Logs",
        description: "List logs of transactional emails sent via Brevo.",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Number of results (default 50, max 1000).", default: 50 },
            offset: { type: "integer", description: "Pagination offset.", default: 0 },
            email: { type: "string", description: "Filter by recipient email." },
            sort: { type: "string", description: "Sort order: asc or desc.", default: "desc" },
            startDate: { type: "string", description: "Filter logs from this date (YYYY-MM-DD)." },
            endDate: { type: "string", description: "Filter logs up to this date (YYYY-MM-DD)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { limit, offset, email, sort, startDate, endDate } = params as {
          limit?: number; offset?: number; email?: string;
          sort?: string; startDate?: string; endDate?: string;
        };
        try {
          const result = await client.listTransactionalEmailLogs({ limit, offset, email, sort, startDate, endDate });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Brevo plugin: all tools registered");
  },
});

runWorker(plugin, import.meta.url);
