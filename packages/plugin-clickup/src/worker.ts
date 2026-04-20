import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { ClickUpClient } from "./clickup-client.js";

interface ClickUpPluginConfig {
  apiTokenRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as ClickUpPluginConfig;

    if (!config.apiTokenRef) {
      ctx.logger.error("ClickUp plugin: apiTokenRef is required");
      return;
    }

    let apiToken: string;
    try {
      apiToken = await ctx.secrets.resolve(config.apiTokenRef);
    } catch (err) {
      ctx.logger.error(`ClickUp plugin: failed to resolve apiTokenRef: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    ctx.logger.info("ClickUp plugin: secret resolved, registering tools");
    const client = new ClickUpClient(apiToken);

    ctx.tools.register(
      "clickup_list_workspaces",
      {
        displayName: "List Workspaces",
        description: "List all ClickUp workspaces the authenticated user has access to.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const result = await client.listWorkspaces();
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "clickup_list_spaces",
      {
        displayName: "List Spaces",
        description: "List all spaces in a ClickUp workspace.",
        parametersSchema: {
          type: "object",
          properties: {
            workspace_id: { type: "string", description: "ClickUp workspace (team) ID." },
          },
          required: ["workspace_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { workspace_id } = params as { workspace_id: string };
        try {
          const result = await client.listSpaces(workspace_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "clickup_list_lists",
      {
        displayName: "List Lists",
        description: "List all lists in a ClickUp space or folder.",
        parametersSchema: {
          type: "object",
          properties: {
            space_id: { type: "string", description: "ClickUp space ID (lists directly in space)." },
            folder_id: { type: "string", description: "ClickUp folder ID (lists inside folder). Takes priority over space_id." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { space_id, folder_id } = params as { space_id?: string; folder_id?: string };
        try {
          if (folder_id) {
            const result = await client.listListsInFolder(folder_id);
            return { content: JSON.stringify(result, null, 2) };
          } else if (space_id) {
            const result = await client.listListsInSpace(space_id);
            return { content: JSON.stringify(result, null, 2) };
          }
          return { error: "Either space_id or folder_id is required" };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "clickup_list_tasks",
      {
        displayName: "List Tasks",
        description: "List tasks in a ClickUp list, optionally filtered by assignee or status.",
        parametersSchema: {
          type: "object",
          properties: {
            list_id: { type: "string", description: "ClickUp list ID." },
            status: { type: "string", description: "Filter by task status." },
            assignee: { type: "string", description: "Filter by assignee user ID." },
            page: { type: "integer", description: "Page number (default 0).", default: 0 },
          },
          required: ["list_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { list_id, status, assignee, page } = params as { list_id: string; status?: string; assignee?: string; page?: number };
        try {
          const result = await client.listTasks(list_id, { status, assignee, page });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "clickup_get_task",
      {
        displayName: "Get Task",
        description: "Get full details for a specific ClickUp task by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            task_id: { type: "string", description: "ClickUp task ID." },
          },
          required: ["task_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { task_id } = params as { task_id: string };
        try {
          const result = await client.getTask(task_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "clickup_create_task",
      {
        displayName: "Create Task",
        description: "Create a new task in a ClickUp list.",
        parametersSchema: {
          type: "object",
          properties: {
            list_id: { type: "string", description: "ClickUp list ID." },
            name: { type: "string", description: "Task name." },
            description: { type: "string", description: "Task description." },
            status: { type: "string", description: "Task status." },
            priority: { type: "integer", description: "Priority: 1 (urgent), 2 (high), 3 (normal), 4 (low)." },
            due_date: { type: "string", description: "Due date as Unix timestamp in milliseconds." },
            assignees: { type: "array", items: { type: "integer" }, description: "List of user IDs to assign." },
          },
          required: ["list_id", "name"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { list_id, name, description, status, priority, due_date, assignees } = params as {
          list_id: string; name: string; description?: string; status?: string;
          priority?: number; due_date?: string; assignees?: number[];
        };
        try {
          const body: Record<string, unknown> = { name };
          if (description) body.description = description;
          if (status) body.status = status;
          if (priority !== undefined) body.priority = priority;
          if (due_date) body.due_date = Number(due_date);
          if (assignees) body.assignees = assignees;
          const result = await client.createTask(list_id, body);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "clickup_update_task",
      {
        displayName: "Update Task",
        description: "Update a ClickUp task.",
        parametersSchema: {
          type: "object",
          properties: {
            task_id: { type: "string", description: "ClickUp task ID." },
            name: { type: "string", description: "New task name." },
            description: { type: "string", description: "New task description." },
            status: { type: "string", description: "New task status." },
            priority: { type: "integer", description: "New priority: 1-4." },
            due_date: { type: "string", description: "New due date as Unix timestamp in milliseconds." },
          },
          required: ["task_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { task_id, name, description, status, priority, due_date } = params as {
          task_id: string; name?: string; description?: string; status?: string;
          priority?: number; due_date?: string;
        };
        try {
          const body: Record<string, unknown> = {};
          if (name) body.name = name;
          if (description) body.description = description;
          if (status) body.status = status;
          if (priority !== undefined) body.priority = priority;
          if (due_date) body.due_date = Number(due_date);
          const result = await client.updateTask(task_id, body);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "clickup_add_comment",
      {
        displayName: "Add Task Comment",
        description: "Add a comment to a ClickUp task.",
        parametersSchema: {
          type: "object",
          properties: {
            task_id: { type: "string", description: "ClickUp task ID." },
            comment_text: { type: "string", description: "Comment text." },
          },
          required: ["task_id", "comment_text"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { task_id, comment_text } = params as { task_id: string; comment_text: string };
        try {
          const result = await client.addComment(task_id, comment_text);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "clickup_search_tasks",
      {
        displayName: "Search Tasks",
        description: "Search tasks across a ClickUp workspace by query string.",
        parametersSchema: {
          type: "object",
          properties: {
            workspace_id: { type: "string", description: "ClickUp workspace ID." },
            query: { type: "string", description: "Search query string." },
          },
          required: ["workspace_id", "query"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { workspace_id, query } = params as { workspace_id: string; query: string };
        try {
          const result = await client.searchTasks(workspace_id, query);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("ClickUp plugin: all tools registered");
  },
});

runWorker(plugin, import.meta.url);
