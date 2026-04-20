import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.jira",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Jira",
  description: "Access Jira issues, projects, and sprint data for issue tracking and project management.",
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
        title: "Jira API Token (ref)",
        description: "UUID of a Paperclip secret holding your Jira API token.",
        default: "",
      },
      email: {
        type: "string",
        title: "Jira account email",
        description: "Email address of the Jira account that owns the API token.",
        default: "",
      },
      domain: {
        type: "string",
        title: "Jira domain",
        description: "Your Atlassian domain, e.g. 'mycompany' (from mycompany.atlassian.net).",
        default: "",
      },
    },
    required: ["apiTokenRef", "email", "domain"],
  },
  tools: [
    {
      name: "jira_search_issues",
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
    {
      name: "jira_get_issue",
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
    {
      name: "jira_create_issue",
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
    {
      name: "jira_update_issue",
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
    {
      name: "jira_transition_issue",
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
    {
      name: "jira_add_comment",
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
    {
      name: "jira_list_projects",
      displayName: "List Projects",
      description: "List all Jira projects accessible to the account.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Max results (default 50).", default: 50 },
        },
      },
    },
    {
      name: "jira_get_project",
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
    {
      name: "jira_list_sprints",
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
    {
      name: "jira_list_users",
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
  ],
};

export default manifest;
