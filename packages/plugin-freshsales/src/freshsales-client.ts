export class FreshsalesClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(apiKey: string, domain: string) {
    this.baseUrl = `https://${domain}.myfreshworks.com/crm/sales/api`;
    this.headers = {
      Authorization: `Token token=${apiKey}`,
      "Content-Type": "application/json",
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Freshsales ${method} ${path} → ${res.status}: ${text}`);
    }
    if (res.status === 204) return {} as T;
    return res.json() as Promise<T>;
  }

  // ── Contacts ───────────────────────────────────────────────────────────────

  async listContacts(params: { page?: number; limit?: number } = {}): Promise<unknown> {
    const qs = new URLSearchParams({
      page: String(params.page ?? 1),
      per_page: String(params.limit ?? 25),
    });
    const views = await this.request<{ filters: Array<{ id: number; name: string }> }>("GET", "/contacts/filters");
    const allView = views.filters?.find(f => f.name === "All Contacts") ?? views.filters?.[0];
    if (!allView) return { contacts: [] };
    return this.request("GET", `/contacts/view/${allView.id}?${qs}`);
  }

  async getContact(id: number): Promise<unknown> {
    return this.request("GET", `/contacts/${id}?include=sales_accounts,deals,notes`);
  }

  async createContact(params: {
    first_name?: string;
    last_name?: string;
    email?: string;
    mobile_number?: string;
    work_number?: string;
    job_title?: string;
    lead_source_id?: number;
    owner_id?: number;
  }): Promise<unknown> {
    return this.request("POST", "/contacts", { contact: params });
  }

  async updateContact(id: number, params: Record<string, unknown>): Promise<unknown> {
    return this.request("PUT", `/contacts/${id}`, { contact: params });
  }

  async deleteContact(id: number): Promise<unknown> {
    return this.request("DELETE", `/contacts/${id}`);
  }

  // ── Accounts ───────────────────────────────────────────────────────────────

  async listAccounts(params: { page?: number; limit?: number } = {}): Promise<unknown> {
    const qs = new URLSearchParams({
      page: String(params.page ?? 1),
      per_page: String(params.limit ?? 25),
    });
    const views = await this.request<{ filters: Array<{ id: number; name: string }> }>("GET", "/sales_accounts/filters");
    const allView = views.filters?.find(f => f.name === "All Accounts") ?? views.filters?.[0];
    if (!allView) return { sales_accounts: [] };
    return this.request("GET", `/sales_accounts/view/${allView.id}?${qs}`);
  }

  async getAccount(id: number): Promise<unknown> {
    return this.request("GET", `/sales_accounts/${id}?include=contacts,deals`);
  }

  async createAccount(params: {
    name: string;
    website?: string;
    phone?: string;
    industry_type_id?: number;
    owner_id?: number;
  }): Promise<unknown> {
    return this.request("POST", "/sales_accounts", { sales_account: params });
  }

  // ── Deals ──────────────────────────────────────────────────────────────────

  async listDeals(params: { page?: number; limit?: number } = {}): Promise<unknown> {
    const qs = new URLSearchParams({
      page: String(params.page ?? 1),
      per_page: String(params.limit ?? 25),
    });
    const views = await this.request<{ filters: Array<{ id: number; name: string }> }>("GET", "/deals/filters");
    const allView = views.filters?.find(f => f.name === "All Deals") ?? views.filters?.[0];
    if (!allView) return { deals: [] };
    return this.request("GET", `/deals/view/${allView.id}?${qs}`);
  }

  async getDeal(id: number): Promise<unknown> {
    return this.request("GET", `/deals/${id}?include=contacts,sales_account,notes`);
  }

  async createDeal(params: {
    name: string;
    amount?: number;
    deal_stage_id?: number;
    owner_id?: number;
    close_date?: string;
    sales_account_id?: number;
  }): Promise<unknown> {
    return this.request("POST", "/deals", { deal: params });
  }

  async updateDeal(id: number, params: Record<string, unknown>): Promise<unknown> {
    return this.request("PUT", `/deals/${id}`, { deal: params });
  }

  // ── Notes ──────────────────────────────────────────────────────────────────

  async createNote(params: {
    description: string;
    targetable_type: "Contact" | "SalesAccount" | "Deal";
    targetable_id: number;
  }): Promise<unknown> {
    return this.request("POST", "/notes", { note: params });
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────

  async listTasks(params: { filter?: string; page?: number } = {}): Promise<unknown> {
    const qs = new URLSearchParams({ page: String(params.page ?? 1) });
    if (params.filter) qs.set("filter", params.filter);
    return this.request("GET", `/tasks?${qs}`);
  }

  async createTask(params: {
    title: string;
    due_date: string;
    owner_id?: number;
    targetable_type?: "Contact" | "SalesAccount" | "Deal";
    targetable_id?: number;
  }): Promise<unknown> {
    return this.request("POST", "/tasks", { task: params });
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  async search(params: {
    query: string;
    include?: string;
  }): Promise<unknown> {
    const include = params.include ?? "contact,sales_account,deal";
    const qs = new URLSearchParams({ q: params.query, include });
    return this.request("GET", `/search?${qs}`);
  }
}
