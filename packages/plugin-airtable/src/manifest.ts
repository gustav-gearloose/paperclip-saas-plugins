import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.airtable",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Airtable",
  description: "Airtable database — list bases, tables, and records; create, update, and delete records.",
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
      apiKeyRef: {
        type: "string",
        format: "secret-ref",
        title: "Personal Access Token (secret ref)",
        description: "UUID of a Paperclip secret holding your Airtable personal access token.",
        default: "",
      },
    },
    required: ["apiKeyRef"],
  },
  tools: [
    {
      name: "airtable_list_bases",
      displayName: "List Bases",
      description: "List all Airtable bases the authenticated user has access to.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "airtable_list_tables",
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
    {
      name: "airtable_list_records",
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
    {
      name: "airtable_get_record",
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
    {
      name: "airtable_create_record",
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
    {
      name: "airtable_update_record",
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
    {
      name: "airtable_delete_record",
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
    {
      name: "airtable_search_records",
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
  ],
};

export default manifest;
