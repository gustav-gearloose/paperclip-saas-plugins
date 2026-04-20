const BASE_V2 = (domain: string) => `https://${domain}.atlassian.net/wiki/api/v2`;

export class ConfluenceClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(domain: string, email: string, apiToken: string) {
    this.baseUrl = BASE_V2(domain);
    const creds = Buffer.from(`${email}:${apiToken}`).toString("base64");
    this.headers = {
      "Authorization": `Basic ${creds}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    };
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...this.headers, ...(options.headers as Record<string, string> ?? {}) },
    });
    if (res.status === 204) return undefined as unknown as T;
    if (!res.ok) throw new Error(`Confluence API ${options.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  // ── Pages ─────────────────────────────────────────────────────────────────

  async searchPages(params: { query: string; space_key?: string; limit?: number }) {
    const limit = params.limit ?? 25;
    const qs = new URLSearchParams({
      title: params.query,
      limit: String(limit),
    });
    if (params.space_key) qs.set("spaceKey", params.space_key);
    const data = await this.request<{ results: unknown[] }>(`/pages?${qs}`);
    return data.results ?? [];
  }

  async searchContent(params: { cql: string; limit?: number }) {
    const limit = params.limit ?? 25;
    const qs = new URLSearchParams({ cql: params.cql, limit: String(limit) });
    // v1 search endpoint — CQL not in v2 yet
    const res = await fetch(
      `https://${this.baseUrl.match(/https:\/\/([^.]+)/)?.[1]}.atlassian.net/wiki/rest/api/content/search?${qs}`,
      { headers: this.headers }
    );
    if (!res.ok) throw new Error(`Confluence search: ${res.status} ${await res.text()}`);
    const data = await res.json() as { results: unknown[] };
    return data.results ?? [];
  }

  async getPage(params: { page_id: string; include_body?: boolean }) {
    const bodyStatus = params.include_body !== false ? "&body-format=storage" : "";
    return this.request<unknown>(`/pages/${params.page_id}?version=current${bodyStatus}`);
  }

  async getPageByTitle(params: { title: string; space_key: string }) {
    const qs = new URLSearchParams({ title: params.title, spaceKey: params.space_key, limit: "1" });
    const data = await this.request<{ results: unknown[] }>(`/pages?${qs}`);
    if (!data.results?.length) throw new Error(`Page not found: "${params.title}" in ${params.space_key}`);
    return data.results[0];
  }

  async createPage(params: {
    space_id: string;
    title: string;
    body: string;
    parent_id?: string;
    status?: string;
  }) {
    const body: Record<string, unknown> = {
      spaceId: params.space_id,
      status: params.status ?? "current",
      title: params.title,
      body: { representation: "storage", value: params.body },
    };
    if (params.parent_id) body.parentId = params.parent_id;
    return this.request<unknown>("/pages", { method: "POST", body: JSON.stringify(body) });
  }

  async updatePage(params: {
    page_id: string;
    title: string;
    body: string;
    version: number;
    status?: string;
  }) {
    const body = {
      id: params.page_id,
      status: params.status ?? "current",
      title: params.title,
      body: { representation: "storage", value: params.body },
      version: { number: params.version, message: "" },
    };
    return this.request<unknown>(`/pages/${params.page_id}`, { method: "PUT", body: JSON.stringify(body) });
  }

  async deletePage(pageId: string) {
    await this.request<unknown>(`/pages/${pageId}`, { method: "DELETE" });
    return { deleted: true };
  }

  async listChildren(params: { page_id: string; limit?: number }) {
    const qs = new URLSearchParams({ limit: String(params.limit ?? 25) });
    const data = await this.request<{ results: unknown[] }>(`/pages/${params.page_id}/children?${qs}`);
    return data.results ?? [];
  }

  // ── Spaces ────────────────────────────────────────────────────────────────

  async listSpaces(params: { limit?: number; type?: string }) {
    const qs = new URLSearchParams({ limit: String(params.limit ?? 50) });
    if (params.type) qs.set("type", params.type);
    const data = await this.request<{ results: unknown[] }>(`/spaces?${qs}`);
    return data.results ?? [];
  }

  async getSpace(spaceKey: string) {
    const qs = new URLSearchParams({ keys: spaceKey, limit: "1" });
    const data = await this.request<{ results: unknown[] }>(`/spaces?${qs}`);
    if (!data.results?.length) throw new Error(`Space not found: ${spaceKey}`);
    return data.results[0];
  }

  // ── Comments ──────────────────────────────────────────────────────────────

  async addComment(params: { page_id: string; body: string }) {
    const payload = {
      pageId: params.page_id,
      body: { representation: "storage", value: params.body },
    };
    return this.request<unknown>("/footer-comments", { method: "POST", body: JSON.stringify(payload) });
  }

  async listComments(params: { page_id: string; limit?: number }) {
    const qs = new URLSearchParams({ limit: String(params.limit ?? 25) });
    const data = await this.request<{ results: unknown[] }>(`/pages/${params.page_id}/footer-comments?${qs}`);
    return data.results ?? [];
  }
}
