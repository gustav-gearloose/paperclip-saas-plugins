const BASE = "https://api.sendgrid.com/v3";

export class SendGridClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SendGrid API error ${res.status}: ${text}`);
    }
    if (res.status === 202 || res.status === 204) return {} as T;
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

  async sendEmail(data: {
    to: Array<{ email: string; name?: string }>;
    from: { email: string; name?: string };
    subject: string;
    text?: string;
    html?: string;
    templateId?: string;
    dynamicTemplateData?: Record<string, unknown>;
    replyTo?: { email: string; name?: string };
  }): Promise<unknown> {
    const personalizations = [{ to: data.to }];
    const body: Record<string, unknown> = {
      personalizations,
      from: data.from,
      subject: data.subject,
    };
    if (data.text) body.content = [{ type: "text/plain", value: data.text }];
    if (data.html) {
      body.content = [...((body.content as unknown[]) ?? []), { type: "text/html", value: data.html }];
    }
    if (data.templateId) {
      body.template_id = data.templateId;
      (personalizations[0] as Record<string, unknown>).dynamic_template_data = data.dynamicTemplateData ?? {};
    }
    if (data.replyTo) body.reply_to = data.replyTo;
    return this.request("/mail/send", { method: "POST", body: JSON.stringify(body) });
  }

  async listContacts(params: { page_size?: number; page_token?: string }): Promise<unknown> {
    return this.request(`/marketing/contacts${this.buildQs(params as Record<string, unknown>)}`);
  }

  async searchContacts(query: string): Promise<unknown> {
    return this.request("/marketing/contacts/search", {
      method: "POST",
      body: JSON.stringify({ query }),
    });
  }

  async upsertContacts(contacts: Array<{
    email: string;
    first_name?: string;
    last_name?: string;
    custom_fields?: Record<string, unknown>;
  }>): Promise<unknown> {
    return this.request("/marketing/contacts", {
      method: "PUT",
      body: JSON.stringify({ contacts }),
    });
  }

  async deleteContacts(ids: string[]): Promise<unknown> {
    return this.request(`/marketing/contacts${this.buildQs({ ids: ids.join(",") })}`, {
      method: "DELETE",
    });
  }

  async listLists(params: { page_size?: number; page_token?: string }): Promise<unknown> {
    return this.request(`/marketing/lists${this.buildQs(params as Record<string, unknown>)}`);
  }

  async getList(listId: string): Promise<unknown> {
    return this.request(`/marketing/lists/${listId}`);
  }

  async createList(name: string): Promise<unknown> {
    return this.request("/marketing/lists", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  async addContactsToList(listId: string, contactIds: string[]): Promise<unknown> {
    return this.request(`/marketing/lists/${listId}/contacts`, {
      method: "POST",
      body: JSON.stringify({ contact_ids: contactIds }),
    });
  }

  async listTemplates(params: { generations?: string; page_size?: number }): Promise<unknown> {
    return this.request(`/templates${this.buildQs({ ...params, generations: params.generations ?? "dynamic" } as Record<string, unknown>)}`);
  }

  async getTemplate(templateId: string): Promise<unknown> {
    return this.request(`/templates/${templateId}`);
  }

  async getStats(params: {
    start_date: string;
    end_date?: string;
    aggregated_by?: string;
  }): Promise<unknown> {
    return this.request(`/stats${this.buildQs(params as Record<string, unknown>)}`);
  }

  async listSuppressions(params: { start_time?: number; end_time?: number; limit?: number; offset?: number }): Promise<unknown> {
    return this.request(`/suppression/unsubscribes${this.buildQs(params as Record<string, unknown>)}`);
  }

  async addToGlobalUnsubscribes(emails: string[]): Promise<unknown> {
    return this.request("/asm/suppressions/global", {
      method: "POST",
      body: JSON.stringify({ recipient_emails: emails }),
    });
  }
}
