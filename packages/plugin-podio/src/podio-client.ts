const BASE_URL = "https://api.podio.com";

export class PodioClient {
  private token: string;

  private constructor(token: string) {
    this.token = token;
  }

  static async create(clientId: string, clientSecret: string, appId: string, appToken: string): Promise<PodioClient> {
    const body = new URLSearchParams({
      grant_type: "app",
      client_id: clientId,
      client_secret: clientSecret,
      app_id: appId,
      app_token: appToken,
    });
    const res = await fetch(`${BASE_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: body.toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Podio auth failed ${res.status}: ${text}`);
    }
    const data = await res.json() as { access_token?: string };
    if (!data.access_token) throw new Error("Podio auth: no access_token in response");
    return new PodioClient(data.access_token);
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `OAuth2 ${this.token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  private async request<T>(method: string, path: string, body?: unknown, params?: Record<string, string | number | undefined>): Promise<T> {
    let url = `${BASE_URL}${path}`;
    if (params) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) qs.set(k, String(v));
      }
      const str = qs.toString();
      if (str) url += `?${str}`;
    }
    const res = await fetch(url, {
      method,
      headers: this.headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Podio ${method} ${path} → ${res.status}: ${text}`);
    }
    if (res.status === 204) return {} as T;
    return res.json() as Promise<T>;
  }

  // ── Apps & Spaces ──────────────────────────────────────────────────────────

  async getApp(appId: number | string): Promise<unknown> {
    return this.request("GET", `/app/${appId}`);
  }

  async listSpacesForOrg(orgId: number | string): Promise<unknown> {
    return this.request("GET", `/space/org/${orgId}/`);
  }

  // ── Items ──────────────────────────────────────────────────────────────────

  async getItems(appId: number | string, params?: { limit?: number; offset?: number; sort_by?: string; sort_desc?: boolean }): Promise<unknown> {
    return this.request("GET", `/item/app/${appId}/`, undefined, {
      limit: params?.limit ?? 100,
      offset: params?.offset,
      sort_by: params?.sort_by,
      sort_desc: params?.sort_desc !== undefined ? (params.sort_desc ? 1 : 0) : undefined,
    });
  }

  async getItem(itemId: number | string): Promise<unknown> {
    return this.request("GET", `/item/${itemId}`);
  }

  async createItem(appId: number | string, fields: Record<string, unknown>, externalId?: string): Promise<unknown> {
    const body: Record<string, unknown> = { fields };
    if (externalId) body.external_id = externalId;
    return this.request("POST", `/item/app/${appId}/`, body);
  }

  async updateItem(itemId: number | string, fields: Record<string, unknown>): Promise<unknown> {
    return this.request("PUT", `/item/${itemId}`, { fields });
  }

  async filterItems(appId: number | string, filters: Record<string, unknown>, params?: { limit?: number; offset?: number }): Promise<unknown> {
    const body: Record<string, unknown> = { filters, limit: params?.limit ?? 100, offset: params?.offset ?? 0 };
    return this.request("POST", `/item/app/${appId}/filter/`, body);
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────

  async getTasks(params?: { completed?: boolean; limit?: number; offset?: number }): Promise<unknown> {
    return this.request("GET", "/task/", undefined, {
      completed: params?.completed !== undefined ? (params.completed ? 1 : 0) : undefined,
      limit: params?.limit ?? 100,
      offset: params?.offset,
    });
  }

  async createTask(params: { text: string; description?: string; dueDate?: string; responsible?: number }): Promise<unknown> {
    const body: Record<string, unknown> = { text: params.text };
    if (params.description) body.description = params.description;
    if (params.dueDate) body.due_date = params.dueDate;
    if (params.responsible) body.responsible = { type: "user", id: params.responsible };
    return this.request("POST", "/task/", body);
  }

  async completeTask(taskId: number | string): Promise<unknown> {
    return this.request("POST", `/task/${taskId}/complete`);
  }

  // ── Comments ───────────────────────────────────────────────────────────────

  async getComments(refType: string, refId: number | string): Promise<unknown> {
    return this.request("GET", `/comment/${refType}/${refId}/`);
  }

  async addComment(refType: string, refId: number | string, value: string): Promise<unknown> {
    return this.request("POST", `/comment/${refType}/${refId}/`, { value });
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  async search(query: string, params?: { limit?: number }): Promise<unknown> {
    return this.request("GET", "/search/", undefined, {
      query,
      limit: params?.limit ?? 20,
    });
  }
}
