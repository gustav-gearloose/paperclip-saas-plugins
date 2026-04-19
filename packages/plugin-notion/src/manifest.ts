import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.notion",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Notion",
  description: "Search pages, read and write content, and query databases in Notion.",
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
      integrationTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "Notion Integration Token (secret ref)",
        description:
          "UUID of a Paperclip secret holding your Notion internal integration token (secret_...). Create one at notion.so/my-integrations.",
        default: "",
      },
    },
    required: ["integrationTokenRef"],
  },
  tools: [
    {
      name: "notion_search",
      displayName: "Search",
      description: "Search Notion for pages and databases by keyword.",
      parametersSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string", description: "Search query." },
          filter_type: { type: "string", enum: ["page", "database"], description: "Optionally restrict to pages or databases." },
          page_size: { type: "integer", description: "Max results (default 20)." },
        },
      },
    },
    {
      name: "notion_get_page",
      displayName: "Get Page",
      description: "Get metadata and properties for a Notion page by ID.",
      parametersSchema: {
        type: "object",
        required: ["page_id"],
        properties: {
          page_id: { type: "string", description: "Notion page ID (UUID with or without dashes)." },
        },
      },
    },
    {
      name: "notion_get_page_content",
      displayName: "Get Page Content",
      description: "Get the block content (body text) of a Notion page.",
      parametersSchema: {
        type: "object",
        required: ["page_id"],
        properties: {
          page_id: { type: "string", description: "Notion page ID." },
          page_size: { type: "integer", description: "Max blocks to return (default 50)." },
        },
      },
    },
    {
      name: "notion_create_page",
      displayName: "Create Page",
      description: "Create a new Notion page as a child of an existing page.",
      parametersSchema: {
        type: "object",
        required: ["parent_id", "title"],
        properties: {
          parent_id: { type: "string", description: "ID of the parent page." },
          title: { type: "string", description: "Title of the new page." },
          content: { type: "string", description: "Optional initial paragraph text." },
        },
      },
    },
    {
      name: "notion_append_content",
      displayName: "Append Content",
      description: "Append a paragraph block to an existing Notion page or block.",
      parametersSchema: {
        type: "object",
        required: ["page_id", "text"],
        properties: {
          page_id: { type: "string", description: "ID of the page to append to." },
          text: { type: "string", description: "Text content to append as a paragraph." },
        },
      },
    },
    {
      name: "notion_query_database",
      displayName: "Query Database",
      description: "Query rows from a Notion database, with optional filter and sort.",
      parametersSchema: {
        type: "object",
        required: ["database_id"],
        properties: {
          database_id: { type: "string", description: "Notion database ID." },
          filter: { type: "object", description: "Notion filter object (see Notion API docs)." },
          sorts: { type: "array", description: "Array of sort objects." },
          page_size: { type: "integer", description: "Max rows to return (default 20)." },
        },
      },
    },
    {
      name: "notion_get_database",
      displayName: "Get Database",
      description: "Get schema and metadata for a Notion database.",
      parametersSchema: {
        type: "object",
        required: ["database_id"],
        properties: {
          database_id: { type: "string", description: "Notion database ID." },
        },
      },
    },
    {
      name: "notion_create_database_page",
      displayName: "Create Database Row",
      description: "Create a new row (page) in a Notion database with specified property values.",
      parametersSchema: {
        type: "object",
        required: ["database_id", "properties"],
        properties: {
          database_id: { type: "string", description: "Notion database ID." },
          properties: { type: "object", description: "Property values object matching the database schema (Notion API format)." },
        },
      },
    },
    {
      name: "notion_update_page",
      displayName: "Update Page Title",
      description: "Update the title of an existing Notion page.",
      parametersSchema: {
        type: "object",
        required: ["page_id", "title"],
        properties: {
          page_id: { type: "string", description: "Notion page ID." },
          title: { type: "string", description: "New title for the page." },
        },
      },
    },
  ],
};

export default manifest;
