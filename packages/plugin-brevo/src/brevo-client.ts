const BASE = "https://api.brevo.com/v3";

export class BrevoClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        "api-key": this.apiKey,
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Brevo API error ${res.status}: ${text}`);
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
    return this.request("/account");
  }

  async sendTransactionalEmail(data: {
    to: Array<{ email: string; name?: string }>;
    subject: string;
    htmlContent?: string;
    textContent?: string;
    sender: { email: string; name?: string };
    replyTo?: { email: string; name?: string };
    templateId?: number;
    params?: Record<string, unknown>;
  }): Promise<unknown> {
    return this.request("/smtp/email", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async listContacts(params: {
    limit?: number;
    offset?: number;
    sort?: string;
    email?: string;
  }): Promise<unknown> {
    return this.request(`/contacts${this.buildQs(params as Record<string, unknown>)}`);
  }

  async getContact(emailOrId: string): Promise<unknown> {
    return this.request(`/contacts/${encodeURIComponent(emailOrId)}`);
  }

  async createContact(data: {
    email: string;
    attributes?: Record<string, unknown>;
    listIds?: number[];
    emailBlacklisted?: boolean;
    smsBlacklisted?: boolean;
  }): Promise<unknown> {
    return this.request("/contacts", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateContact(emailOrId: string, data: {
    attributes?: Record<string, unknown>;
    listIds?: number[];
    unlinkListIds?: number[];
    emailBlacklisted?: boolean;
    smsBlacklisted?: boolean;
  }): Promise<unknown> {
    return this.request(`/contacts/${encodeURIComponent(emailOrId)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async listLists(params: { limit?: number; offset?: number; sort?: string }): Promise<unknown> {
    return this.request(`/contacts/lists${this.buildQs(params as Record<string, unknown>)}`);
  }

  async listEmailCampaigns(params: {
    limit?: number;
    offset?: number;
    type?: string;
    status?: string;
    sort?: string;
  }): Promise<unknown> {
    return this.request(`/emailCampaigns${this.buildQs(params as Record<string, unknown>)}`);
  }

  async getEmailCampaign(campaignId: number): Promise<unknown> {
    return this.request(`/emailCampaigns/${campaignId}`);
  }

  async getEmailCampaignReport(campaignId: number): Promise<unknown> {
    return this.request(`/emailCampaigns/${campaignId}/report`);
  }

  async listTransactionalEmailLogs(params: {
    limit?: number;
    offset?: number;
    email?: string;
    sort?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<unknown> {
    return this.request(`/smtp/emails${this.buildQs(params as Record<string, unknown>)}`);
  }
}
