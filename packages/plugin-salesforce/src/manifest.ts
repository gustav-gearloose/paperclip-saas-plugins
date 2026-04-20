import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.salesforce",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Salesforce",
  description: "Salesforce CRM — contacts, accounts, opportunities, leads, and custom SOQL queries.",
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
      instanceUrl: {
        type: "string",
        title: "Instance URL",
        description: "Your Salesforce instance URL, e.g. https://yourorg.salesforce.com",
        default: "",
      },
      accessTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "Access Token (secret ref)",
        description: "UUID of a Paperclip secret holding the Salesforce OAuth2 access token.",
        default: "",
      },
      refreshTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "Refresh Token (secret ref)",
        description: "UUID of a Paperclip secret holding the Salesforce OAuth2 refresh token.",
        default: "",
      },
      clientIdRef: {
        type: "string",
        format: "secret-ref",
        title: "Client ID (secret ref)",
        description: "UUID of a Paperclip secret holding the Connected App consumer key.",
        default: "",
      },
      clientSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "Client Secret (secret ref)",
        description: "UUID of a Paperclip secret holding the Connected App consumer secret.",
        default: "",
      },
    },
    required: ["instanceUrl", "accessTokenRef", "refreshTokenRef", "clientIdRef", "clientSecretRef"],
  },
  tools: [
    {
      name: "salesforce_list_contacts",
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
    {
      name: "salesforce_get_contact",
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
    {
      name: "salesforce_create_contact",
      displayName: "Create Contact",
      description: "Create a new contact in Salesforce.",
      parametersSchema: {
        type: "object",
        properties: {
          last_name: { type: "string", description: "Contact last name." },
          first_name: { type: "string", description: "Contact first name." },
          email: { type: "string", description: "Contact email address." },
          phone: { type: "string", description: "Contact phone number." },
          title: { type: "string", description: "Contact job title." },
          account_id: { type: "string", description: "ID of the account (company) to link this contact to." },
        },
        required: ["last_name"],
      },
    },
    {
      name: "salesforce_list_accounts",
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
    {
      name: "salesforce_get_account",
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
    {
      name: "salesforce_create_account",
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
    {
      name: "salesforce_list_opportunities",
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
    {
      name: "salesforce_get_opportunity",
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
    {
      name: "salesforce_create_opportunity",
      displayName: "Create Opportunity",
      description: "Create a new opportunity (deal) in Salesforce.",
      parametersSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Opportunity name." },
          stage_name: { type: "string", description: "Sales stage (e.g. Prospecting, Closed Won)." },
          close_date: { type: "string", description: "Expected close date in YYYY-MM-DD format." },
          account_id: { type: "string", description: "ID of the associated account." },
          amount: { type: "number", description: "Expected revenue amount." },
          probability: { type: "number", description: "Probability of closing (0-100)." },
          description: { type: "string", description: "Opportunity description." },
        },
        required: ["name", "stage_name", "close_date"],
      },
    },
    {
      name: "salesforce_update_opportunity",
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
    {
      name: "salesforce_list_leads",
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
    {
      name: "salesforce_create_lead",
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
    {
      name: "salesforce_soql_query",
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
  ],
};

export default manifest;
