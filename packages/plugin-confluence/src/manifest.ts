import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.confluence",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Confluence",
  description: "Read, create, and update Confluence pages and spaces in your Atlassian knowledge base.",
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
      apiTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "Atlassian API Token (secret ref)",
        description: "UUID of a Paperclip secret holding your Atlassian API token.",
        default: "",
      },
      email: {
        type: "string",
        title: "Atlassian account email",
        description: "Email address of the Atlassian account that owns the API token.",
        default: "",
      },
      domain: {
        type: "string",
        title: "Atlassian domain",
        description: "Your Atlassian domain prefix, e.g. 'mycompany' (from mycompany.atlassian.net).",
        default: "",
      },
    },
    required: ["apiTokenRef", "email", "domain"],
  },
  tools: [
    {
      name: "confluence_search_pages",
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
    {
      name: "confluence_search_content",
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
    {
      name: "confluence_get_page",
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
    {
      name: "confluence_get_page_by_title",
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
    {
      name: "confluence_create_page",
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
    {
      name: "confluence_update_page",
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
    {
      name: "confluence_delete_page",
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
    {
      name: "confluence_list_children",
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
    {
      name: "confluence_list_spaces",
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
    {
      name: "confluence_get_space",
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
    {
      name: "confluence_add_comment",
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
    {
      name: "confluence_list_comments",
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
  ],
};

export default manifest;
