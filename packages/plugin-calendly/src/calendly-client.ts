const BASE = "https://api.calendly.com";

export class CalendlyClient {
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
      throw new Error(`Calendly API error ${res.status}: ${text}`);
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

  async getCurrentUser(): Promise<{ resource: { uri: string; organization: string } }> {
    return this.request("/users/me");
  }

  async listEventTypes(organizationUri: string, params: {
    count?: number;
    page_token?: string;
    active?: boolean;
  }): Promise<unknown> {
    return this.request(`/event_types${this.buildQs({ organization: organizationUri, ...params } as Record<string, unknown>)}`);
  }

  async listScheduledEvents(organizationUri: string, params: {
    count?: number;
    page_token?: string;
    min_start_time?: string;
    max_start_time?: string;
    status?: string;
    invitee_email?: string;
    sort?: string;
  }): Promise<unknown> {
    return this.request(`/scheduled_events${this.buildQs({ organization: organizationUri, ...params } as Record<string, unknown>)}`);
  }

  async getScheduledEvent(eventUri: string): Promise<unknown> {
    const uuid = eventUri.split("/").pop()!;
    return this.request(`/scheduled_events/${uuid}`);
  }

  async listEventInvitees(eventUri: string, params: {
    count?: number;
    page_token?: string;
    status?: string;
    email?: string;
  }): Promise<unknown> {
    const uuid = eventUri.split("/").pop()!;
    return this.request(`/scheduled_events/${uuid}/invitees${this.buildQs(params as Record<string, unknown>)}`);
  }

  async listOrganizationInvitations(organizationUri: string, params: {
    count?: number;
    page_token?: string;
    status?: string;
    email?: string;
  }): Promise<unknown> {
    const uuid = organizationUri.split("/").pop()!;
    return this.request(`/organizations/${uuid}/invitations${this.buildQs(params as Record<string, unknown>)}`);
  }

  async cancelEvent(eventUri: string, reason?: string): Promise<unknown> {
    const uuid = eventUri.split("/").pop()!;
    return this.request(`/scheduled_events/${uuid}/cancellation`, {
      method: "POST",
      body: JSON.stringify({ reason: reason ?? "" }),
    });
  }
}
