import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { DropboxClient } from "./dropbox-client.js";

interface DropboxPluginConfig {
  accessTokenRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    let cachedClient: DropboxClient | null = null;
    let configError: string | null = null;

    async function getClient(): Promise<DropboxClient | null> {
      if (cachedClient) return cachedClient;
      if (configError) return null;

const config = await ctx.config.get() as DropboxPluginConfig;
      const { accessTokenRef } = config;

      if (!accessTokenRef) {
        configError = "Dropbox plugin: accessTokenRef is required";
        ctx.logger.warn("config missing");
        return null;
      }

      let accessToken: string;
      try {
        accessToken = await ctx.secrets.resolve(accessTokenRef);
      } catch (err) {
        configError = `Dropbox plugin: failed to resolve secret: ${err instanceof Error ? err.message : String(err)}`;
        ctx.logger.warn("config missing");
        return null;
      }

      cachedClient = new DropboxClient(accessToken);
      return cachedClient;
      ctx.logger.info("Dropbox plugin: initialized, registering tools");
    }

    ctx.tools.register(
      "dropbox_list_folder",
      {
        displayName: "List Folder",
        description: "List files and folders in a Dropbox folder.",
        parametersSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Dropbox path to list (e.g. '/Documents'). Omit or use empty string for root." },
            limit: { type: "integer", description: "Max items to return (default 100)." },
            recursive: { type: "boolean", description: "Recursively list all subfolders (default false)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const entries = await client.listFolder(params as Parameters<typeof client.listFolder>[0]);
          return { content: JSON.stringify(entries, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "dropbox_get_metadata",
      {
        displayName: "Get Metadata",
        description: "Get metadata for a file or folder in Dropbox by path.",
        parametersSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Full Dropbox path, e.g. '/Documents/report.pdf'." },
          },
          required: ["path"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.getMetadata(params as Parameters<typeof client.getMetadata>[0]);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "dropbox_search",
      {
        displayName: "Search",
        description: "Search for files and folders in Dropbox by name or content.",
        parametersSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query string." },
            path: { type: "string", description: "Restrict search to this folder path." },
            limit: { type: "integer", description: "Max results (default 20)." },
            file_category: { type: "string", enum: ["document", "spreadsheet", "presentation", "image", "video", "audio", "pdf"], description: "Filter by file type." },
          },
          required: ["query"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const results = await client.search(params as Parameters<typeof client.search>[0]);
          return { content: JSON.stringify(results, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "dropbox_download",
      {
        displayName: "Download File",
        description: "Download and return the content of a file from Dropbox. Returns text for text files, a size summary for binary files.",
        parametersSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Full Dropbox path, e.g. '/Documents/notes.txt'." },
          },
          required: ["path"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { path: string };
          const content = await client.download(p);
          return { content };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "dropbox_upload",
      {
        displayName: "Upload File",
        description: "Upload text content as a file to Dropbox.",
        parametersSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Destination path in Dropbox, e.g. '/Documents/notes.txt'." },
            content: { type: "string", description: "File content to upload." },
            mode: { type: "string", enum: ["add", "overwrite", "update"], description: "Write mode (default: add — fails if file exists)." },
            autorename: { type: "boolean", description: "Auto-rename if path conflicts (default false)." },
          },
          required: ["path", "content"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.upload(params as Parameters<typeof client.upload>[0]);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "dropbox_create_folder",
      {
        displayName: "Create Folder",
        description: "Create a new folder in Dropbox.",
        parametersSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Path for the new folder, e.g. '/Projects/Q2'." },
            autorename: { type: "boolean", description: "Auto-rename if path already exists (default false)." },
          },
          required: ["path"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.createFolder(params as Parameters<typeof client.createFolder>[0]);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "dropbox_delete",
      {
        displayName: "Delete",
        description: "Delete a file or folder from Dropbox.",
        parametersSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Dropbox path to delete." },
          },
          required: ["path"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.delete(params as Parameters<typeof client.delete>[0]);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "dropbox_move",
      {
        displayName: "Move",
        description: "Move a file or folder to a new location in Dropbox.",
        parametersSchema: {
          type: "object",
          properties: {
            from_path: { type: "string", description: "Current path of the file or folder." },
            to_path: { type: "string", description: "Destination path." },
            autorename: { type: "boolean", description: "Auto-rename if destination exists (default false)." },
          },
          required: ["from_path", "to_path"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.move(params as Parameters<typeof client.move>[0]);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "dropbox_copy",
      {
        displayName: "Copy",
        description: "Copy a file or folder to a new location in Dropbox.",
        parametersSchema: {
          type: "object",
          properties: {
            from_path: { type: "string", description: "Source path of the file or folder." },
            to_path: { type: "string", description: "Destination path for the copy." },
            autorename: { type: "boolean", description: "Auto-rename if destination exists (default false)." },
          },
          required: ["from_path", "to_path"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.copy(params as Parameters<typeof client.copy>[0]);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "dropbox_create_shared_link",
      {
        displayName: "Create Shared Link",
        description: "Create a public sharing link for a file or folder. Returns existing link if one already exists.",
        parametersSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Dropbox path to share." },
            requested_visibility: { type: "string", enum: ["public", "team_only", "password"], description: "Link visibility (default: public)." },
          },
          required: ["path"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.createSharedLink(params as Parameters<typeof client.createSharedLink>[0]);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "dropbox_list_shared_links",
      {
        displayName: "List Shared Links",
        description: "List existing shared links, optionally filtered to a specific path.",
        parametersSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Filter to links for this path." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const links = await client.listSharedLinks(params as Parameters<typeof client.listSharedLinks>[0]);
          return { content: JSON.stringify(links, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "dropbox_get_account",
      {
        displayName: "Get Account Info",
        description: "Get information about the current Dropbox account and storage usage.",
        parametersSchema: {
          type: "object",
          properties: {},
        },
      },
      async (): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const [account, usage] = await Promise.all([
            client.getCurrentAccount(),
            client.getSpaceUsage(),
          ]);
          return { content: JSON.stringify({ account, usage }, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Dropbox plugin ready — 12 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "Dropbox plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
