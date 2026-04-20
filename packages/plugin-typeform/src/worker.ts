import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { TypeformClient } from "./typeform-client.js";

interface TypeformPluginConfig {
  apiTokenRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as TypeformPluginConfig;

    if (!config.apiTokenRef) {
      ctx.logger.error("Typeform plugin: apiTokenRef is required");
      return;
    }

    let apiToken: string;
    try {
      apiToken = await ctx.secrets.resolve(config.apiTokenRef);
    } catch (err) {
      ctx.logger.error(`Typeform plugin: failed to resolve apiTokenRef: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    ctx.logger.info("Typeform plugin: secret resolved, registering tools");
    const client = new TypeformClient(apiToken);

    ctx.tools.register(
      "typeform_list_forms",
      {
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
      async (params): Promise<ToolResult> => {
        const { page, page_size, search } = params as { page?: number; page_size?: number; search?: string };
        try {
          const result = await client.listForms({ page, page_size, search });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "typeform_get_form",
      {
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
      async (params): Promise<ToolResult> => {
        const { form_id } = params as { form_id: string };
        try {
          const result = await client.getForm(form_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "typeform_list_responses",
      {
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
      async (params): Promise<ToolResult> => {
        const { form_id, page_size, since, until, after, before, query, completed, sort } = params as {
          form_id: string; page_size?: number; since?: string; until?: string; after?: string;
          before?: string; query?: string; completed?: boolean; sort?: string;
        };
        try {
          const result = await client.listResponses(form_id, { page_size, since, until, after, before, query, completed, sort });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "typeform_delete_responses",
      {
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
      async (params): Promise<ToolResult> => {
        const { form_id, response_ids } = params as { form_id: string; response_ids: string[] };
        try {
          const result = await client.deleteResponse(form_id, response_ids);
          return { content: JSON.stringify(result ?? { deleted: true }, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "typeform_list_webhooks",
      {
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
      async (params): Promise<ToolResult> => {
        const { form_id } = params as { form_id: string };
        try {
          const result = await client.listWebhooks(form_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "typeform_get_insights",
      {
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
      async (params): Promise<ToolResult> => {
        const { form_id } = params as { form_id: string };
        try {
          const result = await client.getInsights(form_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Typeform plugin: all tools registered");
  },
});

runWorker(plugin, import.meta.url);
