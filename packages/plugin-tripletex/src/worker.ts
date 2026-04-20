import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { TripletexClient } from "./tripletex-client.js";

interface TripletexConfig {
  consumerTokenRef?: string;
  employeeTokenRef?: string;
}

function errResult(e: unknown): ToolResult {
  return { error: e instanceof Error ? e.message : String(e) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const cfg = await ctx.config.get() as TripletexConfig;
    const consumerToken = await ctx.secrets.resolve(cfg.consumerTokenRef ?? "");
    const employeeToken = await ctx.secrets.resolve(cfg.employeeTokenRef ?? "");
    const client = new TripletexClient();
    await client.init(consumerToken, employeeToken);

    ctx.tools.register(
      "tripletex_list_invoices",
      { displayName: "List Invoices", description: "List invoices with optional date range and pagination.", parametersSchema: { type: "object", properties: { from: { type: "number", description: "Pagination offset (0-based)." }, count: { type: "number", description: "Number of results." }, dateFrom: { type: "string", description: "Invoice date from (YYYY-MM-DD)." }, dateTo: { type: "string", description: "Invoice date to (YYYY-MM-DD)." } } } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = (params ?? {}) as { from?: number; count?: number; dateFrom?: string; dateTo?: string };
          return { content: JSON.stringify(await client.listInvoices(p)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "tripletex_get_invoice",
      { displayName: "Get Invoice", description: "Get a single invoice by ID.", parametersSchema: { type: "object", properties: { id: { type: "number", description: "Tripletex invoice ID." } }, required: ["id"] } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const { id } = params as { id: number };
          return { content: JSON.stringify(await client.getInvoice(id)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "tripletex_list_customers",
      { displayName: "List Customers", description: "List all customers/clients.", parametersSchema: { type: "object", properties: { from: { type: "number", description: "Pagination offset (0-based)." }, count: { type: "number", description: "Number of results." } } } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = (params ?? {}) as { from?: number; count?: number };
          return { content: JSON.stringify(await client.listCustomers(p)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "tripletex_list_suppliers",
      { displayName: "List Suppliers", description: "List all suppliers/vendors.", parametersSchema: { type: "object", properties: { from: { type: "number", description: "Pagination offset (0-based)." }, count: { type: "number", description: "Number of results." } } } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = (params ?? {}) as { from?: number; count?: number };
          return { content: JSON.stringify(await client.listSuppliers(p)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "tripletex_list_projects",
      { displayName: "List Projects", description: "List all projects.", parametersSchema: { type: "object", properties: { from: { type: "number", description: "Pagination offset (0-based)." }, count: { type: "number", description: "Number of results." } } } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = (params ?? {}) as { from?: number; count?: number };
          return { content: JSON.stringify(await client.listProjects(p)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "tripletex_get_project",
      { displayName: "Get Project", description: "Get a single project by ID.", parametersSchema: { type: "object", properties: { id: { type: "number", description: "Tripletex project ID." } }, required: ["id"] } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const { id } = params as { id: number };
          return { content: JSON.stringify(await client.getProject(id)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "tripletex_list_timesheet_entries",
      { displayName: "List Timesheet Entries", description: "List time entries, optionally filtered by employee, project, and date range.", parametersSchema: { type: "object", properties: { from: { type: "number", description: "Pagination offset (0-based)." }, count: { type: "number", description: "Number of results." }, dateFrom: { type: "string", description: "Date from (YYYY-MM-DD)." }, dateTo: { type: "string", description: "Date to (YYYY-MM-DD)." }, employeeId: { type: "number", description: "Filter by employee ID." }, projectId: { type: "number", description: "Filter by project ID." } } } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = (params ?? {}) as { from?: number; count?: number; dateFrom?: string; dateTo?: string; employeeId?: number; projectId?: number };
          return { content: JSON.stringify(await client.listTimesheetEntries(p)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "tripletex_list_employees",
      { displayName: "List Employees", description: "List all employees in the company.", parametersSchema: { type: "object", properties: { from: { type: "number", description: "Pagination offset (0-based)." }, count: { type: "number", description: "Number of results." } } } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = (params ?? {}) as { from?: number; count?: number };
          return { content: JSON.stringify(await client.listEmployees(p)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "tripletex_list_ledger_postings",
      { displayName: "List Ledger Postings", description: "List general ledger postings for accounting analysis.", parametersSchema: { type: "object", properties: { from: { type: "number", description: "Pagination offset (0-based)." }, count: { type: "number", description: "Number of results." }, dateFrom: { type: "string", description: "Posting date from (YYYY-MM-DD)." }, dateTo: { type: "string", description: "Posting date to (YYYY-MM-DD)." } } } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = (params ?? {}) as { from?: number; count?: number; dateFrom?: string; dateTo?: string };
          return { content: JSON.stringify(await client.listLedgerPostings(p)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "tripletex_list_accounts",
      { displayName: "List Ledger Accounts", description: "List chart of accounts.", parametersSchema: { type: "object", properties: { from: { type: "number", description: "Pagination offset (0-based)." }, count: { type: "number", description: "Number of results." } } } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = (params ?? {}) as { from?: number; count?: number };
          return { content: JSON.stringify(await client.listAccounts(p)) };
        } catch (e) { return errResult(e); }
      },
    );
  },
});

runWorker(plugin, import.meta.url);
