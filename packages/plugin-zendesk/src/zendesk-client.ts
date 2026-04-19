/**
 * Minimal Zendesk Support API v2 client.
 * Auth: Basic auth with email/token — "email@example.com/token:<api_token>"
 * Base: https://{subdomain}.zendesk.com/api/v2
 */

export class ZendeskClient {
  private base: string;
  private headers: Record<string, string>;

  constructor(subdomain: string, email: string, apiToken: string) {
    this.base = `https://${subdomain}.zendesk.com/api/v2`;
    const creds = Buffer.from(`${email}/token:${apiToken}`).toString("base64");
    this.headers = {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  private async get(path: string, params?: Record<string, string | number>): Promise<unknown> {
    const url = new URL(`${this.base}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, String(v));
      }
    }
    const resp = await fetch(url.toString(), { headers: this.headers });
    if (!resp.ok) throw new Error(`Zendesk API ${resp.status} GET ${path}: ${await resp.text()}`);
    return resp.json();
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const resp = await fetch(`${this.base}${path}`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`Zendesk API ${resp.status} POST ${path}: ${await resp.text()}`);
    return resp.json();
  }

  async listTickets(opts?: {
    status?: string;
    pageSize?: number;
    page?: number;
  }): Promise<unknown> {
    const params: Record<string, string | number> = {
      per_page: opts?.pageSize ?? 50,
      page: opts?.page ?? 1,
      sort_by: "created_at",
      sort_order: "desc",
    };
    if (opts?.status) params["status"] = opts.status;
    return this.get("/tickets", params);
  }

  async getTicket(ticketId: number): Promise<unknown> {
    return this.get(`/tickets/${ticketId}`);
  }

  async getTicketComments(ticketId: number): Promise<unknown> {
    return this.get(`/tickets/${ticketId}/comments`);
  }

  async searchTickets(query: string, opts?: { pageSize?: number; page?: number }): Promise<unknown> {
    return this.get("/search", {
      query: `type:ticket ${query}`,
      per_page: opts?.pageSize ?? 25,
      page: opts?.page ?? 1,
    });
  }

  async createTicket(opts: {
    subject: string;
    body: string;
    requesterName?: string;
    requesterEmail?: string;
    priority?: string;
    tags?: string[];
  }): Promise<unknown> {
    const ticket: Record<string, unknown> = {
      subject: opts.subject,
      comment: { body: opts.body },
      priority: opts.priority ?? "normal",
    };
    if (opts.requesterName || opts.requesterEmail) {
      ticket.requester = {
        name: opts.requesterName ?? opts.requesterEmail ?? "Unknown",
        email: opts.requesterEmail,
      };
    }
    if (opts.tags?.length) ticket.tags = opts.tags;
    return this.post("/tickets", { ticket });
  }

  async listUsers(opts?: { role?: string; pageSize?: number; page?: number }): Promise<unknown> {
    const params: Record<string, string | number> = {
      per_page: opts?.pageSize ?? 50,
      page: opts?.page ?? 1,
    };
    if (opts?.role) params["role"] = opts.role;
    return this.get("/users", params);
  }

  async getUser(userId: number): Promise<unknown> {
    return this.get(`/users/${userId}`);
  }

  async searchUsers(query: string): Promise<unknown> {
    return this.get("/search", { query: `type:user ${query}` });
  }

  async listGroups(): Promise<unknown> {
    return this.get("/groups");
  }
}
