import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { HubSpotClient } from "./hubspot-client.js";

interface HubSpotPluginConfig {
  accessTokenRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as HubSpotPluginConfig;
    const { accessTokenRef } = config;

    if (!accessTokenRef) {
      ctx.logger.error("HubSpot plugin: accessTokenRef is required");
      return;
    }

    let accessToken: string;
    try {
      accessToken = await ctx.secrets.resolve(accessTokenRef);
    } catch (err) {
      ctx.logger.error(`HubSpot plugin: failed to resolve secret: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    const client = new HubSpotClient(accessToken);
    ctx.logger.info("HubSpot plugin: registering tools");

    ctx.tools.register(
      "hubspot_search_contacts",
      {
        displayName: "Search Contacts",
        description: "Search HubSpot contacts by name, email, or free-text query.",
        parametersSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            email: { type: "string" },
            limit: { type: "integer" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.searchContacts({
            query: p.query as string | undefined,
            email: p.email as string | undefined,
            limit: p.limit as number | undefined,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "hubspot_get_contact",
      {
        displayName: "Get Contact",
        description: "Get full details of a HubSpot contact by contact ID.",
        parametersSchema: {
          type: "object",
          required: ["contact_id"],
          properties: { contact_id: { type: "string" } },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.getContact(p.contact_id as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "hubspot_search_companies",
      {
        displayName: "Search Companies",
        description: "Search HubSpot companies by name or free-text query.",
        parametersSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            name: { type: "string" },
            limit: { type: "integer" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.searchCompanies({
            query: p.query as string | undefined,
            name: p.name as string | undefined,
            limit: p.limit as number | undefined,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "hubspot_get_company",
      {
        displayName: "Get Company",
        description: "Get full details of a HubSpot company by company ID.",
        parametersSchema: {
          type: "object",
          required: ["company_id"],
          properties: { company_id: { type: "string" } },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.getCompany(p.company_id as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "hubspot_search_deals",
      {
        displayName: "Search Deals",
        description: "Search HubSpot deals by name, deal stage, or free-text query.",
        parametersSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            stage: { type: "string" },
            limit: { type: "integer" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.searchDeals({
            query: p.query as string | undefined,
            stage: p.stage as string | undefined,
            limit: p.limit as number | undefined,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "hubspot_get_deal",
      {
        displayName: "Get Deal",
        description: "Get full details of a HubSpot deal by deal ID.",
        parametersSchema: {
          type: "object",
          required: ["deal_id"],
          properties: { deal_id: { type: "string" } },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.getDeal(p.deal_id as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "hubspot_list_recent_deals",
      {
        displayName: "List Recent Deals",
        description: "List the most recent HubSpot deals sorted by close date.",
        parametersSchema: {
          type: "object",
          properties: { limit: { type: "integer" } },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listDeals({ limit: p.limit as number | undefined });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "hubspot_create_note",
      {
        displayName: "Create Note",
        description: "Create a note in HubSpot and optionally associate it with a contact, deal, or company.",
        parametersSchema: {
          type: "object",
          required: ["body"],
          properties: {
            body: { type: "string" },
            contact_id: { type: "string" },
            deal_id: { type: "string" },
            company_id: { type: "string" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.createNote({
            body: p.body as string,
            contactId: p.contact_id as string | undefined,
            dealId: p.deal_id as string | undefined,
            companyId: p.company_id as string | undefined,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "hubspot_create_contact",
      {
        displayName: "Create Contact",
        description: "Create a new contact in HubSpot CRM.",
        parametersSchema: {
          type: "object",
          properties: {
            email: { type: "string", description: "Contact email address." },
            first_name: { type: "string" },
            last_name: { type: "string" },
            phone: { type: "string" },
            company: { type: "string" },
            job_title: { type: "string" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.createContact({
            email: p.email as string | undefined,
            firstName: p.first_name as string | undefined,
            lastName: p.last_name as string | undefined,
            phone: p.phone as string | undefined,
            company: p.company as string | undefined,
            jobTitle: p.job_title as string | undefined,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "hubspot_create_deal",
      {
        displayName: "Create Deal",
        description: "Create a new deal in HubSpot CRM, optionally associating with a contact and company.",
        parametersSchema: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", description: "Deal name." },
            stage: { type: "string", description: "HubSpot deal stage ID (default: appointmentscheduled)." },
            amount: { type: "number", description: "Deal amount." },
            close_date: { type: "string", description: "Expected close date (YYYY-MM-DD)." },
            pipeline: { type: "string", description: "Pipeline ID (default: default)." },
            contact_id: { type: "string", description: "HubSpot contact ID to associate with the deal." },
            company_id: { type: "string", description: "HubSpot company ID to associate with the deal." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.createDeal({
            name: p.name as string,
            stage: p.stage as string | undefined,
            amount: p.amount as number | undefined,
            closeDate: p.close_date as string | undefined,
            pipeline: p.pipeline as string | undefined,
            contactId: p.contact_id as string | undefined,
            companyId: p.company_id as string | undefined,
          });
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "hubspot_update_contact",
      {
        displayName: "Update Contact",
        description: "Update properties on an existing HubSpot contact.",
        parametersSchema: {
          type: "object",
          required: ["contact_id", "properties"],
          properties: {
            contact_id: { type: "string", description: "HubSpot contact ID." },
            properties: {
              type: "object",
              description: "Key-value map of HubSpot contact properties to update (e.g. { \"firstname\": \"Jane\", \"phone\": \"+45...\" }).",
              additionalProperties: { type: "string" },
            },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.updateContact(p.contact_id as string, p.properties as Record<string, string>);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "hubspot_update_deal",
      {
        displayName: "Update Deal",
        description: "Update properties on an existing HubSpot deal (e.g. stage, amount, close date).",
        parametersSchema: {
          type: "object",
          required: ["deal_id", "properties"],
          properties: {
            deal_id: { type: "string", description: "HubSpot deal ID." },
            properties: {
              type: "object",
              description: "Key-value map of HubSpot deal properties to update (e.g. { \"dealstage\": \"closedwon\", \"amount\": \"5000\" }).",
              additionalProperties: { type: "string" },
            },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.updateDeal(p.deal_id as string, p.properties as Record<string, string>);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("HubSpot plugin ready — 12 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "HubSpot CRM plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
