const BASE_URL = "https://api.pipedrive.com/v1";

export class PipedriveClient {
  private readonly apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${BASE_URL}${path}${sep}api_token=${this.apiToken}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(options.headers as Record<string, string> ?? {}),
      },
    });
    if (!res.ok) {
      throw new Error(`Pipedrive API ${options.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
    }
    const json = await res.json() as { success: boolean; data: T; error?: string };
    if (!json.success) {
      throw new Error(`Pipedrive error: ${json.error ?? "unknown"}`);
    }
    return json.data;
  }

  // ── Deals ─────────────────────────────────────────────────────────────────

  async searchDeals(params: {
    query?: string;
    status?: string;
    pipeline_id?: number;
    stage_id?: number;
    limit?: number;
  }) {
    if (params.query) {
      const qs = new URLSearchParams({ term: params.query, item_type: "deal", limit: String(params.limit ?? 50) });
      const data = await this.request<{ items: Array<{ item: unknown }> }>(`/itemSearch?${qs}`);
      return (data.items ?? []).map(i => i.item);
    }
    const qs = new URLSearchParams({ limit: String(params.limit ?? 50) });
    if (params.status) qs.set("status", params.status);
    if (params.pipeline_id) qs.set("pipeline_id", String(params.pipeline_id));
    if (params.stage_id) qs.set("stage_id", String(params.stage_id));
    return this.request<unknown[]>(`/deals?${qs}`);
  }

  async getDeal(dealId: number) {
    return this.request<unknown>(`/deals/${dealId}`);
  }

  async createDeal(payload: {
    title: string;
    value?: number;
    currency?: string;
    person_id?: number;
    org_id?: number;
    pipeline_id?: number;
    stage_id?: number;
    expected_close_date?: string;
  }) {
    return this.request<unknown>("/deals", {
      method: "POST",
      body: JSON.stringify({
        title: payload.title,
        ...(payload.value != null ? { value: payload.value } : {}),
        ...(payload.currency ? { currency: payload.currency } : {}),
        ...(payload.person_id ? { person_id: payload.person_id } : {}),
        ...(payload.org_id ? { org_id: payload.org_id } : {}),
        ...(payload.pipeline_id ? { pipeline_id: payload.pipeline_id } : {}),
        ...(payload.stage_id ? { stage_id: payload.stage_id } : {}),
        ...(payload.expected_close_date ? { expected_close_date: payload.expected_close_date } : {}),
      }),
    });
  }

  async updateDeal(dealId: number, payload: {
    title?: string;
    status?: string;
    value?: number;
    stage_id?: number;
    expected_close_date?: string;
  }) {
    return this.request<unknown>(`/deals/${dealId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  // ── Persons ───────────────────────────────────────────────────────────────

  async searchPersons(params: { query?: string; limit?: number }) {
    const qs = new URLSearchParams({ term: params.query ?? "", item_type: "person", limit: String(params.limit ?? 50) });
    const data = await this.request<{ items: Array<{ item: unknown }> }>(`/itemSearch?${qs}`);
    return (data.items ?? []).map(i => i.item);
  }

  async createPerson(payload: {
    name: string;
    email?: string;
    phone?: string;
    org_id?: number;
  }) {
    return this.request<unknown>("/persons", {
      method: "POST",
      body: JSON.stringify({
        name: payload.name,
        ...(payload.email ? { email: [{ value: payload.email, primary: true }] } : {}),
        ...(payload.phone ? { phone: [{ value: payload.phone, primary: true }] } : {}),
        ...(payload.org_id ? { org_id: payload.org_id } : {}),
      }),
    });
  }

  // ── Organizations ─────────────────────────────────────────────────────────

  async searchOrganizations(params: { query?: string; limit?: number }) {
    const qs = new URLSearchParams({ term: params.query ?? "", item_type: "organization", limit: String(params.limit ?? 50) });
    const data = await this.request<{ items: Array<{ item: unknown }> }>(`/itemSearch?${qs}`);
    return (data.items ?? []).map(i => i.item);
  }

  async createOrganization(payload: { name: string; address?: string }) {
    return this.request<unknown>("/organizations", {
      method: "POST",
      body: JSON.stringify({
        name: payload.name,
        ...(payload.address ? { address: payload.address } : {}),
      }),
    });
  }

  // ── Activities ────────────────────────────────────────────────────────────

  async listActivities(params: {
    deal_id?: number;
    person_id?: number;
    done?: boolean;
    limit?: number;
  }) {
    const qs = new URLSearchParams({ limit: String(params.limit ?? 50) });
    if (params.deal_id) qs.set("deal_id", String(params.deal_id));
    if (params.person_id) qs.set("person_id", String(params.person_id));
    if (params.done != null) qs.set("done", params.done ? "1" : "0");
    return this.request<unknown[]>(`/activities?${qs}`);
  }

  async createActivity(payload: {
    subject: string;
    type: string;
    due_date?: string;
    due_time?: string;
    deal_id?: number;
    person_id?: number;
    note?: string;
  }) {
    return this.request<unknown>("/activities", {
      method: "POST",
      body: JSON.stringify({
        subject: payload.subject,
        type: payload.type,
        ...(payload.due_date ? { due_date: payload.due_date } : {}),
        ...(payload.due_time ? { due_time: payload.due_time } : {}),
        ...(payload.deal_id ? { deal_id: payload.deal_id } : {}),
        ...(payload.person_id ? { person_id: payload.person_id } : {}),
        ...(payload.note ? { note: payload.note } : {}),
      }),
    });
  }

  // ── Pipelines ─────────────────────────────────────────────────────────────

  async listPipelines() {
    const pipelines = await this.request<Array<{ id: number; name: string; active: boolean }>>("/pipelines");
    const result = [];
    for (const p of pipelines ?? []) {
      const stages = await this.request<unknown[]>(`/stages?pipeline_id=${p.id}`);
      result.push({ ...p, stages });
    }
    return result;
  }
}
