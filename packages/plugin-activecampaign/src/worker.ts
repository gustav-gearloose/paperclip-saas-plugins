import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { ActiveCampaignClient } from "./activecampaign-client.js";

interface ActiveCampaignPluginConfig {
  apiKeyRef?: string;
  accountUrl?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    let cachedClient: ActiveCampaignClient | null = null;
    let configError: string | null = null;

    async function getClient(): Promise<ActiveCampaignClient | null> {
      if (cachedClient) return cachedClient;
      if (configError) return null;

const config = await ctx.config.get() as ActiveCampaignPluginConfig;

      if (!config.apiKeyRef) {
        configError = "ActiveCampaign plugin: apiKeyRef is required";
        ctx.logger.warn("config missing");
        return null;
      }
      if (!config.accountUrl) {
        configError = "ActiveCampaign plugin: accountUrl is required";
        ctx.logger.warn("config missing");
        return null;
      }

      let apiKey: string;
      try {
        apiKey = await ctx.secrets.resolve(config.apiKeyRef);
      } catch (err) {
        configError = `ActiveCampaign plugin: failed to resolve apiKeyRef: ${err instanceof Error ? err.message : String(err)}`;
        ctx.logger.warn("config missing");
        return null;
      }

      cachedClient = new ActiveCampaignClient(apiKey, config.accountUrl);
      return cachedClient;
      ctx.logger.info("ActiveCampaign plugin: client initialized, registering tools");
    }

    ctx.tools.register(
      "activecampaign_list_contacts",
      {
        displayName: "List Contacts",
        description: "List ActiveCampaign contacts, optionally filtered by email, search query, status, list, or tag.",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Number of results (default 20, max 100).", default: 20 },
            offset: { type: "integer", description: "Pagination offset.", default: 0 },
            email: { type: "string", description: "Filter by exact email address." },
            search: { type: "string", description: "Search contacts by name or email." },
            status: { type: "integer", description: "Filter by status: 1=active, 2=unsubscribed, 3=bounced." },
            listid: { type: "string", description: "Filter by list ID." },
            tagid: { type: "string", description: "Filter by tag ID." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { limit, offset, email, search, status, listid, tagid } = params as {
          limit?: number; offset?: number; email?: string; search?: string;
          status?: number; listid?: string; tagid?: string;
        };
        try {
          const result = await client.listContacts({ limit, offset, email, search, status, listid, tagid });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "activecampaign_get_contact",
      {
        displayName: "Get Contact",
        description: "Get details of a specific ActiveCampaign contact by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            contact_id: { type: "string", description: "The ActiveCampaign contact ID." },
          },
          required: ["contact_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { contact_id } = params as { contact_id: string };
        try {
          const result = await client.getContact(contact_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "activecampaign_create_contact",
      {
        displayName: "Create Contact",
        description: "Create a new contact in ActiveCampaign.",
        parametersSchema: {
          type: "object",
          properties: {
            email: { type: "string", description: "Contact email address." },
            firstName: { type: "string", description: "Contact first name." },
            lastName: { type: "string", description: "Contact last name." },
            phone: { type: "string", description: "Contact phone number." },
            fieldValues: {
              type: "array",
              description: "Custom field values.",
              items: {
                type: "object",
                properties: {
                  field: { type: "string", description: "Field ID." },
                  value: { type: "string", description: "Field value." },
                },
                required: ["field", "value"],
              },
            },
          },
          required: ["email"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { email, firstName, lastName, phone, fieldValues } = params as {
          email: string; firstName?: string; lastName?: string; phone?: string;
          fieldValues?: Array<{ field: string; value: string }>;
        };
        try {
          const result = await client.createContact({ email, firstName, lastName, phone, fieldValues });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "activecampaign_update_contact",
      {
        displayName: "Update Contact",
        description: "Update an existing ActiveCampaign contact.",
        parametersSchema: {
          type: "object",
          properties: {
            contact_id: { type: "string", description: "The ActiveCampaign contact ID." },
            email: { type: "string", description: "New email address." },
            firstName: { type: "string", description: "New first name." },
            lastName: { type: "string", description: "New last name." },
            phone: { type: "string", description: "New phone number." },
            fieldValues: {
              type: "array",
              description: "Custom field values to update.",
              items: {
                type: "object",
                properties: {
                  field: { type: "string", description: "Field ID." },
                  value: { type: "string", description: "Field value." },
                },
                required: ["field", "value"],
              },
            },
          },
          required: ["contact_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { contact_id, email, firstName, lastName, phone, fieldValues } = params as {
          contact_id: string; email?: string; firstName?: string; lastName?: string; phone?: string;
          fieldValues?: Array<{ field: string; value: string }>;
        };
        try {
          const result = await client.updateContact(contact_id, { email, firstName, lastName, phone, fieldValues });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "activecampaign_list_lists",
      {
        displayName: "List Lists",
        description: "List all ActiveCampaign contact lists.",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Number of results (default 20).", default: 20 },
            offset: { type: "integer", description: "Pagination offset.", default: 0 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { limit, offset } = params as { limit?: number; offset?: number };
        try {
          const result = await client.listLists({ limit, offset });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "activecampaign_list_tags",
      {
        displayName: "List Tags",
        description: "List all tags in ActiveCampaign.",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Number of results (default 20).", default: 20 },
            offset: { type: "integer", description: "Pagination offset.", default: 0 },
            search: { type: "string", description: "Search tags by name." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { limit, offset, search } = params as { limit?: number; offset?: number; search?: string };
        try {
          const result = await client.listTags({ limit, offset, search });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "activecampaign_add_tag_to_contact",
      {
        displayName: "Add Tag to Contact",
        description: "Add a tag to an ActiveCampaign contact.",
        parametersSchema: {
          type: "object",
          properties: {
            contact_id: { type: "string", description: "The ActiveCampaign contact ID." },
            tag_id: { type: "string", description: "The tag ID to add." },
          },
          required: ["contact_id", "tag_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { contact_id, tag_id } = params as { contact_id: string; tag_id: string };
        try {
          const result = await client.addTagToContact(contact_id, tag_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "activecampaign_list_deals",
      {
        displayName: "List Deals",
        description: "List CRM deals in ActiveCampaign, optionally filtered by search, stage, or status.",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Number of results (default 20).", default: 20 },
            offset: { type: "integer", description: "Pagination offset.", default: 0 },
            search: { type: "string", description: "Search deals by title." },
            stage: { type: "string", description: "Filter by stage ID." },
            group: { type: "string", description: "Filter by pipeline (group) ID." },
            status: { type: "integer", description: "Filter by status: 0=open, 1=won, 2=lost." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { limit, offset, search, stage, group, status } = params as {
          limit?: number; offset?: number; search?: string; stage?: string; group?: string; status?: number;
        };
        try {
          const result = await client.listDeals({ limit, offset, search, stage, group, status });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "activecampaign_get_deal",
      {
        displayName: "Get Deal",
        description: "Get details of a specific ActiveCampaign CRM deal.",
        parametersSchema: {
          type: "object",
          properties: {
            deal_id: { type: "string", description: "The ActiveCampaign deal ID." },
          },
          required: ["deal_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { deal_id } = params as { deal_id: string };
        try {
          const result = await client.getDeal(deal_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "activecampaign_create_deal",
      {
        displayName: "Create Deal",
        description: "Create a new CRM deal in ActiveCampaign.",
        parametersSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Deal title." },
            contact: { type: "string", description: "Contact ID to associate with the deal." },
            value: { type: "integer", description: "Deal value in cents (e.g. 5000 = $50.00)." },
            currency: { type: "string", description: "Currency code (e.g. usd, eur, dkk).", default: "usd" },
            pipeline: { type: "string", description: "Pipeline (group) ID." },
            stage: { type: "string", description: "Stage ID within the pipeline." },
            owner: { type: "string", description: "Owner (user) ID." },
          },
          required: ["title", "contact"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { title, contact, value, currency, pipeline, stage, owner } = params as {
          title: string; contact: string; value?: number; currency?: string;
          pipeline?: string; stage?: string; owner?: string;
        };
        try {
          const result = await client.createDeal({ title, contact, value, currency, pipeline, stage, owner });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "activecampaign_list_automations",
      {
        displayName: "List Automations",
        description: "List all automation workflows in ActiveCampaign.",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Number of results (default 20).", default: 20 },
            offset: { type: "integer", description: "Pagination offset.", default: 0 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { limit, offset } = params as { limit?: number; offset?: number };
        try {
          const result = await client.listAutomations({ limit, offset });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "activecampaign_add_contact_to_automation",
      {
        displayName: "Add Contact to Automation",
        description: "Enroll a contact into an ActiveCampaign automation workflow.",
        parametersSchema: {
          type: "object",
          properties: {
            contact_id: { type: "string", description: "The ActiveCampaign contact ID." },
            automation_id: { type: "string", description: "The automation ID to enroll the contact in." },
          },
          required: ["contact_id", "automation_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { contact_id, automation_id } = params as { contact_id: string; automation_id: string };
        try {
          const result = await client.addContactToAutomation(contact_id, automation_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("ActiveCampaign plugin: all tools registered");
  },
});

runWorker(plugin, import.meta.url);
