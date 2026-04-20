// Zoho CRM v6 API. Domain is one of: zohoapis.com, zohoapis.eu, zohoapis.in, etc.
export class ZohoCrmClient {
  private baseUrl: string;
  private accessToken: string;

  constructor(accessToken: string, domain: string) {
    this.accessToken = accessToken;
    this.baseUrl = `https://www.${domain.replace(/^https?:\/\//, "")}/crm/v6`;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Zoho-oauthtoken ${this.accessToken}`,
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Zoho CRM API error ${res.status}: ${text}`);
    }
    if (res.status === 204) return {} as T;
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

  async listRecords(module: string, params: {
    page?: number; per_page?: number; sort_by?: string; sort_order?: string; fields?: string;
  }): Promise<unknown> {
    return this.request(`/${module}${this.buildQs(params as Record<string, unknown>)}`);
  }

  async getRecord(module: string, id: string): Promise<unknown> {
    return this.request(`/${module}/${id}`);
  }

  async createRecord(module: string, data: Record<string, unknown>): Promise<unknown> {
    return this.request(`/${module}`, {
      method: "POST",
      body: JSON.stringify({ data: [data] }),
    });
  }

  async updateRecord(module: string, id: string, data: Record<string, unknown>): Promise<unknown> {
    return this.request(`/${module}/${id}`, {
      method: "PUT",
      body: JSON.stringify({ data: [data] }),
    });
  }

  async deleteRecord(module: string, id: string): Promise<unknown> {
    return this.request(`/${module}/${id}`, { method: "DELETE" });
  }

  async searchRecords(module: string, params: {
    criteria?: string; email?: string; phone?: string; word?: string; page?: number; per_page?: number;
  }): Promise<unknown> {
    return this.request(`/${module}/search${this.buildQs(params as Record<string, unknown>)}`);
  }

  async listUsers(params: { type?: string; page?: number; per_page?: number }): Promise<unknown> {
    return this.request(`/users${this.buildQs(params as Record<string, unknown>)}`);
  }

  async getOrganization(): Promise<unknown> {
    return this.request("/org");
  }

  async listDeals(params: { page?: number; per_page?: number; sort_by?: string; sort_order?: string }): Promise<unknown> {
    return this.listRecords("Deals", params);
  }

  async createNote(parentModule: string, parentId: string, noteTitle: string, noteContent: string): Promise<unknown> {
    return this.request("/Notes", {
      method: "POST",
      body: JSON.stringify({
        data: [{
          Note_Title: noteTitle,
          Note_Content: noteContent,
          Parent_Id: parentId,
          $se_module: parentModule,
        }],
      }),
    });
  }

  async listActivities(params: { page?: number; per_page?: number; type?: string }): Promise<unknown> {
    return this.request(`/activities${this.buildQs(params as Record<string, unknown>)}`);
  }
}
