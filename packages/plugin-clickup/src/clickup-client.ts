const BASE = "https://api.clickup.com/api/v2";

export class ClickUpClient {
  private apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        Authorization: this.apiToken,
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ClickUp API error ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async listWorkspaces(): Promise<unknown> {
    return this.request("/team");
  }

  async listSpaces(workspaceId: string): Promise<unknown> {
    return this.request(`/team/${workspaceId}/space?archived=false`);
  }

  async listListsInSpace(spaceId: string): Promise<unknown> {
    return this.request(`/space/${spaceId}/list?archived=false`);
  }

  async listListsInFolder(folderId: string): Promise<unknown> {
    return this.request(`/folder/${folderId}/list?archived=false`);
  }

  async listTasks(listId: string, params: { status?: string; assignee?: string; page?: number }): Promise<unknown> {
    const qs = new URLSearchParams({ page: String(params.page ?? 0) });
    if (params.status) qs.set("statuses[]", params.status);
    if (params.assignee) qs.set("assignees[]", params.assignee);
    return this.request(`/list/${listId}/task?${qs.toString()}`);
  }

  async getTask(taskId: string): Promise<unknown> {
    return this.request(`/task/${taskId}`);
  }

  async createTask(listId: string, body: Record<string, unknown>): Promise<unknown> {
    return this.request(`/list/${listId}/task`, { method: "POST", body: JSON.stringify(body) });
  }

  async updateTask(taskId: string, body: Record<string, unknown>): Promise<unknown> {
    return this.request(`/task/${taskId}`, { method: "PUT", body: JSON.stringify(body) });
  }

  async addComment(taskId: string, commentText: string): Promise<unknown> {
    return this.request(`/task/${taskId}/comment`, {
      method: "POST",
      body: JSON.stringify({ comment_text: commentText }),
    });
  }

  async searchTasks(workspaceId: string, query: string): Promise<unknown> {
    return this.request(`/team/${workspaceId}/task?query=${encodeURIComponent(query)}`);
  }
}
