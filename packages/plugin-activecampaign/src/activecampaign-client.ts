export class ActiveCampaignClient {
  private apiKey: string;
  private accountUrl: string;

  constructor(apiKey: string, accountUrl: string) {
    this.apiKey = apiKey;
    // Normalize: strip trailing slash
    this.accountUrl = accountUrl.replace(/\/$/, "");
  }

  private get base(): string {
    return `${this.accountUrl}/api/3`;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      ...options,
      headers: {
        "Api-Token": this.apiKey,
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ActiveCampaign API error ${res.status}: ${text}`);
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

  async listContacts(params: {
    limit?: number;
    offset?: number;
    email?: string;
    search?: string;
    status?: number;
    listid?: string;
    tagid?: string;
  }): Promise<unknown> {
    return this.request(`/contacts${this.buildQs(params as Record<string, unknown>)}`);
  }

  async getContact(contactId: string): Promise<unknown> {
    return this.request(`/contacts/${contactId}`);
  }

  async createContact(data: {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    fieldValues?: Array<{ field: string; value: string }>;
  }): Promise<unknown> {
    return this.request("/contacts", {
      method: "POST",
      body: JSON.stringify({ contact: data }),
    });
  }

  async updateContact(contactId: string, data: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    fieldValues?: Array<{ field: string; value: string }>;
  }): Promise<unknown> {
    return this.request(`/contacts/${contactId}`, {
      method: "PUT",
      body: JSON.stringify({ contact: data }),
    });
  }

  async listLists(params: { limit?: number; offset?: number }): Promise<unknown> {
    return this.request(`/lists${this.buildQs(params as Record<string, unknown>)}`);
  }

  async listTags(params: { limit?: number; offset?: number; search?: string }): Promise<unknown> {
    return this.request(`/tags${this.buildQs(params as Record<string, unknown>)}`);
  }

  async addTagToContact(contactId: string, tagId: string): Promise<unknown> {
    return this.request("/contactTags", {
      method: "POST",
      body: JSON.stringify({ contactTag: { contact: contactId, tag: tagId } }),
    });
  }

  async listDeals(params: {
    limit?: number;
    offset?: number;
    search?: string;
    stage?: string;
    group?: string;
    status?: number;
  }): Promise<unknown> {
    return this.request(`/deals${this.buildQs(params as Record<string, unknown>)}`);
  }

  async getDeal(dealId: string): Promise<unknown> {
    return this.request(`/deals/${dealId}`);
  }

  async createDeal(data: {
    title: string;
    contact: string;
    value?: number;
    currency?: string;
    pipeline?: string;
    stage?: string;
    owner?: string;
  }): Promise<unknown> {
    return this.request("/deals", {
      method: "POST",
      body: JSON.stringify({ deal: data }),
    });
  }

  async listAutomations(params: { limit?: number; offset?: number }): Promise<unknown> {
    return this.request(`/automations${this.buildQs(params as Record<string, unknown>)}`);
  }

  async addContactToAutomation(contactId: string, automationId: string): Promise<unknown> {
    return this.request("/contactAutomations", {
      method: "POST",
      body: JSON.stringify({ contactAutomation: { contact: contactId, automation: automationId } }),
    });
  }
}
