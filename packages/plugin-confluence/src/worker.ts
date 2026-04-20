import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { ConfluenceClient } from "./confluence-client.js";

interface ConfluencePluginConfig {
  apiTokenRef?: string;
  email?: string;
  domain?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as ConfluencePluginConfig;

    if (!config.apiTokenRef || !config.email || !config.domain) {
      ctx.logger.error("Confluence plugin: apiTokenRef, email, and domain are required");
      return;
    }

    let apiToken: string;
    try {
      apiToken = await ctx.secrets.resolve(config.apiTokenRef);
    } catch (err) {
      ctx.logger.error(`Confluence plugin: failed to resolve apiTokenRef: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    const client = new ConfluenceClient(config.domain, config.email, apiToken);
    ctx.logger.info(`Confluence plugin: initialized for ${config.domain}.atlassian.net, registering tools`);

    ctx.tools.register(
      "confluence_search_pages",
      {
        displayName: "Search Pages by Title",
        description: "Search Confluence pages by title, optionally filtered to a specific space.",
        parametersSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Title search string." },
            space_key: { type: "string", description: "Limit search to this space key (e.g. ENG)." },
            limit: { type: "integer", description: "Max results (default 25)." },
          },
          required: ["query"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const results = await client.searchPages(params as Parameters<typeof client.searchPages>[0]);
          return { content: JSON.stringify(results, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "confluence_search_content",
      {
        displayName: "Search Content (CQL)",
        description: "Full-text search across Confluence using CQL (Confluence Query Language).",
        parametersSchema: {
          type: "object",
          properties: {
            cql: { type: "string", description: "CQL query, e.g. 'text ~ \"onboarding\" AND space.key = ENG'." },
            limit: { type: "integer", description: "Max results (default 25)." },
          },
          required: ["cql"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const results = await client.searchContent(params as Parameters<typeof client.searchContent>[0]);
          return { content: JSON.stringify(results, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "confluence_get_page",
      {
        displayName: "Get Page",
        description: "Get a Confluence page by ID, including its body content.",
        parametersSchema: {
          type: "object",
          properties: {
            page_id: { type: "string", description: "Confluence page ID." },
            include_body: { type: "boolean", description: "Include page body (default true)." },
          },
          required: ["page_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const page = await client.getPage(params as Parameters<typeof client.getPage>[0]);
          return { content: JSON.stringify(page, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "confluence_get_page_by_title",
      {
        displayName: "Get Page by Title",
        description: "Find a Confluence page by exact title within a space.",
        parametersSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Exact page title." },
            space_key: { type: "string", description: "Space key to search in (e.g. ENG)." },
          },
          required: ["title", "space_key"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { title: string; space_key: string };
          const page = await client.getPageByTitle(p);
          return { content: JSON.stringify(page, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "confluence_create_page",
      {
        displayName: "Create Page",
        description: "Create a new Confluence page in a space, optionally as a child of another page.",
        parametersSchema: {
          type: "object",
          properties: {
            space_id: { type: "string", description: "Space ID to create the page in." },
            title: { type: "string", description: "Page title." },
            body: { type: "string", description: "Page body in Confluence Storage Format (XHTML-like) or plain text." },
            parent_id: { type: "string", description: "Parent page ID (omit to create at space root)." },
          },
          required: ["space_id", "title", "body"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const page = await client.createPage(params as Parameters<typeof client.createPage>[0]);
          return { content: JSON.stringify(page, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "confluence_update_page",
      {
        displayName: "Update Page",
        description: "Update the title and/or body of an existing Confluence page.",
        parametersSchema: {
          type: "object",
          properties: {
            page_id: { type: "string", description: "Confluence page ID to update." },
            title: { type: "string", description: "New page title." },
            body: { type: "string", description: "New page body in Confluence Storage Format." },
            version: { type: "integer", description: "Current page version number (required by Confluence API)." },
          },
          required: ["page_id", "title", "body", "version"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const page = await client.updatePage(params as Parameters<typeof client.updatePage>[0]);
          return { content: JSON.stringify(page, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "confluence_delete_page",
      {
        displayName: "Delete Page",
        description: "Delete a Confluence page by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            page_id: { type: "string", description: "Confluence page ID to delete." },
          },
          required: ["page_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { page_id: string };
          const result = await client.deletePage(p.page_id);
          return { content: JSON.stringify(result) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "confluence_list_children",
      {
        displayName: "List Child Pages",
        description: "List direct child pages of a Confluence page.",
        parametersSchema: {
          type: "object",
          properties: {
            page_id: { type: "string", description: "Parent page ID." },
            limit: { type: "integer", description: "Max results (default 25)." },
          },
          required: ["page_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const results = await client.listChildren(params as Parameters<typeof client.listChildren>[0]);
          return { content: JSON.stringify(results, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "confluence_list_spaces",
      {
        displayName: "List Spaces",
        description: "List Confluence spaces (knowledge bases).",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Max results (default 50)." },
            type: { type: "string", enum: ["global", "personal"], description: "Filter by space type." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const results = await client.listSpaces(params as Parameters<typeof client.listSpaces>[0]);
          return { content: JSON.stringify(results, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "confluence_get_space",
      {
        displayName: "Get Space",
        description: "Get details for a specific Confluence space by key.",
        parametersSchema: {
          type: "object",
          properties: {
            space_key: { type: "string", description: "Space key, e.g. ENG." },
          },
          required: ["space_key"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { space_key: string };
          const space = await client.getSpace(p.space_key);
          return { content: JSON.stringify(space, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "confluence_add_comment",
      {
        displayName: "Add Comment",
        description: "Add a footer comment to a Confluence page.",
        parametersSchema: {
          type: "object",
          properties: {
            page_id: { type: "string", description: "Confluence page ID." },
            body: { type: "string", description: "Comment text (plain text or Confluence Storage Format)." },
          },
          required: ["page_id", "body"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const result = await client.addComment(params as Parameters<typeof client.addComment>[0]);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "confluence_list_comments",
      {
        displayName: "List Comments",
        description: "List footer comments on a Confluence page.",
        parametersSchema: {
          type: "object",
          properties: {
            page_id: { type: "string", description: "Confluence page ID." },
            limit: { type: "integer", description: "Max results (default 25)." },
          },
          required: ["page_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const results = await client.listComments(params as Parameters<typeof client.listComments>[0]);
          return { content: JSON.stringify(results, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Confluence plugin ready — 12 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "Confluence plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
