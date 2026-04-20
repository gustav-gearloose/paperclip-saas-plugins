export class MailchimpClient {
  private apiKey: string;
  private serverPrefix: string;

  constructor(apiKey: string, serverPrefix: string) {
    this.apiKey = apiKey;
    this.serverPrefix = serverPrefix;
  }

  private get base(): string {
    return `https://${this.serverPrefix}.api.mailchimp.com/3.0`;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      ...options,
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${this.apiKey}`).toString("base64")}`,
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Mailchimp API error ${res.status}: ${text}`);
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

  async getAccountInfo(): Promise<unknown> {
    return this.request("/");
  }

  async listAudiences(params: { count?: number; offset?: number }): Promise<unknown> {
    return this.request(`/lists${this.buildQs(params as Record<string, unknown>)}`);
  }

  async getAudience(listId: string): Promise<unknown> {
    return this.request(`/lists/${listId}`);
  }

  async listMembers(listId: string, params: {
    count?: number;
    offset?: number;
    status?: string;
    email_address?: string;
  }): Promise<unknown> {
    return this.request(`/lists/${listId}/members${this.buildQs(params as Record<string, unknown>)}`);
  }

  async getMember(listId: string, emailOrHash: string): Promise<unknown> {
    const hash = emailOrHash.includes("@")
      ? Buffer.from(emailOrHash.toLowerCase()).toString("hex")
      : emailOrHash;
    return this.request(`/lists/${listId}/members/${hash}`);
  }

  async addOrUpdateMember(listId: string, email: string, body: {
    status?: string;
    merge_fields?: Record<string, unknown>;
    tags?: string[];
  }): Promise<unknown> {
    const hash = Buffer.from(email.toLowerCase()).toString("hex");
    return this.request(`/lists/${listId}/members/${hash}`, {
      method: "PUT",
      body: JSON.stringify({ email_address: email, status_if_new: body.status ?? "subscribed", ...body }),
    });
  }

  async archiveMember(listId: string, email: string): Promise<unknown> {
    const hash = Buffer.from(email.toLowerCase()).toString("hex");
    return this.request(`/lists/${listId}/members/${hash}`, { method: "DELETE" });
  }

  async listCampaigns(params: {
    count?: number;
    offset?: number;
    status?: string;
    list_id?: string;
  }): Promise<unknown> {
    return this.request(`/campaigns${this.buildQs(params as Record<string, unknown>)}`);
  }

  async getCampaign(campaignId: string): Promise<unknown> {
    return this.request(`/campaigns/${campaignId}`);
  }

  async getCampaignReport(campaignId: string): Promise<unknown> {
    return this.request(`/reports/${campaignId}`);
  }

  async listTags(listId: string, params: { count?: number; offset?: number }): Promise<unknown> {
    return this.request(`/lists/${listId}/tag-search${this.buildQs(params as Record<string, unknown>)}`);
  }

  async addTagsToMember(listId: string, email: string, tags: string[]): Promise<unknown> {
    const hash = Buffer.from(email.toLowerCase()).toString("hex");
    const body = { tags: tags.map(name => ({ name, status: "active" })) };
    return this.request(`/lists/${listId}/members/${hash}/tags`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
}
