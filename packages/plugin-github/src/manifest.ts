import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.github",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "GitHub",
  description: "Access GitHub repositories, issues, pull requests, and code search.",
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
      tokenRef: {
        type: "string",
        format: "secret-ref",
        title: "GitHub Personal Access Token (ref)",
        description: "UUID of a Paperclip secret holding a GitHub personal access token (classic or fine-grained).",
        default: "",
      },
      owner: {
        type: "string",
        title: "Default owner",
        description: "Default GitHub username or organisation name (used when owner is not specified in tool calls).",
        default: "",
      },
    },
    required: ["tokenRef"],
  },
  tools: [
    {
      name: "github_list_repos",
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
    {
      name: "github_get_repo",
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
    {
      name: "github_search_issues",
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
    {
      name: "github_get_issue",
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
    {
      name: "github_create_issue",
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
    {
      name: "github_list_prs",
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
    {
      name: "github_get_pr",
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
    {
      name: "github_add_comment",
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
    {
      name: "github_search_code",
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
    {
      name: "github_list_commits",
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
  ],
};

export default manifest;
