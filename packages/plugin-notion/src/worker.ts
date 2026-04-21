import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { NotionClient } from "./notion-client.js";

interface NotionPluginConfig {
  integrationTokenRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    let cachedClient: NotionClient | null = null;
    let configError: string | null = null;

    async function getClient(): Promise<NotionClient | null> {
      if (cachedClient) return cachedClient;
      if (configError) return null;

const config = await ctx.config.get() as NotionPluginConfig;
      const { integrationTokenRef } = config;

      if (!integrationTokenRef) {
        configError = "Notion plugin: integrationTokenRef is required";
        ctx.logger.warn("config missing");
        return null;
      }

      let integrationToken: string;
      try {
        integrationToken = await ctx.secrets.resolve(integrationTokenRef);
      } catch (err) {
        configError = `Notion plugin: failed to resolve secret: ${err instanceof Error ? err.message : String(err)}`;
        ctx.logger.warn("config missing");
        return null;
      }

      cachedClient = new NotionClient(integrationToken);
      return cachedClient;
      ctx.logger.info("Notion plugin: registering tools");
    }

    ctx.tools.register(
      "notion_search",
      {
        displayName: "Search",
        description: "Search Notion for pages and databases by keyword.",
        parametersSchema: {
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string" },
            filter_type: { type: "string", enum: ["page", "database"] },
            page_size: { type: "integer" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.search(
            p.query as string,
            p.filter_type as "page" | "database" | undefined,
            p.page_size as number | undefined,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "notion_get_page",
      {
        displayName: "Get Page",
        description: "Get metadata and properties for a Notion page by ID.",
        parametersSchema: {
          type: "object",
          required: ["page_id"],
          properties: { page_id: { type: "string" } },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.getPage(p.page_id as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "notion_get_page_content",
      {
        displayName: "Get Page Content",
        description: "Get the block content (body text) of a Notion page.",
        parametersSchema: {
          type: "object",
          required: ["page_id"],
          properties: {
            page_id: { type: "string" },
            page_size: { type: "integer" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.getPageBlocks(
            p.page_id as string,
            p.page_size as number | undefined,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "notion_create_page",
      {
        displayName: "Create Page",
        description: "Create a new Notion page as a child of an existing page.",
        parametersSchema: {
          type: "object",
          required: ["parent_id", "title"],
          properties: {
            parent_id: { type: "string" },
            title: { type: "string" },
            content: { type: "string" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.createPage(
            p.parent_id as string,
            p.title as string,
            p.content as string | undefined,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "notion_append_content",
      {
        displayName: "Append Content",
        description: "Append a paragraph block to an existing Notion page.",
        parametersSchema: {
          type: "object",
          required: ["page_id", "text"],
          properties: {
            page_id: { type: "string" },
            text: { type: "string" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.appendBlocks(
            p.page_id as string,
            p.text as string,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "notion_query_database",
      {
        displayName: "Query Database",
        description: "Query rows from a Notion database, with optional filter and sort.",
        parametersSchema: {
          type: "object",
          required: ["database_id"],
          properties: {
            database_id: { type: "string" },
            filter: { type: "object" },
            sorts: { type: "array" },
            page_size: { type: "integer" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.queryDatabase(
            p.database_id as string,
            p.filter,
            p.sorts as unknown[] | undefined,
            p.page_size as number | undefined,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "notion_get_database",
      {
        displayName: "Get Database",
        description: "Get schema and metadata for a Notion database.",
        parametersSchema: {
          type: "object",
          required: ["database_id"],
          properties: { database_id: { type: "string" } },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.getDatabase(p.database_id as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "notion_create_database_page",
      {
        displayName: "Create Database Row",
        description: "Create a new row (page) in a Notion database with specified property values.",
        parametersSchema: {
          type: "object",
          required: ["database_id", "properties"],
          properties: {
            database_id: { type: "string" },
            properties: { type: "object" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.createDatabasePage(
            p.database_id as string,
            p.properties,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "notion_update_page",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          const data = await client.updatePageTitle(p.page_id as string, p.title as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Notion plugin ready — 9 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "Notion plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
