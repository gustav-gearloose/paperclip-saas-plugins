import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { GraphClient } from "./graph-client.js";

interface OneDrivePluginConfig {
  tenantId?: string;
  userPrincipalName?: string;
  clientIdRef?: string;
  clientSecretRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as OneDrivePluginConfig;
    const { tenantId, userPrincipalName, clientIdRef, clientSecretRef } = config;

    if (!tenantId || !userPrincipalName || !clientIdRef || !clientSecretRef) {
      ctx.logger.error("OneDrive plugin: tenantId, userPrincipalName, clientIdRef, clientSecretRef are all required");
      return;
    }

    let clientId: string, clientSecret: string;
    try {
      [clientId, clientSecret] = await Promise.all([
        ctx.secrets.resolve(clientIdRef),
        ctx.secrets.resolve(clientSecretRef),
      ]);
    } catch (err) {
      ctx.logger.error(`OneDrive plugin: failed to resolve secrets: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    const client = new GraphClient({ tenantId, clientId, clientSecret, defaultUser: userPrincipalName });
    ctx.logger.info(`OneDrive plugin: initialized for ${userPrincipalName}, registering tools`);

    ctx.tools.register(
      "onedrive_list_items",
      {
        displayName: "List Drive Items",
        description: "List files and folders in a OneDrive folder.",
        parametersSchema: {
          type: "object",
          properties: {
            folder_path: { type: "string", description: "Folder path relative to root. Omit for root." },
            drive_id: { type: "string", description: "OneDrive drive ID. Defaults to user's personal drive." },
            limit: { type: "integer", description: "Max items to return (default 50)." },
            user: { type: "string", description: "Override configured userPrincipalName." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const items = await client.listDriveItems(params as Parameters<typeof client.listDriveItems>[0]);
          return { content: JSON.stringify(items, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "onedrive_get_item",
      {
        displayName: "Get Drive Item",
        description: "Get metadata for a specific file or folder by ID or path.",
        parametersSchema: {
          type: "object",
          properties: {
            item_id: { type: "string", description: "OneDrive item ID." },
            item_path: { type: "string", description: "Item path relative to root." },
            drive_id: { type: "string", description: "Drive ID if item is on a non-default drive." },
            user: { type: "string", description: "Override configured userPrincipalName." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const item = await client.getDriveItem(params as Parameters<typeof client.getDriveItem>[0]);
          return { content: JSON.stringify(item, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "onedrive_get_file_content",
      {
        displayName: "Get File Content",
        description: "Download and return the content of a text or JSON file from OneDrive.",
        parametersSchema: {
          type: "object",
          properties: {
            item_id: { type: "string", description: "OneDrive item ID of the file." },
            item_path: { type: "string", description: "File path relative to root." },
            user: { type: "string", description: "Override configured userPrincipalName." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { item_id?: string; item_path?: string; user?: string };
          const content = await client.getFileContent(p);
          return { content };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "onedrive_search",
      {
        displayName: "Search Drive",
        description: "Search for files and folders in OneDrive by name or content.",
        parametersSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query string." },
            limit: { type: "integer", description: "Max results to return (default 25)." },
            user: { type: "string", description: "Override configured userPrincipalName." },
          },
          required: ["query"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const results = await client.searchDrive(params as Parameters<typeof client.searchDrive>[0]);
          return { content: JSON.stringify(results, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "onedrive_create_folder",
      {
        displayName: "Create Folder",
        description: "Create a new folder in OneDrive.",
        parametersSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the new folder." },
            parent_path: { type: "string", description: "Parent folder path. Omit to create at root." },
            parent_id: { type: "string", description: "Parent folder item ID." },
            user: { type: "string", description: "Override configured userPrincipalName." },
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
      "onedrive_upload_file",
      {
        displayName: "Upload File",
        description: "Upload text content as a file to OneDrive.",
        parametersSchema: {
          type: "object",
          properties: {
            file_path: { type: "string", description: "Destination path relative to root." },
            content: { type: "string", description: "File content to upload." },
            content_type: { type: "string", description: "MIME type (default: text/plain)." },
            user: { type: "string", description: "Override configured userPrincipalName." },
          },
          required: ["file_path", "content"],
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
      "onedrive_delete_item",
      {
        displayName: "Delete Item",
        description: "Delete a file or folder from OneDrive.",
        parametersSchema: {
          type: "object",
          properties: {
            item_id: { type: "string", description: "OneDrive item ID to delete." },
            item_path: { type: "string", description: "Item path relative to root." },
            user: { type: "string", description: "Override configured userPrincipalName." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { item_id?: string; item_path?: string; user?: string };
          const result = await client.deleteItem(p);
          return { content: JSON.stringify(result) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "onedrive_move_item",
      {
        displayName: "Move Item",
        description: "Move a file or folder to a different location in OneDrive.",
        parametersSchema: {
          type: "object",
          properties: {
            item_id: { type: "string", description: "OneDrive item ID to move." },
            destination_parent_id: { type: "string", description: "Item ID of the destination folder." },
            new_name: { type: "string", description: "Optional new name after moving." },
            user: { type: "string", description: "Override configured userPrincipalName." },
          },
          required: ["item_id", "destination_parent_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const result = await client.moveItem(params as Parameters<typeof client.moveItem>[0]);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "onedrive_copy_item",
      {
        displayName: "Copy Item",
        description: "Copy a file or folder to a different location in OneDrive.",
        parametersSchema: {
          type: "object",
          properties: {
            item_id: { type: "string", description: "OneDrive item ID to copy." },
            destination_parent_id: { type: "string", description: "Item ID of the destination folder." },
            new_name: { type: "string", description: "Optional new name for the copy." },
            user: { type: "string", description: "Override configured userPrincipalName." },
          },
          required: ["item_id", "destination_parent_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const result = await client.copyItem(params as Parameters<typeof client.copyItem>[0]);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "onedrive_list_drives",
      {
        displayName: "List Drives",
        description: "List available drives for the user (personal OneDrive + SharePoint document libraries).",
        parametersSchema: {
          type: "object",
          properties: {
            user: { type: "string", description: "Override configured userPrincipalName." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { user?: string };
          const drives = await client.listDrives(p);
          return { content: JSON.stringify(drives, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "onedrive_create_sharing_link",
      {
        displayName: "Create Sharing Link",
        description: "Create a sharing link for a file or folder.",
        parametersSchema: {
          type: "object",
          properties: {
            item_id: { type: "string", description: "OneDrive item ID to share." },
            link_type: { type: "string", enum: ["view", "edit", "embed"], description: "Link type (default: view)." },
            scope: { type: "string", enum: ["anonymous", "organization"], description: "Link scope (default: organization)." },
            user: { type: "string", description: "Override configured userPrincipalName." },
          },
          required: ["item_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const result = await client.getSharingLink(params as Parameters<typeof client.getSharingLink>[0]);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("OneDrive plugin ready — 11 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "OneDrive plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
