import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { TodoistClient } from "./todoist-client.js";

interface TodoistPluginConfig {
  apiTokenRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    let cachedClient: TodoistClient | null = null;
    let configError: string | null = null;

    async function getClient(): Promise<TodoistClient | null> {
      if (cachedClient) return cachedClient;
      if (configError) return null;

const config = await ctx.config.get() as TodoistPluginConfig;

      if (!config.apiTokenRef) {
        configError = "Todoist plugin: apiTokenRef is required";
        ctx.logger.warn("config missing");
        return null;
      }

      let apiToken: string;
      try {
        apiToken = await ctx.secrets.resolve(config.apiTokenRef);
      } catch (err) {
        configError = `Todoist plugin: failed to resolve apiTokenRef: ${err instanceof Error ? err.message : String(err)}`;
        ctx.logger.warn("config missing");
        return null;
      }

      ctx.logger.info("Todoist plugin: secret resolved, registering tools");
      cachedClient = new TodoistClient(apiToken);
      return cachedClient;
    }

    ctx.tools.register(
      "todoist_list_projects",
      {
        displayName: "List Projects",
        description: "List all Todoist projects.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.listProjects();
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "todoist_get_project",
      {
        displayName: "Get Project",
        description: "Get details for a specific Todoist project by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Todoist project ID." },
          },
          required: ["project_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { project_id } = params as { project_id: string };
        try {
          const result = await client.getProject(project_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "todoist_list_tasks",
      {
        displayName: "List Tasks",
        description: "List tasks, optionally filtered by project, label, or filter expression.",
        parametersSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Filter tasks by project ID." },
            label: { type: "string", description: "Filter tasks by label name." },
            filter: { type: "string", description: "Todoist filter expression (e.g. 'today', 'overdue', 'p1')." },
            limit: { type: "integer", description: "Max results (default 50).", default: 50 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { project_id, label, filter, limit } = params as { project_id?: string; label?: string; filter?: string; limit?: number };
        try {
          const result = await client.listTasks({ projectId: project_id, label, filter, limit });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "todoist_get_task",
      {
        displayName: "Get Task",
        description: "Get full details for a specific Todoist task by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            task_id: { type: "string", description: "Todoist task ID." },
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
      "todoist_create_task",
      {
        displayName: "Create Task",
        description: "Create a new task in Todoist.",
        parametersSchema: {
          type: "object",
          properties: {
            content: { type: "string", description: "Task content (title)." },
            description: { type: "string", description: "Task description." },
            project_id: { type: "string", description: "Project ID (defaults to Inbox)." },
            labels: { type: "array", items: { type: "string" }, description: "Label names to assign." },
            priority: { type: "integer", description: "Priority: 1 (normal) to 4 (urgent).", default: 1 },
            due_string: { type: "string", description: "Natural language due date (e.g. 'tomorrow')." },
            due_date: { type: "string", description: "Due date in YYYY-MM-DD format." },
          },
          required: ["content"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { content, description, project_id, labels, priority, due_string, due_date } = params as {
          content: string; description?: string; project_id?: string; labels?: string[];
          priority?: number; due_string?: string; due_date?: string;
        };
        try {
          const body: Record<string, unknown> = { content };
          if (description) body.description = description;
          if (project_id) body.project_id = project_id;
          if (labels) body.labels = labels;
          if (priority !== undefined) body.priority = priority;
          if (due_string) body.due_string = due_string;
          if (due_date) body.due_date = due_date;
          const result = await client.createTask(body);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "todoist_update_task",
      {
        displayName: "Update Task",
        description: "Update a Todoist task.",
        parametersSchema: {
          type: "object",
          properties: {
            task_id: { type: "string", description: "Todoist task ID." },
            content: { type: "string", description: "New task content." },
            description: { type: "string", description: "New task description." },
            labels: { type: "array", items: { type: "string" }, description: "New label names." },
            priority: { type: "integer", description: "New priority: 1-4." },
            due_string: { type: "string", description: "New due date as natural language." },
            due_date: { type: "string", description: "New due date in YYYY-MM-DD format." },
          },
          required: ["task_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { task_id, content, description, labels, priority, due_string, due_date } = params as {
          task_id: string; content?: string; description?: string; labels?: string[];
          priority?: number; due_string?: string; due_date?: string;
        };
        try {
          const body: Record<string, unknown> = {};
          if (content) body.content = content;
          if (description) body.description = description;
          if (labels) body.labels = labels;
          if (priority !== undefined) body.priority = priority;
          if (due_string) body.due_string = due_string;
          if (due_date) body.due_date = due_date;
          const result = await client.updateTask(task_id, body);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "todoist_close_task",
      {
        displayName: "Close Task",
        description: "Mark a Todoist task as completed.",
        parametersSchema: {
          type: "object",
          properties: {
            task_id: { type: "string", description: "Todoist task ID." },
          },
          required: ["task_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { task_id } = params as { task_id: string };
        try {
          const result = await client.closeTask(task_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "todoist_add_comment",
      {
        displayName: "Add Comment",
        description: "Add a comment to a Todoist task or project.",
        parametersSchema: {
          type: "object",
          properties: {
            task_id: { type: "string", description: "Task ID to comment on." },
            project_id: { type: "string", description: "Project ID to comment on." },
            content: { type: "string", description: "Comment text." },
          },
          required: ["content"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { task_id, project_id, content } = params as { task_id?: string; project_id?: string; content: string };
        try {
          const body: Record<string, unknown> = { content };
          if (task_id) body.task_id = task_id;
          if (project_id) body.project_id = project_id;
          const result = await client.addComment(body);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "todoist_list_labels",
      {
        displayName: "List Labels",
        description: "List all personal labels in Todoist.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const result = await client.listLabels();
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Todoist plugin: all tools registered");
  },
});

runWorker(plugin, import.meta.url);
