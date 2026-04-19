import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.linear",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Linear",
  description: "List, create, and update issues, search, and manage projects in Linear.",
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
      apiKeyRef: {
        type: "string",
        format: "secret-ref",
        title: "Linear API Key (secret ref)",
        description:
          "UUID of a Paperclip secret holding your Linear personal API key. Create one at linear.app/settings/api.",
        default: "",
      },
    },
    required: ["apiKeyRef"],
  },
  tools: [
    {
      name: "linear_list_issues",
      displayName: "List Issues",
      description: "List Linear issues, optionally filtered by team and state.",
      parametersSchema: {
        type: "object",
        properties: {
          team_id: { type: "string", description: "Filter by team ID." },
          states: { type: "array", items: { type: "string" }, description: "Filter by state names e.g. [\"Todo\", \"In Progress\"]." },
          first: { type: "integer", description: "Max issues to return (default 25)." },
        },
      },
    },
    {
      name: "linear_get_issue",
      displayName: "Get Issue",
      description: "Get full details for a specific Linear issue by ID.",
      parametersSchema: {
        type: "object",
        required: ["issue_id"],
        properties: {
          issue_id: { type: "string", description: "Linear issue ID (e.g. ENG-123 or UUID)." },
        },
      },
    },
    {
      name: "linear_search_issues",
      displayName: "Search Issues",
      description: "Full-text search across all Linear issues.",
      parametersSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string", description: "Search query." },
          first: { type: "integer", description: "Max results (default 20)." },
        },
      },
    },
    {
      name: "linear_create_issue",
      displayName: "Create Issue",
      description: "Create a new Linear issue in a team.",
      parametersSchema: {
        type: "object",
        required: ["team_id", "title"],
        properties: {
          team_id: { type: "string", description: "Team ID to create the issue in." },
          title: { type: "string", description: "Issue title." },
          description: { type: "string", description: "Issue description (markdown supported)." },
          priority: { type: "integer", description: "Priority: 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low." },
          assignee_id: { type: "string", description: "User ID to assign the issue to." },
        },
      },
    },
    {
      name: "linear_update_issue",
      displayName: "Update Issue",
      description: "Update an existing Linear issue (title, description, state, priority, assignee, etc.).",
      parametersSchema: {
        type: "object",
        required: ["issue_id", "update"],
        properties: {
          issue_id: { type: "string", description: "Issue ID to update." },
          update: { type: "object", description: "Fields to update (e.g. {\"stateId\": \"...\", \"priority\": 2})." },
        },
      },
    },
    {
      name: "linear_add_comment",
      displayName: "Add Comment",
      description: "Add a comment to a Linear issue.",
      parametersSchema: {
        type: "object",
        required: ["issue_id", "body"],
        properties: {
          issue_id: { type: "string", description: "Issue ID." },
          body: { type: "string", description: "Comment text (markdown supported)." },
        },
      },
    },
    {
      name: "linear_list_teams",
      displayName: "List Teams",
      description: "List all teams in the Linear workspace.",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "linear_list_projects",
      displayName: "List Projects",
      description: "List Linear projects, optionally filtered by team.",
      parametersSchema: {
        type: "object",
        properties: {
          team_id: { type: "string", description: "Filter by team ID." },
        },
      },
    },
    {
      name: "linear_list_members",
      displayName: "List Members",
      description: "List all members of the Linear workspace.",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
  ],
};

export default manifest;
