import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { AsanaClient } from "./asana-client.js";

interface AsanaPluginConfig {
  accessTokenRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    let cachedClient: AsanaClient | null = null;
    let configError: string | null = null;

    async function getClient(): Promise<AsanaClient | null> {
      if (cachedClient) return cachedClient;
      if (configError) return null;

const config = await ctx.config.get() as AsanaPluginConfig;

      if (!config.accessTokenRef) {
        configError = "Asana plugin: accessTokenRef is required";
        ctx.logger.warn("config missing");
        return null;
      }

      let accessToken: string;
      try {
        accessToken = await ctx.secrets.resolve(config.accessTokenRef);
      } catch (err) {
        configError = `Asana plugin: failed to resolve accessTokenRef: ${err instanceof Error ? err.message : String(err)}`;
        ctx.logger.warn("config missing");
        return null;
      }

      ctx.logger.info("Asana plugin: secret resolved, registering tools");
      cachedClient = new AsanaClient(accessToken);
      return cachedClient;
    }

    ctx.tools.register(
      "asana_get_me",
      {
        displayName: "Get Me",
        description: "Get the authenticated Asana user's profile and workspace memberships.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.getMe();
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "asana_list_workspaces",
      {
        displayName: "List Workspaces",
        description: "List all Asana workspaces and organizations the user belongs to.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.listWorkspaces();
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "asana_list_projects",
      {
        displayName: "List Projects",
        description: "List projects in an Asana workspace.",
        parametersSchema: {
          type: "object",
          properties: {
            workspace_gid: { type: "string", description: "Workspace GID." },
            archived: { type: "boolean", description: "Include archived projects (default false).", default: false },
            limit: { type: "integer", description: "Max results (default 100).", default: 100 },
          },
          required: ["workspace_gid"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { workspace_gid: string; archived?: boolean; limit?: number };
          const result = await client.listProjects(p.workspace_gid, p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "asana_get_project",
      {
        displayName: "Get Project",
        description: "Get full details for a specific Asana project.",
        parametersSchema: {
          type: "object",
          properties: {
            project_gid: { type: "string", description: "Project GID." },
          },
          required: ["project_gid"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { project_gid: string };
          const result = await client.getProject(p.project_gid);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "asana_list_tasks",
      {
        displayName: "List Tasks",
        description: "List tasks in an Asana project.",
        parametersSchema: {
          type: "object",
          properties: {
            project_gid: { type: "string", description: "Project GID." },
            completed: { type: "boolean", description: "Filter by completion status (omit for all)." },
            limit: { type: "integer", description: "Max results (default 100).", default: 100 },
          },
          required: ["project_gid"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { project_gid: string; completed?: boolean; limit?: number };
          const result = await client.listTasks(p.project_gid, p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "asana_get_task",
      {
        displayName: "Get Task",
        description: "Get full details for a specific Asana task including subtasks and recent comments.",
        parametersSchema: {
          type: "object",
          properties: {
            task_gid: { type: "string", description: "Task GID." },
          },
          required: ["task_gid"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { task_gid: string };
          const result = await client.getTask(p.task_gid);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "asana_search_tasks",
      {
        displayName: "Search Tasks",
        description: "Search tasks in an Asana workspace by text.",
        parametersSchema: {
          type: "object",
          properties: {
            workspace_gid: { type: "string", description: "Workspace GID to search within." },
            text: { type: "string", description: "Search query." },
            completed: { type: "boolean", description: "Filter by completion status (omit for all)." },
            limit: { type: "integer", description: "Max results (default 20).", default: 20 },
          },
          required: ["workspace_gid", "text"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { workspace_gid: string; text: string; completed?: boolean; limit?: number };
          const result = await client.searchTasks(p.workspace_gid, p.text, p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "asana_create_task",
      {
        displayName: "Create Task",
        description: "Create a new task in an Asana workspace, optionally assigned to a project.",
        parametersSchema: {
          type: "object",
          properties: {
            workspace_gid: { type: "string", description: "Workspace GID." },
            project_gid: { type: "string", description: "Project GID to add the task to (optional)." },
            name: { type: "string", description: "Task name." },
            notes: { type: "string", description: "Task description." },
            assignee_gid: { type: "string", description: "Assignee user GID (optional)." },
            due_on: { type: "string", description: "Due date in YYYY-MM-DD format (optional)." },
          },
          required: ["workspace_gid", "name"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { workspace_gid: string; project_gid?: string; name: string; notes?: string; assignee_gid?: string; due_on?: string };
          const result = await client.createTask({
            workspaceGid: p.workspace_gid,
            projectGid: p.project_gid,
            name: p.name,
            notes: p.notes,
            assigneeGid: p.assignee_gid,
            dueOn: p.due_on,
          });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "asana_update_task",
      {
        displayName: "Update Task",
        description: "Update an Asana task (name, notes, due_on, assignee, completed, etc.).",
        parametersSchema: {
          type: "object",
          properties: {
            task_gid: { type: "string", description: "Task GID." },
            name: { type: "string", description: "New task name." },
            notes: { type: "string", description: "New task notes." },
            completed: { type: "boolean", description: "Mark as complete or incomplete." },
            due_on: { type: "string", description: "Due date in YYYY-MM-DD format." },
            assignee: { type: "string", description: "Assignee user GID or 'me'." },
          },
          required: ["task_gid"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const { task_gid, ...data } = params as { task_gid: string } & Record<string, unknown>;
          const result = await client.updateTask(task_gid, data);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "asana_add_task_comment",
      {
        displayName: "Add Task Comment",
        description: "Post a comment (story) on an Asana task.",
        parametersSchema: {
          type: "object",
          properties: {
            task_gid: { type: "string", description: "Task GID." },
            text: { type: "string", description: "Comment text." },
          },
          required: ["task_gid", "text"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { task_gid: string; text: string };
          const result = await client.addTaskComment(p.task_gid, p.text);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );
  },
});

runWorker(plugin, import.meta.url);
