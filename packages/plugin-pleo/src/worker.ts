import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { PleoClient } from "./pleo-client.js";

interface PleoConfig {
  clientIdRef?: string;
  clientSecretRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const cfg = await ctx.config.get() as PleoConfig;

    const [clientId, clientSecret] = await Promise.all([
      ctx.secrets.resolve(cfg.clientIdRef ?? ""),
      ctx.secrets.resolve(cfg.clientSecretRef ?? ""),
    ]);

    const client = new PleoClient(clientId, clientSecret);

    ctx.tools.register(
      "pleo_get_company",
      {
        displayName: "Get Company",
        description: "Get the authenticated Pleo company details.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          return { content: JSON.stringify(await client.getCompany()) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "pleo_list_expenses",
      {
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
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as { limit?: number; offset?: number; status?: string };
          return { content: JSON.stringify(await client.listExpenses(p.limit, p.offset, p.status)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "pleo_get_expense",
      {
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
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as { id: string };
          return { content: JSON.stringify(await client.getExpense(p.id)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "pleo_list_cards",
      {
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
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as { limit?: number; offset?: number };
          return { content: JSON.stringify(await client.listCards(p.limit, p.offset)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "pleo_get_card",
      {
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
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as { id: string };
          return { content: JSON.stringify(await client.getCard(p.id)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "pleo_list_users",
      {
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
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as { limit?: number; offset?: number };
          return { content: JSON.stringify(await client.listUsers(p.limit, p.offset)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "pleo_get_user",
      {
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
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as { id: string };
          return { content: JSON.stringify(await client.getUser(p.id)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "pleo_list_tags",
      {
        displayName: "List Tags",
        description: "List expense tags/categories configured in Pleo.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          return { content: JSON.stringify(await client.listTags()) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "pleo_list_teams",
      {
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
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as { limit?: number; offset?: number };
          return { content: JSON.stringify(await client.listTeams(p.limit, p.offset)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "pleo_list_accounting_entries",
      {
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
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = params as { limit?: number; offset?: number };
          return { content: JSON.stringify(await client.listAccountingEntries(p.limit, p.offset)) };
        } catch (e) { return errResult(e); }
      },
    );
  },
});

runWorker(plugin, import.meta.url);
