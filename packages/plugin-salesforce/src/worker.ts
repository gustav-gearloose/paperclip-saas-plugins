import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { SalesforceClient } from "./salesforce-client.js";

interface SalesforcePluginConfig {
  accessTokenRef?: string;
  refreshTokenRef?: string;
  clientIdRef?: string;
  clientSecretRef?: string;
  instanceUrl?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as SalesforcePluginConfig;

    if (!config.accessTokenRef || !config.refreshTokenRef || !config.clientIdRef || !config.clientSecretRef) {
      ctx.logger.error("Salesforce plugin: accessTokenRef, refreshTokenRef, clientIdRef, and clientSecretRef are all required");
      return;
    }
    if (!config.instanceUrl) {
      ctx.logger.error("Salesforce plugin: instanceUrl is required");
      return;
    }

    let accessToken: string;
    let refreshToken: string;
    let clientId: string;
    let clientSecret: string;
    try {
      [accessToken, refreshToken, clientId, clientSecret] = await Promise.all([
        ctx.secrets.resolve(config.accessTokenRef),
        ctx.secrets.resolve(config.refreshTokenRef),
        ctx.secrets.resolve(config.clientIdRef),
        ctx.secrets.resolve(config.clientSecretRef),
      ]);
    } catch (err) {
      ctx.logger.error(`Salesforce plugin: failed to resolve secrets: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    ctx.logger.info("Salesforce plugin: secrets resolved, registering tools");
    const client = new SalesforceClient({
      instanceUrl: config.instanceUrl,
      accessToken,
      refreshToken,
      clientId,
      clientSecret,
    });

    ctx.tools.register(
      "salesforce_list_contacts",
      {
        displayName: "List Contacts",
        description: "List Salesforce contacts, optionally filtered by name search.",
        parametersSchema: {
          type: "object",
          properties: {
            search: { type: "string", description: "Filter contacts whose name contains this string." },
            limit: { type: "integer", description: "Max results (default 50).", default: 50 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { search?: string; limit?: number };
          const result = await client.listContacts(p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "salesforce_get_contact",
      {
        displayName: "Get Contact",
        description: "Get full details for a specific Salesforce contact by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Salesforce contact ID." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { id: string };
          const result = await client.getContact(p.id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "salesforce_create_contact",
      {
        displayName: "Create Contact",
        description: "Create a new contact in Salesforce.",
        parametersSchema: {
          type: "object",
          properties: {
            last_name: { type: "string", description: "Contact last name (required)." },
            first_name: { type: "string", description: "Contact first name." },
            email: { type: "string", description: "Contact email address." },
            phone: { type: "string", description: "Contact phone number." },
            title: { type: "string", description: "Contact job title." },
            account_id: { type: "string", description: "ID of the account (company) to link this contact to." },
          },
          required: ["last_name"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { last_name: string; first_name?: string; email?: string; phone?: string; title?: string; account_id?: string };
          const result = await client.createContact({
            lastName: p.last_name,
            firstName: p.first_name,
            email: p.email,
            phone: p.phone,
            title: p.title,
            accountId: p.account_id,
          });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "salesforce_list_accounts",
      {
        displayName: "List Accounts",
        description: "List Salesforce accounts (companies), optionally filtered by name search.",
        parametersSchema: {
          type: "object",
          properties: {
            search: { type: "string", description: "Filter accounts whose name contains this string." },
            limit: { type: "integer", description: "Max results (default 50).", default: 50 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { search?: string; limit?: number };
          const result = await client.listAccounts(p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "salesforce_get_account",
      {
        displayName: "Get Account",
        description: "Get full details for a specific Salesforce account by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Salesforce account ID." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { id: string };
          const result = await client.getAccount(p.id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "salesforce_create_account",
      {
        displayName: "Create Account",
        description: "Create a new account (company) in Salesforce.",
        parametersSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Account (company) name." },
            industry: { type: "string", description: "Industry type (e.g. Technology, Finance)." },
            phone: { type: "string", description: "Main phone number." },
            website: { type: "string", description: "Company website URL." },
            billing_city: { type: "string", description: "Billing city." },
            billing_country: { type: "string", description: "Billing country." },
          },
          required: ["name"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { name: string; industry?: string; phone?: string; website?: string; billing_city?: string; billing_country?: string };
          const result = await client.createAccount({
            name: p.name,
            industry: p.industry,
            phone: p.phone,
            website: p.website,
            billingCity: p.billing_city,
            billingCountry: p.billing_country,
          });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "salesforce_list_opportunities",
      {
        displayName: "List Opportunities",
        description: "List Salesforce opportunities (deals), optionally filtered by account or stage.",
        parametersSchema: {
          type: "object",
          properties: {
            account_id: { type: "string", description: "Filter by account ID." },
            stage: { type: "string", description: "Filter by stage name (e.g. Prospecting, Closed Won)." },
            limit: { type: "integer", description: "Max results (default 50).", default: 50 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { account_id?: string; stage?: string; limit?: number };
          const result = await client.listOpportunities({ accountId: p.account_id, stage: p.stage, limit: p.limit });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "salesforce_get_opportunity",
      {
        displayName: "Get Opportunity",
        description: "Get full details for a specific Salesforce opportunity by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Salesforce opportunity ID." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { id: string };
          const result = await client.getOpportunity(p.id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "salesforce_create_opportunity",
      {
        displayName: "Create Opportunity",
        description: "Create a new opportunity (deal) in Salesforce.",
        parametersSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Opportunity name." },
            stage_name: { type: "string", description: "Sales stage (e.g. Prospecting, Proposal/Price Quote, Closed Won)." },
            close_date: { type: "string", description: "Expected close date in YYYY-MM-DD format." },
            account_id: { type: "string", description: "ID of the associated account." },
            amount: { type: "number", description: "Expected revenue amount." },
            probability: { type: "number", description: "Probability of closing (0-100)." },
            description: { type: "string", description: "Opportunity description." },
          },
          required: ["name", "stage_name", "close_date"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { name: string; stage_name: string; close_date: string; account_id?: string; amount?: number; probability?: number; description?: string };
          const result = await client.createOpportunity({
            name: p.name,
            stageName: p.stage_name,
            closeDate: p.close_date,
            accountId: p.account_id,
            amount: p.amount,
            probability: p.probability,
            description: p.description,
          });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "salesforce_update_opportunity",
      {
        displayName: "Update Opportunity",
        description: "Update fields on a Salesforce opportunity (stage, amount, close date, etc.).",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Salesforce opportunity ID." },
            stage_name: { type: "string", description: "New sales stage." },
            amount: { type: "number", description: "New expected revenue amount." },
            close_date: { type: "string", description: "New close date in YYYY-MM-DD format." },
            probability: { type: "number", description: "New probability (0-100)." },
            description: { type: "string", description: "Updated description." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const { id, stage_name, close_date, ...rest } = params as { id: string; stage_name?: string; close_date?: string } & Record<string, unknown>;
          const data: Record<string, unknown> = { ...rest };
          if (stage_name) data["StageName"] = stage_name;
          if (close_date) data["CloseDate"] = close_date;
          const result = await client.updateOpportunity(id, data);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "salesforce_list_leads",
      {
        displayName: "List Leads",
        description: "List Salesforce leads, optionally filtered by name search or status.",
        parametersSchema: {
          type: "object",
          properties: {
            search: { type: "string", description: "Filter leads whose name contains this string." },
            status: { type: "string", description: "Filter by lead status (e.g. Open, Working, Closed)." },
            limit: { type: "integer", description: "Max results (default 50).", default: 50 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { search?: string; status?: string; limit?: number };
          const result = await client.listLeads(p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "salesforce_create_lead",
      {
        displayName: "Create Lead",
        description: "Create a new lead in Salesforce.",
        parametersSchema: {
          type: "object",
          properties: {
            last_name: { type: "string", description: "Lead last name." },
            company: { type: "string", description: "Lead's company name." },
            first_name: { type: "string", description: "Lead first name." },
            email: { type: "string", description: "Lead email address." },
            phone: { type: "string", description: "Lead phone number." },
            status: { type: "string", description: "Lead status (e.g. Open, Working)." },
            lead_source: { type: "string", description: "Source of the lead (e.g. Web, Phone, Partner)." },
          },
          required: ["last_name", "company"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { last_name: string; company: string; first_name?: string; email?: string; phone?: string; status?: string; lead_source?: string };
          const result = await client.createLead({
            lastName: p.last_name,
            company: p.company,
            firstName: p.first_name,
            email: p.email,
            phone: p.phone,
            status: p.status,
            leadSource: p.lead_source,
          });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "salesforce_soql_query",
      {
        displayName: "Run SOQL Query",
        description: "Execute a custom SOQL query against Salesforce and return results.",
        parametersSchema: {
          type: "object",
          properties: {
            soql: { type: "string", description: "The SOQL query to execute (e.g. SELECT Id, Name FROM Account LIMIT 10)." },
          },
          required: ["soql"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { soql: string };
          const result = await client.soqlQuery(p.soql);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );
  },
});

runWorker(plugin, import.meta.url);
