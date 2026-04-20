import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { JiraClient } from "./jira-client.js";

interface JiraPluginConfig {
  apiTokenRef?: string;
  email?: string;
  domain?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as JiraPluginConfig;

    if (!config.apiTokenRef || !config.email || !config.domain) {
      ctx.logger.error("Jira plugin: apiTokenRef, email, and domain are required");
      return;
    }

    let apiToken: string;
    try {
      apiToken = await ctx.secrets.resolve(config.apiTokenRef);
    } catch (err) {
      ctx.logger.error(`Jira plugin: failed to resolve apiTokenRef: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    ctx.logger.info("Jira plugin: secret resolved, registering tools");
    const client = new JiraClient(config.domain, config.email, apiToken);

    ctx.tools.register(
      "jira_search_issues",
      {
        displayName: "Search Issues",
        description: "Search Jira issues using JQL (Jira Query Language) or plain text.",
        parametersSchema: {
          type: "object",
          properties: {
            jql: { type: "string", description: "JQL query string (e.g. 'project=PROJ AND status=Open')." },
            text: { type: "string", description: "Plain text search (used if jql not provided)." },
            limit: { type: "integer", description: "Max results (default 20).", default: 20 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { jql?: string; text?: string; limit?: number };
          const jql = p.jql ?? (p.text ? `text ~ "${p.text}"` : "order by created DESC");
          const result = await client.searchIssuesJql(jql, p.limit ?? 20);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "jira_get_issue",
      {
        displayName: "Get Issue",
        description: "Get full details for a Jira issue by key (e.g. PROJ-123).",
        parametersSchema: {
          type: "object",
          properties: {
            issue_key: { type: "string", description: "Jira issue key, e.g. PROJ-123." },
          },
          required: ["issue_key"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { issue_key: string };
          const result = await client.getIssue(p.issue_key);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "jira_create_issue",
      {
        displayName: "Create Issue",
        description: "Create a new Jira issue (bug, task, story, etc.) in a project.",
        parametersSchema: {
          type: "object",
          properties: {
            project_key: { type: "string", description: "Project key, e.g. PROJ." },
            summary: { type: "string", description: "Issue title/summary." },
            description: { type: "string", description: "Issue description (plain text or Jira markdown)." },
            issue_type: { type: "string", description: "Issue type name, e.g. Bug, Task, Story.", default: "Task" },
            priority: { type: "string", description: "Priority name, e.g. High, Medium, Low." },
            assignee_account_id: { type: "string", description: "Assignee account ID." },
            labels: { type: "array", items: { type: "string" }, description: "Labels to apply." },
          },
          required: ["project_key", "summary"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const result = await client.createIssue(params as {
            project_key: string;
            summary: string;
            description?: string;
            issue_type?: string;
            priority?: string;
            assignee_account_id?: string;
            labels?: string[];
          });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "jira_update_issue",
      {
        displayName: "Update Issue",
        description: "Update fields on an existing Jira issue (summary, status transition, assignee, priority).",
        parametersSchema: {
          type: "object",
          properties: {
            issue_key: { type: "string", description: "Jira issue key, e.g. PROJ-123." },
            summary: { type: "string", description: "New summary text." },
            description: { type: "string", description: "New description." },
            priority: { type: "string", description: "New priority name." },
            assignee_account_id: { type: "string", description: "New assignee account ID." },
            labels: { type: "array", items: { type: "string" }, description: "Replace labels with this list." },
          },
          required: ["issue_key"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const result = await client.updateIssue(params as {
            issue_key: string;
            summary?: string;
            description?: string;
            priority?: string;
            assignee_account_id?: string;
            labels?: string[];
          });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "jira_transition_issue",
      {
        displayName: "Transition Issue",
        description: "Move a Jira issue to a new workflow status (e.g. In Progress, Done).",
        parametersSchema: {
          type: "object",
          properties: {
            issue_key: { type: "string", description: "Jira issue key, e.g. PROJ-123." },
            transition_name: { type: "string", description: "Target status name, e.g. 'In Progress', 'Done'." },
          },
          required: ["issue_key", "transition_name"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { issue_key: string; transition_name: string };
          const result = await client.transitionIssue(p.issue_key, p.transition_name);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "jira_add_comment",
      {
        displayName: "Add Comment",
        description: "Add a comment to a Jira issue.",
        parametersSchema: {
          type: "object",
          properties: {
            issue_key: { type: "string", description: "Jira issue key, e.g. PROJ-123." },
            comment: { type: "string", description: "Comment text." },
          },
          required: ["issue_key", "comment"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { issue_key: string; comment: string };
          const result = await client.addComment(p.issue_key, p.comment);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "jira_list_projects",
      {
        displayName: "List Projects",
        description: "List all Jira projects accessible to the account.",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Max results (default 50).", default: 50 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { limit?: number };
          const result = await client.listProjects(p.limit ?? 50);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "jira_get_project",
      {
        displayName: "Get Project",
        description: "Get details for a specific Jira project by key.",
        parametersSchema: {
          type: "object",
          properties: {
            project_key: { type: "string", description: "Project key, e.g. PROJ." },
          },
          required: ["project_key"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { project_key: string };
          const result = await client.getProject(p.project_key);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "jira_list_sprints",
      {
        displayName: "List Sprints",
        description: "List sprints for a Jira board (requires Jira Software).",
        parametersSchema: {
          type: "object",
          properties: {
            board_id: { type: "integer", description: "Jira board ID." },
            state: { type: "string", enum: ["active", "closed", "future"], description: "Sprint state filter.", default: "active" },
          },
          required: ["board_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { board_id: number; state?: string };
          const result = await client.listSprints(p.board_id, p.state ?? "active");
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "jira_list_users",
      {
        displayName: "List Users",
        description: "Search for Jira users by name or email (for finding assignee IDs).",
        parametersSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Name or email to search for." },
            limit: { type: "integer", description: "Max results (default 20).", default: 20 },
          },
          required: ["query"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { query: string; limit?: number };
          const result = await client.listUsers(p.query, p.limit ?? 20);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );
  },
});

runWorker(plugin, import.meta.url);
