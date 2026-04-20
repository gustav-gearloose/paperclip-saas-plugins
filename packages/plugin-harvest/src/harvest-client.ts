const BASE = "https://api.harvestapp.com/v2";

export class HarvestClient {
  private token: string;
  private accountId: string;

  constructor(token: string, accountId: string) {
    this.token = token;
    this.accountId = accountId;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Harvest-Account-Id": this.accountId,
        "User-Agent": "Paperclip-Harvest-Plugin/0.1",
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Harvest API error ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  private buildQs(params: Record<string, unknown>): string {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) qs.set(k, String(v));
    }
    const s = qs.toString();
    return s ? "?" + s : "";
  }

  async listTimeEntries(params: {
    project_id?: number;
    user_id?: number;
    client_id?: number;
    from?: string;
    to?: string;
    is_billable?: boolean;
    per_page?: number;
    page?: number;
  }): Promise<unknown> {
    return this.request(`/time_entries${this.buildQs(params as Record<string, unknown>)}`);
  }

  async createTimeEntry(body: Record<string, unknown>): Promise<unknown> {
    return this.request("/time_entries", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async updateTimeEntry(id: number, body: Record<string, unknown>): Promise<unknown> {
    return this.request(`/time_entries/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  async listProjects(params: { client_id?: number; is_active?: boolean; per_page?: number }): Promise<unknown> {
    return this.request(`/projects${this.buildQs(params as Record<string, unknown>)}`);
  }

  async listClients(params: { is_active?: boolean; per_page?: number }): Promise<unknown> {
    return this.request(`/clients${this.buildQs(params as Record<string, unknown>)}`);
  }

  async listTasks(params: { is_active?: boolean; per_page?: number }): Promise<unknown> {
    return this.request(`/tasks${this.buildQs(params as Record<string, unknown>)}`);
  }

  async listUsers(params: { is_active?: boolean; per_page?: number }): Promise<unknown> {
    return this.request(`/users${this.buildQs(params as Record<string, unknown>)}`);
  }

  async listInvoices(params: {
    client_id?: number;
    state?: string;
    from?: string;
    to?: string;
    per_page?: number;
  }): Promise<unknown> {
    return this.request(`/invoices${this.buildQs(params as Record<string, unknown>)}`);
  }

  async getMe(): Promise<unknown> {
    return this.request("/users/me");
  }
}
