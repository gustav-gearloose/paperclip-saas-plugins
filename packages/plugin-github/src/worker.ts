import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { GitHubClient } from "./github-client.js";

interface GitHubPluginConfig {
  tokenRef?: string;
  owner?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as GitHubPluginConfig;

    if (!config.tokenRef) {
      ctx.logger.error("GitHub plugin: tokenRef is required");
      return;
    }

    let token: string;
    try {
      token = await ctx.secrets.resolve(config.tokenRef);
    } catch (err) {
      ctx.logger.error(`GitHub plugin: failed to resolve tokenRef: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    ctx.logger.info("GitHub plugin: secret resolved, registering tools");
    const client = new GitHubClient(token, config.owner ?? "");

    ctx.tools.register(
      "github_list_repos",
      {
        displayName: "List Repositories",
        description: "List repositories for a GitHub user or organisation.",
        parametersSchema: {
          type: "object",
          properties: {
            owner: { type: "string", description: "GitHub username or org name (defaults to configured owner)." },
            type: { type: "string", enum: ["all", "public", "private", "forks", "sources", "member"], description: "Repo type filter.", default: "all" },
            limit: { type: "integer", description: "Max results (default 30).", default: 30 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { owner?: string; type?: string; limit?: number };
          const result = await client.listRepos(p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "github_get_repo",
      {
        displayName: "Get Repository",
        description: "Get details for a specific GitHub repository.",
        parametersSchema: {
          type: "object",
          properties: {
            owner: { type: "string", description: "Repository owner (user or org)." },
            repo: { type: "string", description: "Repository name." },
          },
          required: ["repo"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { owner?: string; repo: string };
          const result = await client.getRepo(p.owner, p.repo);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "github_search_issues",
      {
        displayName: "Search Issues",
        description: "Search GitHub issues and pull requests using GitHub's search syntax.",
        parametersSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "GitHub search query, e.g. 'repo:owner/repo is:open label:bug'." },
            limit: { type: "integer", description: "Max results (default 20).", default: 20 },
          },
          required: ["query"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { query: string; limit?: number };
          const result = await client.searchIssues(p.query, p.limit ?? 20);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "github_get_issue",
      {
        displayName: "Get Issue",
        description: "Get details and comments for a specific GitHub issue.",
        parametersSchema: {
          type: "object",
          properties: {
            owner: { type: "string", description: "Repository owner." },
            repo: { type: "string", description: "Repository name." },
            issue_number: { type: "integer", description: "Issue number." },
          },
          required: ["repo", "issue_number"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { owner?: string; repo: string; issue_number: number };
          const result = await client.getIssue(p.owner, p.repo, p.issue_number);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "github_create_issue",
      {
        displayName: "Create Issue",
        description: "Create a new issue in a GitHub repository.",
        parametersSchema: {
          type: "object",
          properties: {
            owner: { type: "string", description: "Repository owner." },
            repo: { type: "string", description: "Repository name." },
            title: { type: "string", description: "Issue title." },
            body: { type: "string", description: "Issue body (markdown supported)." },
            labels: { type: "array", items: { type: "string" }, description: "Labels to apply to the issue." },
            assignees: { type: "array", items: { type: "string" }, description: "GitHub usernames to assign." },
          },
          required: ["repo", "title"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const result = await client.createIssue(params as {
            owner?: string;
            repo: string;
            title: string;
            body?: string;
            labels?: string[];
            assignees?: string[];
          });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "github_list_prs",
      {
        displayName: "List Pull Requests",
        description: "List open (or closed) pull requests for a repository.",
        parametersSchema: {
          type: "object",
          properties: {
            owner: { type: "string", description: "Repository owner." },
            repo: { type: "string", description: "Repository name." },
            state: { type: "string", enum: ["open", "closed", "all"], description: "PR state filter.", default: "open" },
            limit: { type: "integer", description: "Max results (default 20).", default: 20 },
          },
          required: ["repo"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const result = await client.listPRs(params as { owner?: string; repo: string; state?: string; limit?: number });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "github_get_pr",
      {
        displayName: "Get Pull Request",
        description: "Get details for a specific pull request, including diff stats and review status.",
        parametersSchema: {
          type: "object",
          properties: {
            owner: { type: "string", description: "Repository owner." },
            repo: { type: "string", description: "Repository name." },
            pr_number: { type: "integer", description: "Pull request number." },
          },
          required: ["repo", "pr_number"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { owner?: string; repo: string; pr_number: number };
          const result = await client.getPR(p.owner, p.repo, p.pr_number);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "github_add_comment",
      {
        displayName: "Add Comment",
        description: "Add a comment to a GitHub issue or pull request.",
        parametersSchema: {
          type: "object",
          properties: {
            owner: { type: "string", description: "Repository owner." },
            repo: { type: "string", description: "Repository name." },
            issue_number: { type: "integer", description: "Issue or pull request number." },
            body: { type: "string", description: "Comment body (markdown supported)." },
          },
          required: ["repo", "issue_number", "body"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const result = await client.addComment(params as { owner?: string; repo: string; issue_number: number; body: string });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "github_search_code",
      {
        displayName: "Search Code",
        description: "Search for code across GitHub repositories.",
        parametersSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Code search query, e.g. 'useState repo:owner/repo language:typescript'." },
            limit: { type: "integer", description: "Max results (default 10).", default: 10 },
          },
          required: ["query"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { query: string; limit?: number };
          const result = await client.searchCode(p.query, p.limit ?? 10);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "github_list_commits",
      {
        displayName: "List Commits",
        description: "List recent commits for a repository or branch.",
        parametersSchema: {
          type: "object",
          properties: {
            owner: { type: "string", description: "Repository owner." },
            repo: { type: "string", description: "Repository name." },
            branch: { type: "string", description: "Branch name (defaults to the repo default branch)." },
            limit: { type: "integer", description: "Max results (default 20).", default: 20 },
          },
          required: ["repo"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const result = await client.listCommits(params as { owner?: string; repo: string; branch?: string; limit?: number });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );
  },
});

runWorker(plugin, import.meta.url);
