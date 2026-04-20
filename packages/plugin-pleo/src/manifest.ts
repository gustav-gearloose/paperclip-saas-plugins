import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.pleo",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Pleo",
  description: "Pleo expense management — expenses, cards, users, teams, tags, and accounting entries.",
  author: "Gearloose",
  categories: ["connector"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "instance.settings.register",
  ],
  instanceConfigSchema: {
    clientIdRef: {
      type: "string",
      format: "secret-ref",
      description: "Pleo API client ID.",
    },
    clientSecretRef: {
      type: "string",
      format: "secret-ref",
      description: "Pleo API client secret.",
    },
  },
  entrypoints: {
    worker: "./worker.js",
  },
  tools: [
    {
      name: "pleo_get_company",
      displayName: "Get Company",
      description: "Get the authenticated Pleo company details.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "pleo_list_expenses",
      displayName: "List Expenses",
      description: "List company expenses, optionally filtered by status.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max expenses to return (default 50)." },
          offset: { type: "number", description: "Pagination offset (default 0)." },
          status: { type: "string", description: "Filter by status: PENDING, APPROVED, REJECTED (optional)." },
        },
      },
    },
    {
      name: "pleo_get_expense",
      displayName: "Get Expense",
      description: "Get details for a specific expense by ID.",
      parametersSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Expense ID." },
        },
        required: ["id"],
      },
    },
    {
      name: "pleo_list_cards",
      displayName: "List Cards",
      description: "List company Pleo cards.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max cards to return (default 50)." },
          offset: { type: "number", description: "Pagination offset (default 0)." },
        },
      },
    },
    {
      name: "pleo_get_card",
      displayName: "Get Card",
      description: "Get details for a specific Pleo card by ID.",
      parametersSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Card ID." },
        },
        required: ["id"],
      },
    },
    {
      name: "pleo_list_users",
      displayName: "List Users",
      description: "List employees/users in the Pleo company.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max users to return (default 50)." },
          offset: { type: "number", description: "Pagination offset (default 0)." },
        },
      },
    },
    {
      name: "pleo_get_user",
      displayName: "Get User",
      description: "Get details for a specific Pleo user by ID.",
      parametersSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "User ID." },
        },
        required: ["id"],
      },
    },
    {
      name: "pleo_list_tags",
      displayName: "List Tags",
      description: "List expense tags/categories configured in Pleo.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "pleo_list_teams",
      displayName: "List Teams",
      description: "List teams in the Pleo company.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max teams to return (default 50)." },
          offset: { type: "number", description: "Pagination offset (default 0)." },
        },
      },
    },
    {
      name: "pleo_list_accounting_entries",
      displayName: "List Accounting Entries",
      description: "List accounting entries (export-ready expense records).",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max entries to return (default 50)." },
          offset: { type: "number", description: "Pagination offset (default 0)." },
        },
      },
    },
  ],
};

export default manifest;
