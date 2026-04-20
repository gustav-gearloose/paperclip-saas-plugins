const BASE = "https://api.todoist.com/rest/v2";

export class TodoistClient {
  private apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Todoist API error ${res.status}: ${text}`);
    }
    if (res.status === 204) return undefined as unknown as T;
    return res.json() as Promise<T>;
  }

  async listProjects(): Promise<unknown> {
    return this.request("/projects");
  }

  async getProject(projectId: string): Promise<unknown> {
    return this.request(`/projects/${projectId}`);
  }

  async listTasks(params: { projectId?: string; label?: string; filter?: string; limit?: number }): Promise<unknown> {
    const qs = new URLSearchParams();
    if (params.projectId) qs.set("project_id", params.projectId);
    if (params.label) qs.set("label", params.label);
    if (params.filter) qs.set("filter", params.filter);
    if (params.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return this.request(`/tasks${query ? "?" + query : ""}`);
  }

  async getTask(taskId: string): Promise<unknown> {
    return this.request(`/tasks/${taskId}`);
  }

  async createTask(body: Record<string, unknown>): Promise<unknown> {
    return this.request("/tasks", { method: "POST", body: JSON.stringify(body) });
  }

  async updateTask(taskId: string, body: Record<string, unknown>): Promise<unknown> {
    return this.request(`/tasks/${taskId}`, { method: "POST", body: JSON.stringify(body) });
  }

  async closeTask(taskId: string): Promise<unknown> {
    await this.request(`/tasks/${taskId}/close`, { method: "POST" });
    return { closed: true, task_id: taskId };
  }

  async addComment(body: Record<string, unknown>): Promise<unknown> {
    return this.request("/comments", { method: "POST", body: JSON.stringify(body) });
  }

  async listLabels(): Promise<unknown> {
    return this.request("/labels");
  }
}
