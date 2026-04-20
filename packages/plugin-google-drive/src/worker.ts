import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { GoogleDriveClient } from "./drive-client.js";

interface DrivePluginConfig {
  delegatedUser?: string;
  serviceAccountJsonRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as DrivePluginConfig;
    const { delegatedUser, serviceAccountJsonRef } = config;

    if (!serviceAccountJsonRef) {
      ctx.logger.error("Google Drive plugin: serviceAccountJsonRef is required");
      return;
    }

    let serviceAccountJson: string;
    try {
      serviceAccountJson = await ctx.secrets.resolve(serviceAccountJsonRef);
    } catch (err) {
      ctx.logger.error(`Google Drive plugin: failed to resolve secret: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    const client = new GoogleDriveClient(serviceAccountJson, delegatedUser ?? "");
    ctx.logger.info(`Google Drive plugin: initialized${delegatedUser ? ` for ${delegatedUser}` : " as service account"}, registering tools`);

    ctx.tools.register(
      "drive_list_files",
      {
        displayName: "List Files",
        description: "List files and folders in Google Drive, optionally filtered by folder, MIME type, or name.",
        parametersSchema: {
          type: "object",
          properties: {
            folder_id: { type: "string", description: "Google Drive folder ID to list (omit for all files)." },
            query: { type: "string", description: "Filter by name contains (case-insensitive)." },
            mime_type: { type: "string", description: "Filter by MIME type." },
            limit: { type: "integer", description: "Max files to return (default 50)." },
            order_by: { type: "string", description: "Sort order (default: modifiedTime desc)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const files = await client.listFiles(params as Parameters<typeof client.listFiles>[0]);
          return { content: JSON.stringify(files, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "drive_get_file",
      {
        displayName: "Get File",
        description: "Get metadata for a specific file or folder by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            file_id: { type: "string", description: "Google Drive file ID." },
          },
          required: ["file_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { file_id: string };
          const file = await client.getFile(p.file_id);
          return { content: JSON.stringify(file, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "drive_get_file_content",
      {
        displayName: "Get File Content",
        description: "Download and return the content of a file. Google Docs/Sheets are exported as plain text.",
        parametersSchema: {
          type: "object",
          properties: {
            file_id: { type: "string", description: "Google Drive file ID." },
          },
          required: ["file_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { file_id: string };
          const content = await client.getFileContent(p.file_id);
          return { content };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "drive_search_files",
      {
        displayName: "Search Files",
        description: "Full-text search across file names and content in Google Drive.",
        parametersSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query string." },
            limit: { type: "integer", description: "Max results to return (default 25)." },
          },
          required: ["query"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const files = await client.searchFiles(params as Parameters<typeof client.searchFiles>[0]);
          return { content: JSON.stringify(files, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "drive_create_folder",
      {
        displayName: "Create Folder",
        description: "Create a new folder in Google Drive.",
        parametersSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the new folder." },
            parent_id: { type: "string", description: "Parent folder ID (omit to create at root)." },
          },
          required: ["name"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const folder = await client.createFolder(params as Parameters<typeof client.createFolder>[0]);
          return { content: JSON.stringify(folder, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "drive_upload_file",
      {
        displayName: "Upload File",
        description: "Upload text content as a new file to Google Drive.",
        parametersSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "File name including extension." },
            content: { type: "string", description: "Text content to upload." },
            mime_type: { type: "string", description: "MIME type (default: text/plain)." },
            parent_id: { type: "string", description: "Parent folder ID (omit to place at root)." },
          },
          required: ["name", "content"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const result = await client.uploadFile(params as Parameters<typeof client.uploadFile>[0]);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "drive_update_file",
      {
        displayName: "Update File Content",
        description: "Replace the content of an existing file in Google Drive.",
        parametersSchema: {
          type: "object",
          properties: {
            file_id: { type: "string", description: "Google Drive file ID to update." },
            content: { type: "string", description: "New content to write to the file." },
            mime_type: { type: "string", description: "MIME type of the new content (default: text/plain)." },
          },
          required: ["file_id", "content"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const result = await client.updateFile(params as Parameters<typeof client.updateFile>[0]);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "drive_delete_file",
      {
        displayName: "Delete File",
        description: "Permanently delete a file or folder from Google Drive.",
        parametersSchema: {
          type: "object",
          properties: {
            file_id: { type: "string", description: "Google Drive file ID to delete." },
          },
          required: ["file_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { file_id: string };
          const result = await client.deleteFile(p.file_id);
          return { content: JSON.stringify(result) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "drive_move_file",
      {
        displayName: "Move File",
        description: "Move a file or folder to a different folder in Google Drive.",
        parametersSchema: {
          type: "object",
          properties: {
            file_id: { type: "string", description: "Google Drive file ID to move." },
            new_parent_id: { type: "string", description: "ID of the destination folder." },
            remove_parent_id: { type: "string", description: "ID of the current parent (auto-detected if omitted)." },
          },
          required: ["file_id", "new_parent_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const result = await client.moveFile(params as Parameters<typeof client.moveFile>[0]);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "drive_copy_file",
      {
        displayName: "Copy File",
        description: "Create a copy of a file in Google Drive.",
        parametersSchema: {
          type: "object",
          properties: {
            file_id: { type: "string", description: "Google Drive file ID to copy." },
            name: { type: "string", description: "Name for the copy." },
            parent_id: { type: "string", description: "Folder ID for the copy." },
          },
          required: ["file_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const result = await client.copyFile(params as Parameters<typeof client.copyFile>[0]);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "drive_share_file",
      {
        displayName: "Share File",
        description: "Share a file or folder by creating a permission.",
        parametersSchema: {
          type: "object",
          properties: {
            file_id: { type: "string", description: "Google Drive file ID to share." },
            role: { type: "string", enum: ["reader", "commenter", "writer"], description: "Permission role (default: reader)." },
            type: { type: "string", enum: ["user", "group", "domain", "anyone"], description: "Permission type (default: domain)." },
          },
          required: ["file_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const result = await client.createSharingLink(params as Parameters<typeof client.createSharingLink>[0]);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "drive_list_shared_with_me",
      {
        displayName: "List Shared With Me",
        description: "List files and folders that have been shared with the user.",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Max items to return (default 25)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const files = await client.listSharedWithMe(params as Parameters<typeof client.listSharedWithMe>[0]);
          return { content: JSON.stringify(files, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "drive_get_about",
      {
        displayName: "Get Storage Info",
        description: "Get information about the Drive user and storage quota.",
        parametersSchema: {
          type: "object",
          properties: {},
        },
      },
      async (): Promise<ToolResult> => {
        try {
          const about = await client.getAbout();
          return { content: JSON.stringify(about, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Google Drive plugin ready — 13 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "Google Drive plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
