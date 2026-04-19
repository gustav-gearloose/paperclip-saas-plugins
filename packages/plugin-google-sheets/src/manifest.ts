import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.google-sheets",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Google Sheets",
  description: "Read and write Google Sheets via a service account. List sheets, read ranges, write values, append rows.",
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
      serviceAccountJsonRef: {
        type: "string",
        format: "secret-ref",
        title: "Service Account JSON (secret ref)",
        description:
          "UUID of a Paperclip secret holding the full Google service account JSON key (from Google Cloud Console → Service Accounts → Keys → JSON).",
        default: "",
      },
    },
    required: ["serviceAccountJsonRef"],
  },
  tools: [
    {
      name: "sheets_read_range",
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
    {
      name: "sheets_write_range",
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
    {
      name: "sheets_append_rows",
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
    {
      name: "sheets_get_spreadsheet_info",
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
    {
      name: "sheets_clear_range",
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
  ],
};

export default manifest;
