import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.typeform",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Typeform",
  description: "Typeform surveys — list forms, read responses, delete responses, and view form insights.",
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
        title: "Personal Access Token (secret ref)",
        description: "UUID of a Paperclip secret holding your Typeform personal access token.",
        default: "",
      },
    },
    required: ["apiTokenRef"],
  },
  tools: [
    {
      name: "typeform_list_forms",
      displayName: "List Forms",
      description: "List all Typeform forms in the account.",
      parametersSchema: {
        type: "object",
        properties: {
          page: { type: "integer", description: "Page number (default 1).", default: 1 },
          page_size: { type: "integer", description: "Results per page (max 200, default 10).", default: 10 },
          search: { type: "string", description: "Search term to filter forms by title." },
        },
      },
    },
    {
      name: "typeform_get_form",
      displayName: "Get Form",
      description: "Get full definition of a Typeform form including all questions and fields.",
      parametersSchema: {
        type: "object",
        properties: {
          form_id: { type: "string", description: "Typeform form ID." },
        },
        required: ["form_id"],
      },
    },
    {
      name: "typeform_list_responses",
      displayName: "List Responses",
      description: "List responses for a Typeform form, with optional date and completion filters.",
      parametersSchema: {
        type: "object",
        properties: {
          form_id: { type: "string", description: "Typeform form ID." },
          page_size: { type: "integer", description: "Number of responses to return (max 1000, default 25).", default: 25 },
          since: { type: "string", description: "Return responses submitted after this ISO 8601 datetime." },
          until: { type: "string", description: "Return responses submitted before this ISO 8601 datetime." },
          after: { type: "string", description: "Cursor token to paginate forward." },
          before: { type: "string", description: "Cursor token to paginate backward." },
          query: { type: "string", description: "Full text search across response answers." },
          completed: { type: "boolean", description: "Filter by completion status." },
          sort: { type: "string", description: "Sort order: submitted_at,desc or submitted_at,asc." },
        },
        required: ["form_id"],
      },
    },
    {
      name: "typeform_delete_responses",
      displayName: "Delete Responses",
      description: "Delete one or more responses from a Typeform form by response ID.",
      parametersSchema: {
        type: "object",
        properties: {
          form_id: { type: "string", description: "Typeform form ID." },
          response_ids: { type: "array", items: { type: "string" }, description: "List of response IDs to delete." },
        },
        required: ["form_id", "response_ids"],
      },
    },
    {
      name: "typeform_list_webhooks",
      displayName: "List Webhooks",
      description: "List all webhooks configured for a Typeform form.",
      parametersSchema: {
        type: "object",
        properties: {
          form_id: { type: "string", description: "Typeform form ID." },
        },
        required: ["form_id"],
      },
    },
    {
      name: "typeform_get_insights",
      displayName: "Get Form Insights",
      description: "Get summary statistics and insights for a Typeform form.",
      parametersSchema: {
        type: "object",
        properties: {
          form_id: { type: "string", description: "Typeform form ID." },
        },
        required: ["form_id"],
      },
    },
  ],
};

export default manifest;
