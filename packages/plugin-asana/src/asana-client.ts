const ASANA_API_URL = "https://app.asana.com/api/1.0";

export class AsanaClient {
  private headers: Record<string, string>;

  constructor(accessToken: string) {
    this.headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  private async get(path: string, params?: Record<string, string | number | boolean>): Promise<unknown> {
    const url = new URL(`${ASANA_API_URL}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, String(v));
      }
    }
    const res = await fetch(url.toString(), { headers: this.headers });
    if (!res.ok) throw new Error(`Asana API error: ${res.status} ${await res.text()}`);
    const json = await res.json() as { data: unknown };
    return json.data;
  }

  private async post(path: string, body: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(`${ASANA_API_URL}${path}`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ data: body }),
    });
    if (!res.ok) throw new Error(`Asana API error: ${res.status} ${await res.text()}`);
    const json = await res.json() as { data: unknown };
    return json.data;
  }

  private async put(path: string, body: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(`${ASANA_API_URL}${path}`, {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify({ data: body }),
    });
    if (!res.ok) throw new Error(`Asana API error: ${res.status} ${await res.text()}`);
    const json = await res.json() as { data: unknown };
    return json.data;
  }

  async getMe(): Promise<unknown> {
    return this.get("/users/me", { opt_fields: "gid,name,email,workspaces.gid,workspaces.name" });
  }

  async listWorkspaces(): Promise<unknown> {
    return this.get("/workspaces", { opt_fields: "gid,name,is_organization" });
  }

  async listProjects(workspaceGid: string, params: { archived?: boolean; limit?: number }): Promise<unknown> {
    const { archived = false, limit = 100 } = params;
    return this.get("/projects", {
      workspace: workspaceGid,
      archived: archived,
      limit,
      opt_fields: "gid,name,notes,color,archived,created_at,modified_at,due_date,owner.name,team.name",
    });
  }

  async getProject(projectGid: string): Promise<unknown> {
    return this.get(`/projects/${projectGid}`, {
      opt_fields: "gid,name,notes,color,archived,created_at,modified_at,due_date,owner.name,team.name,members.name",
    });
  }

  async listTasks(projectGid: string, params: { completed?: boolean; limit?: number }): Promise<unknown> {
    const { completed, limit = 100 } = params;
    const queryParams: Record<string, string | number | boolean> = {
      project: projectGid,
      limit,
      opt_fields: "gid,name,notes,completed,due_on,assignee.name,tags.name,created_at,modified_at",
    };
    if (completed !== undefined) queryParams.completed = completed;
    return this.get("/tasks", queryParams);
  }

  async getTask(taskGid: string): Promise<unknown> {
    return this.get(`/tasks/${taskGid}`, {
      opt_fields: "gid,name,notes,completed,due_on,assignee.name,tags.name,created_at,modified_at,parent.name,subtasks.name,followers.name,projects.name",
    });
  }

  async searchTasks(workspaceGid: string, text: string, params: { completed?: boolean; limit?: number }): Promise<unknown> {
    const { completed, limit = 20 } = params;
    const queryParams: Record<string, string | number | boolean> = {
      "text": text,
      "resource_type": "task",
      "count": limit,
      "opt_fields": "gid,name,completed,due_on,assignee.name,projects.name",
    };
    if (completed !== undefined) queryParams["tasks.completed"] = completed;
    return this.get(`/workspaces/${workspaceGid}/tasks/search`, queryParams);
  }

  async createTask(params: {
    workspaceGid: string;
    projectGid?: string;
    name: string;
    notes?: string;
    assigneeGid?: string;
    dueOn?: string;
  }): Promise<unknown> {
    const body: Record<string, unknown> = {
      workspace: params.workspaceGid,
      name: params.name,
    };
    if (params.projectGid) body.projects = [params.projectGid];
    if (params.notes) body.notes = params.notes;
    if (params.assigneeGid) body.assignee = params.assigneeGid;
    if (params.dueOn) body.due_on = params.dueOn;
    return this.post("/tasks", body);
  }

  async updateTask(taskGid: string, data: Record<string, unknown>): Promise<unknown> {
    return this.put(`/tasks/${taskGid}`, data);
  }

  async addTaskComment(taskGid: string, text: string): Promise<unknown> {
    return this.post(`/tasks/${taskGid}/stories`, { text });
  }

  async listSections(projectGid: string): Promise<unknown> {
    return this.get(`/projects/${projectGid}/sections`, {
      opt_fields: "gid,name,created_at",
    });
  }

  async listUsers(workspaceGid: string): Promise<unknown> {
    return this.get(`/workspaces/${workspaceGid}/users`, {
      opt_fields: "gid,name,email",
    });
  }
}
