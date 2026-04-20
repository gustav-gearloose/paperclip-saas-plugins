import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.dropbox",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Dropbox",
  description: "List, read, upload, move, copy, and share files in Dropbox via a long-lived access token.",
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
      accessTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "Dropbox Access Token (secret ref)",
        description: "UUID of a Paperclip secret holding a Dropbox long-lived access token (or refresh token via OAuth2).",
        default: "",
      },
    },
    required: ["accessTokenRef"],
  },
  tools: [
    {
      name: "dropbox_list_folder",
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
    {
      name: "dropbox_get_metadata",
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
    {
      name: "dropbox_search",
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
    {
      name: "dropbox_download",
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
    {
      name: "dropbox_upload",
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
    {
      name: "dropbox_create_folder",
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
    {
      name: "dropbox_delete",
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
    {
      name: "dropbox_move",
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
    {
      name: "dropbox_copy",
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
    {
      name: "dropbox_create_shared_link",
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
    {
      name: "dropbox_list_shared_links",
      displayName: "List Shared Links",
      description: "List existing shared links, optionally filtered to a specific path.",
      parametersSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Filter to links for this path." },
        },
      },
    },
    {
      name: "dropbox_get_account",
      displayName: "Get Account Info",
      description: "Get information about the current Dropbox account and storage usage.",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
  ],
};

export default manifest;
