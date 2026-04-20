import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.google-drive",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Google Drive",
  description: "List, read, upload, move, and share files in Google Drive via service account.",
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
      delegatedUser: {
        type: "string",
        title: "Delegated User Email",
        description: "Email of the Google Workspace user to impersonate (domain-wide delegation). Leave empty to act as the service account itself.",
        default: "",
      },
      serviceAccountJsonRef: {
        type: "string",
        format: "secret-ref",
        title: "Service Account JSON (secret ref)",
        description: "UUID of a Paperclip secret containing the full Google service account JSON key file.",
        default: "",
      },
    },
    required: ["serviceAccountJsonRef"],
  },
  tools: [
    {
      name: "drive_list_files",
      displayName: "List Files",
      description: "List files and folders in Google Drive, optionally filtered by folder, MIME type, or name.",
      parametersSchema: {
        type: "object",
        properties: {
          folder_id: { type: "string", description: "Google Drive folder ID to list (omit for all files)." },
          query: { type: "string", description: "Filter by name contains (case-insensitive)." },
          mime_type: { type: "string", description: "Filter by MIME type (e.g. 'application/vnd.google-apps.document')." },
          limit: { type: "integer", description: "Max files to return (default 50)." },
          order_by: { type: "string", description: "Sort order (default: modifiedTime desc)." },
        },
      },
    },
    {
      name: "drive_get_file",
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
    {
      name: "drive_get_file_content",
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
    {
      name: "drive_search_files",
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
    {
      name: "drive_create_folder",
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
    {
      name: "drive_upload_file",
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
    {
      name: "drive_update_file",
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
    {
      name: "drive_delete_file",
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
    {
      name: "drive_move_file",
      displayName: "Move File",
      description: "Move a file or folder to a different folder in Google Drive.",
      parametersSchema: {
        type: "object",
        properties: {
          file_id: { type: "string", description: "Google Drive file ID to move." },
          new_parent_id: { type: "string", description: "ID of the destination folder." },
          remove_parent_id: { type: "string", description: "ID of the current parent to remove (auto-detected if omitted)." },
        },
        required: ["file_id", "new_parent_id"],
      },
    },
    {
      name: "drive_copy_file",
      displayName: "Copy File",
      description: "Create a copy of a file in Google Drive.",
      parametersSchema: {
        type: "object",
        properties: {
          file_id: { type: "string", description: "Google Drive file ID to copy." },
          name: { type: "string", description: "Name for the copy (defaults to 'Copy of <original>')." },
          parent_id: { type: "string", description: "Folder ID for the copy (defaults to same folder as original)." },
        },
        required: ["file_id"],
      },
    },
    {
      name: "drive_share_file",
      displayName: "Share File",
      description: "Share a file or folder by creating a permission (reader/writer, domain/anyone).",
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
    {
      name: "drive_list_shared_with_me",
      displayName: "List Shared With Me",
      description: "List files and folders that have been shared with the user.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Max items to return (default 25)." },
        },
      },
    },
    {
      name: "drive_get_about",
      displayName: "Get Storage Info",
      description: "Get information about the Drive user and storage quota.",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
  ],
};

export default manifest;
