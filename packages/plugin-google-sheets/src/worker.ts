import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { GoogleSheetsClient } from "./sheets-client.js";

interface SheetsPluginConfig {
  serviceAccountJsonRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as SheetsPluginConfig;
    const { serviceAccountJsonRef } = config;

    if (!serviceAccountJsonRef) {
      ctx.logger.error("Google Sheets plugin: serviceAccountJsonRef is required");
      return;
    }

    let serviceAccountJson: string;
    try {
      serviceAccountJson = await ctx.secrets.resolve(serviceAccountJsonRef);
    } catch (err) {
      ctx.logger.error(`Google Sheets plugin: failed to resolve secret: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    let client: GoogleSheetsClient;
    try {
      client = new GoogleSheetsClient(serviceAccountJson);
    } catch (err) {
      ctx.logger.error(`Google Sheets plugin: invalid service account JSON: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    ctx.logger.info("Google Sheets plugin: registering tools");

    ctx.tools.register(
      "sheets_get_spreadsheet_info",
      {
        displayName: "Get Spreadsheet Info",
        description: "Get metadata about a spreadsheet: title, sheet names, and row/column counts.",
        parametersSchema: {
          type: "object",
          required: ["spreadsheet_id"],
          properties: {
            spreadsheet_id: { type: "string", description: "Spreadsheet ID from the URL." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.getSpreadsheetInfo(p.spreadsheet_id as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "sheets_read_range",
      {
        displayName: "Read Range",
        description: "Read values from a range in a Google Sheet (e.g. Sheet1!A1:D10).",
        parametersSchema: {
          type: "object",
          required: ["spreadsheet_id", "range"],
          properties: {
            spreadsheet_id: {
              type: "string",
              description: "The spreadsheet ID from the URL: /spreadsheets/d/<ID>/edit",
            },
            range: {
              type: "string",
              description: "A1 notation range, e.g. 'Sheet1!A1:D10' or 'A:Z' for all columns.",
            },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.readRange(p.spreadsheet_id as string, p.range as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "sheets_write_range",
      {
        displayName: "Write Range",
        description: "Write values to a range in a Google Sheet. Overwrites existing cells.",
        parametersSchema: {
          type: "object",
          required: ["spreadsheet_id", "range", "values"],
          properties: {
            spreadsheet_id: { type: "string", description: "Spreadsheet ID from the URL." },
            range: { type: "string", description: "A1 notation start cell or range, e.g. 'Sheet1!A1'." },
            values: {
              type: "array",
              description: "2D array of values (rows × columns).",
              items: { type: "array", items: {} },
            },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.writeRange(
            p.spreadsheet_id as string,
            p.range as string,
            p.values as unknown[][]
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "sheets_append_rows",
      {
        displayName: "Append Rows",
        description: "Append rows to the end of a sheet (after the last row with data).",
        parametersSchema: {
          type: "object",
          required: ["spreadsheet_id", "range", "values"],
          properties: {
            spreadsheet_id: { type: "string", description: "Spreadsheet ID from the URL." },
            range: {
              type: "string",
              description: "Sheet name or range to detect the table, e.g. 'Sheet1'.",
            },
            values: {
              type: "array",
              description: "2D array of rows to append.",
              items: { type: "array", items: {} },
            },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.appendRows(
            p.spreadsheet_id as string,
            p.range as string,
            p.values as unknown[][]
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "sheets_clear_range",
      {
        displayName: "Clear Range",
        description: "Clear (delete) all values in a specified range.",
        parametersSchema: {
          type: "object",
          required: ["spreadsheet_id", "range"],
          properties: {
            spreadsheet_id: { type: "string", description: "Spreadsheet ID from the URL." },
            range: { type: "string", description: "A1 notation range to clear, e.g. 'Sheet1!A2:Z1000'." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.clearRange(p.spreadsheet_id as string, p.range as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Google Sheets plugin ready — 5 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "Google Sheets plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
