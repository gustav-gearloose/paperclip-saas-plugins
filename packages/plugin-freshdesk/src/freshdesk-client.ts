export class FreshdeskClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(apiKey: string, domain: string) {
    this.baseUrl = `https://${domain}.freshdesk.com/api/v2`;
    const encoded = Buffer.from(`${apiKey}:X`).toString("base64");
    this.headers = {
      Authorization: `Basic ${encoded}`,
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
      throw new Error(`Freshdesk ${method} ${path} → ${res.status}: ${text}`);
    }
    if (res.status === 204) return {} as T;
    return res.json() as Promise<T>;
  }

  async listTickets(params: { status?: number; priority?: number; limit?: number; page?: number }): Promise<unknown> {
    const qs = new URLSearchParams({ per_page: String(params.limit ?? 30), page: String(params.page ?? 1) });
    if (params.status != null) qs.set("status", String(params.status));
    if (params.priority != null) qs.set("priority", String(params.priority));
    return this.request("GET", `/tickets?${qs}`);
  }

  async getTicket(id: number): Promise<unknown> {
    const [ticket, conversations] = await Promise.all([
      this.request("GET", `/tickets/${id}`),
      this.request("GET", `/tickets/${id}/conversations`),
    ]);
    return { ticket, conversations };
  }

  async createTicket(params: {
    subject: string;
    description: string;
    email: string;
    priority?: number;
    status?: number;
    tags?: string[];
    type?: string;
  }): Promise<unknown> {
    return this.request("POST", "/tickets", {
      subject: params.subject,
      description: params.description,
      email: params.email,
      priority: params.priority ?? 1,
      status: params.status ?? 2,
      tags: params.tags,
      type: params.type,
    });
  }

  async updateTicket(id: number, updates: {
    subject?: string;
    priority?: number;
    status?: number;
    type?: string;
    tags?: string[];
    assignee_id?: number;
  }): Promise<unknown> {
    return this.request("PUT", `/tickets/${id}`, updates);
  }

  async listContacts(params: { query?: string; limit?: number; page?: number }): Promise<unknown> {
    const qs = new URLSearchParams({ per_page: String(params.limit ?? 30), page: String(params.page ?? 1) });
    if (params.query) qs.set("query", `"${params.query}"`);
    const path = params.query ? `/search/contacts?${qs}` : `/contacts?${qs}`;
    return this.request("GET", path);
  }

  async getContact(id: number): Promise<unknown> {
    return this.request("GET", `/contacts/${id}`);
  }

  async createContact(params: {
    name: string;
    email?: string;
    phone?: string;
    company_id?: number;
    tags?: string[];
  }): Promise<unknown> {
    return this.request("POST", "/contacts", params);
  }

  async listAgents(params: { limit?: number }): Promise<unknown> {
    return this.request("GET", `/agents?per_page=${params.limit ?? 50}`);
  }

  async addNote(ticketId: number, params: { body: string; private?: boolean; agent_id?: number }): Promise<unknown> {
    return this.request("POST", `/tickets/${ticketId}/notes`, {
      body: params.body,
      private: params.private ?? true,
      agent_id: params.agent_id,
    });
  }

  async replyToTicket(ticketId: number, params: { body: string; from_email?: string; cc_emails?: string[] }): Promise<unknown> {
    return this.request("POST", `/tickets/${ticketId}/reply`, {
      body: params.body,
      from_email: params.from_email,
      cc_emails: params.cc_emails,
    });
  }
}
