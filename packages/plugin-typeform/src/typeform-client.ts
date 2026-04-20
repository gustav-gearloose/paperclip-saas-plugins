const BASE = "https://api.typeform.com";

export class TypeformClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Typeform API error ${res.status}: ${text}`);
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

  async listForms(params: { page?: number; page_size?: number; search?: string }): Promise<unknown> {
    return this.request(`/forms${this.buildQs(params as Record<string, unknown>)}`);
  }

  async getForm(formId: string): Promise<unknown> {
    return this.request(`/forms/${formId}`);
  }

  async listResponses(formId: string, params: {
    page_size?: number;
    since?: string;
    until?: string;
    after?: string;
    before?: string;
    query?: string;
    completed?: boolean;
    sort?: string;
  }): Promise<unknown> {
    return this.request(`/forms/${formId}/responses${this.buildQs(params as Record<string, unknown>)}`);
  }

  async getResponse(formId: string, responseId: string): Promise<unknown> {
    return this.request(`/forms/${formId}/responses?included_response_ids=${responseId}`);
  }

  async deleteResponse(formId: string, responseIds: string[]): Promise<unknown> {
    const ids = responseIds.join(",");
    return this.request(`/forms/${formId}/responses?included_response_ids=${ids}`, {
      method: "DELETE",
    });
  }

  async listWebhooks(formId: string): Promise<unknown> {
    return this.request(`/forms/${formId}/webhooks`);
  }

  async getInsights(formId: string): Promise<unknown> {
    return this.request(`/insights/${formId}/summary`);
  }
}
