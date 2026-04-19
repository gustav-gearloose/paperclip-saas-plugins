import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { LinearClient } from "./linear-client.js";

interface LinearPluginConfig {
  apiKeyRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as LinearPluginConfig;
    const { apiKeyRef } = config;

    if (!apiKeyRef) {
      ctx.logger.error("Linear plugin: apiKeyRef is required");
      return;
    }

    let apiKey: string;
    try {
      apiKey = await ctx.secrets.resolve(apiKeyRef);
    } catch (err) {
      ctx.logger.error(`Linear plugin: failed to resolve secret: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    const client = new LinearClient(apiKey);
    ctx.logger.info("Linear plugin: registering tools");

    ctx.tools.register(
      "linear_list_issues",
      {
        displayName: "List Issues",
        description: "List Linear issues, optionally filtered by team and state.",
        parametersSchema: {
          type: "object",
          properties: {
            team_id: { type: "string" },
            states: { type: "array", items: { type: "string" } },
            first: { type: "integer" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listIssues(
            p.team_id as string | undefined,
            p.states as string[] | undefined,
            p.first as number | undefined,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "linear_get_issue",
      {
        displayName: "Get Issue",
        description: "Get full details for a specific Linear issue by ID.",
        parametersSchema: {
          type: "object",
          required: ["issue_id"],
          properties: { issue_id: { type: "string" } },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.getIssue(p.issue_id as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "linear_search_issues",
      {
        displayName: "Search Issues",
        description: "Full-text search across all Linear issues.",
        parametersSchema: {
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string" },
            first: { type: "integer" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.searchIssues(
            p.query as string,
            p.first as number | undefined,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "linear_create_issue",
      {
        displayName: "Create Issue",
        description: "Create a new Linear issue in a team.",
        parametersSchema: {
          type: "object",
          required: ["team_id", "title"],
          properties: {
            team_id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            priority: { type: "integer" },
            assignee_id: { type: "string" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.createIssue(
            p.team_id as string,
            p.title as string,
            p.description as string | undefined,
            p.priority as number | undefined,
            p.assignee_id as string | undefined,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "linear_update_issue",
      {
        displayName: "Update Issue",
        description: "Update an existing Linear issue.",
        parametersSchema: {
          type: "object",
          required: ["issue_id", "update"],
          properties: {
            issue_id: { type: "string" },
            update: { type: "object" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.updateIssue(
            p.issue_id as string,
            p.update as Record<string, unknown>,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "linear_add_comment",
      {
        displayName: "Add Comment",
        description: "Add a comment to a Linear issue.",
        parametersSchema: {
          type: "object",
          required: ["issue_id", "body"],
          properties: {
            issue_id: { type: "string" },
            body: { type: "string" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.addComment(
            p.issue_id as string,
            p.body as string,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "linear_list_teams",
      {
        displayName: "List Teams",
        description: "List all teams in the Linear workspace.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const data = await client.listTeams();
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "linear_list_projects",
      {
        displayName: "List Projects",
        description: "List Linear projects, optionally filtered by team.",
        parametersSchema: {
          type: "object",
          properties: { team_id: { type: "string" } },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listProjects(p.team_id as string | undefined);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "linear_list_members",
      {
        displayName: "List Members",
        description: "List all members of the Linear workspace.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const data = await client.listMembers();
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Linear plugin ready — 9 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "Linear plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
