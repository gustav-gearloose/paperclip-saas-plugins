import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.onedrive",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Microsoft OneDrive",
  description: "Browse, read, upload, and manage files in OneDrive and SharePoint via Microsoft Graph API.",
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
      tenantId: {
        type: "string",
        title: "Azure Tenant ID",
        description: "Your Azure AD tenant ID (Azure Portal → Azure Active Directory → Overview).",
        default: "",
      },
      userPrincipalName: {
        type: "string",
        title: "User Principal Name (UPN)",
        description: "The OneDrive account to access by default, e.g. user@company.com.",
        default: "",
      },
      clientIdRef: {
        type: "string",
        format: "secret-ref",
        title: "App Client ID (secret ref)",
        description: "UUID of a Paperclip secret holding your Azure AD app Client ID.",
        default: "",
      },
      clientSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "App Client Secret (secret ref)",
        description: "UUID of a Paperclip secret holding your Azure AD app Client Secret.",
        default: "",
      },
    },
    required: ["tenantId", "userPrincipalName", "clientIdRef", "clientSecretRef"],
  },
  tools: [
    {
      name: "onedrive_list_items",
      displayName: "List Drive Items",
      description: "List files and folders in a OneDrive folder.",
      parametersSchema: {
        type: "object",
        properties: {
          folder_path: { type: "string", description: "Folder path relative to root (e.g. 'Documents/Reports'). Omit for root." },
          drive_id: { type: "string", description: "OneDrive drive ID (from list_drives). Defaults to user's personal drive." },
          limit: { type: "integer", description: "Max items to return (default 50)." },
          user: { type: "string", description: "Override the configured userPrincipalName." },
        },
      },
    },
    {
      name: "onedrive_get_item",
      displayName: "Get Drive Item",
      description: "Get metadata for a specific file or folder by ID or path.",
      parametersSchema: {
        type: "object",
        properties: {
          item_id: { type: "string", description: "OneDrive item ID." },
          item_path: { type: "string", description: "Item path relative to root (e.g. 'Documents/report.pdf')." },
          drive_id: { type: "string", description: "Drive ID if item is on a non-default drive." },
          user: { type: "string", description: "Override the configured userPrincipalName." },
        },
      },
    },
    {
      name: "onedrive_get_file_content",
      displayName: "Get File Content",
      description: "Download and return the content of a text or JSON file from OneDrive.",
      parametersSchema: {
        type: "object",
        properties: {
          item_id: { type: "string", description: "OneDrive item ID of the file." },
          item_path: { type: "string", description: "File path relative to root (e.g. 'Documents/notes.txt')." },
          user: { type: "string", description: "Override the configured userPrincipalName." },
        },
      },
    },
    {
      name: "onedrive_search",
      displayName: "Search Drive",
      description: "Search for files and folders in OneDrive by name or content.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query string." },
          limit: { type: "integer", description: "Max results to return (default 25)." },
          user: { type: "string", description: "Override the configured userPrincipalName." },
        },
        required: ["query"],
      },
    },
    {
      name: "onedrive_create_folder",
      displayName: "Create Folder",
      description: "Create a new folder in OneDrive.",
      parametersSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the new folder." },
          parent_path: { type: "string", description: "Parent folder path (e.g. 'Documents'). Omit to create at root." },
          parent_id: { type: "string", description: "Parent folder item ID (alternative to parent_path)." },
          user: { type: "string", description: "Override the configured userPrincipalName." },
        },
        required: ["name"],
      },
    },
    {
      name: "onedrive_upload_file",
      displayName: "Upload File",
      description: "Upload text content as a file to OneDrive (overwrites if exists).",
      parametersSchema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Destination path relative to root (e.g. 'Documents/notes.txt')." },
          content: { type: "string", description: "File content to upload." },
          content_type: { type: "string", description: "MIME type (default: text/plain)." },
          user: { type: "string", description: "Override the configured userPrincipalName." },
        },
        required: ["file_path", "content"],
      },
    },
    {
      name: "onedrive_delete_item",
      displayName: "Delete Item",
      description: "Delete a file or folder from OneDrive.",
      parametersSchema: {
        type: "object",
        properties: {
          item_id: { type: "string", description: "OneDrive item ID to delete." },
          item_path: { type: "string", description: "Item path relative to root." },
          user: { type: "string", description: "Override the configured userPrincipalName." },
        },
      },
    },
    {
      name: "onedrive_move_item",
      displayName: "Move Item",
      description: "Move a file or folder to a different location in OneDrive.",
      parametersSchema: {
        type: "object",
        properties: {
          item_id: { type: "string", description: "OneDrive item ID to move." },
          destination_parent_id: { type: "string", description: "Item ID of the destination folder." },
          new_name: { type: "string", description: "Optional new name for the item after moving." },
          user: { type: "string", description: "Override the configured userPrincipalName." },
        },
        required: ["item_id", "destination_parent_id"],
      },
    },
    {
      name: "onedrive_copy_item",
      displayName: "Copy Item",
      description: "Copy a file or folder to a different location in OneDrive.",
      parametersSchema: {
        type: "object",
        properties: {
          item_id: { type: "string", description: "OneDrive item ID to copy." },
          destination_parent_id: { type: "string", description: "Item ID of the destination folder." },
          new_name: { type: "string", description: "Optional new name for the copy." },
          user: { type: "string", description: "Override the configured userPrincipalName." },
        },
        required: ["item_id", "destination_parent_id"],
      },
    },
    {
      name: "onedrive_list_drives",
      displayName: "List Drives",
      description: "List available drives for the user (personal OneDrive + SharePoint document libraries).",
      parametersSchema: {
        type: "object",
        properties: {
          user: { type: "string", description: "Override the configured userPrincipalName." },
        },
      },
    },
    {
      name: "onedrive_create_sharing_link",
      displayName: "Create Sharing Link",
      description: "Create a sharing link for a file or folder.",
      parametersSchema: {
        type: "object",
        properties: {
          item_id: { type: "string", description: "OneDrive item ID to share." },
          link_type: { type: "string", enum: ["view", "edit", "embed"], description: "Type of sharing link (default: view)." },
          scope: { type: "string", enum: ["anonymous", "organization"], description: "Link scope (default: organization)." },
          user: { type: "string", description: "Override the configured userPrincipalName." },
        },
        required: ["item_id"],
      },
    },
  ],
};

export default manifest;
