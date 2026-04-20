import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { AirtableClient } from "./airtable-client.js";

interface AirtablePluginConfig {
  apiKeyRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as AirtablePluginConfig;

    if (!config.apiKeyRef) {
      ctx.logger.error("Airtable plugin: apiKeyRef is required");
      return;
    }

    let apiKey: string;
    try {
      apiKey = await ctx.secrets.resolve(config.apiKeyRef);
    } catch (err) {
      ctx.logger.error(`Airtable plugin: failed to resolve apiKeyRef: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    ctx.logger.info("Airtable plugin: secret resolved, registering tools");
    const client = new AirtableClient(apiKey);

    ctx.tools.register(
      "airtable_list_bases",
      {
        displayName: "List Bases",
        description: "List all Airtable bases the authenticated user has access to.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const result = await client.listBases();
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "airtable_list_tables",
      {
        displayName: "List Tables",
        description: "List all tables in an Airtable base.",
        parametersSchema: {
          type: "object",
          properties: {
            base_id: { type: "string", description: "Airtable base ID (starts with 'app')." },
          },
          required: ["base_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { base_id } = params as { base_id: string };
        try {
          const result = await client.listTables(base_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "airtable_list_records",
      {
        displayName: "List Records",
        description: "List records from an Airtable table, with optional filter and sort.",
        parametersSchema: {
          type: "object",
          properties: {
            base_id: { type: "string", description: "Airtable base ID." },
            table_name: { type: "string", description: "Table name or ID." },
            filter_formula: { type: "string", description: "Airtable filter formula (e.g. \"{Status}='Active'\")." },
            max_records: { type: "integer", description: "Maximum number of records to return (default 100).", default: 100 },
            view: { type: "string", description: "View name or ID to use." },
          },
          required: ["base_id", "table_name"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { base_id, table_name, filter_formula, max_records, view } = params as {
          base_id: string; table_name: string; filter_formula?: string; max_records?: number; view?: string;
        };
        try {
          const result = await client.listRecords(base_id, table_name, {
            filterFormula: filter_formula,
            maxRecords: max_records,
            view,
          });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "airtable_get_record",
      {
        displayName: "Get Record",
        description: "Get a single record from an Airtable table by record ID.",
        parametersSchema: {
          type: "object",
          properties: {
            base_id: { type: "string", description: "Airtable base ID." },
            table_name: { type: "string", description: "Table name or ID." },
            record_id: { type: "string", description: "Record ID (starts with 'rec')." },
          },
          required: ["base_id", "table_name", "record_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { base_id, table_name, record_id } = params as { base_id: string; table_name: string; record_id: string };
        try {
          const result = await client.getRecord(base_id, table_name, record_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "airtable_create_record",
      {
        displayName: "Create Record",
        description: "Create a new record in an Airtable table.",
        parametersSchema: {
          type: "object",
          properties: {
            base_id: { type: "string", description: "Airtable base ID." },
            table_name: { type: "string", description: "Table name or ID." },
            fields: { type: "object", description: "Record fields as key-value pairs matching the table's field names.", additionalProperties: true },
          },
          required: ["base_id", "table_name", "fields"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { base_id, table_name, fields } = params as { base_id: string; table_name: string; fields: Record<string, unknown> };
        try {
          const result = await client.createRecord(base_id, table_name, fields);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "airtable_update_record",
      {
        displayName: "Update Record",
        description: "Update fields on an existing Airtable record (PATCH — only specified fields are changed).",
        parametersSchema: {
          type: "object",
          properties: {
            base_id: { type: "string", description: "Airtable base ID." },
            table_name: { type: "string", description: "Table name or ID." },
            record_id: { type: "string", description: "Record ID (starts with 'rec')." },
            fields: { type: "object", description: "Fields to update as key-value pairs.", additionalProperties: true },
          },
          required: ["base_id", "table_name", "record_id", "fields"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { base_id, table_name, record_id, fields } = params as {
          base_id: string; table_name: string; record_id: string; fields: Record<string, unknown>;
        };
        try {
          const result = await client.updateRecord(base_id, table_name, record_id, fields);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "airtable_delete_record",
      {
        displayName: "Delete Record",
        description: "Delete a record from an Airtable table.",
        parametersSchema: {
          type: "object",
          properties: {
            base_id: { type: "string", description: "Airtable base ID." },
            table_name: { type: "string", description: "Table name or ID." },
            record_id: { type: "string", description: "Record ID (starts with 'rec')." },
          },
          required: ["base_id", "table_name", "record_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { base_id, table_name, record_id } = params as { base_id: string; table_name: string; record_id: string };
        try {
          const result = await client.deleteRecord(base_id, table_name, record_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "airtable_search_records",
      {
        displayName: "Search Records",
        description: "Search for records in an Airtable table using a filter formula.",
        parametersSchema: {
          type: "object",
          properties: {
            base_id: { type: "string", description: "Airtable base ID." },
            table_name: { type: "string", description: "Table name or ID." },
            search_field: { type: "string", description: "Field name to search in." },
            search_value: { type: "string", description: "Value to search for (partial match using FIND())." },
            max_records: { type: "integer", description: "Maximum records to return (default 50).", default: 50 },
          },
          required: ["base_id", "table_name", "search_field", "search_value"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { base_id, table_name, search_field, search_value, max_records } = params as {
          base_id: string; table_name: string; search_field: string; search_value: string; max_records?: number;
        };
        try {
          const result = await client.searchRecords(base_id, table_name, search_field, search_value, max_records ?? 50);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Airtable plugin: all tools registered");
  },
});

runWorker(plugin, import.meta.url);
