const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export interface GraphClientConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  defaultUser: string;
}

export class GraphClient {
  private readonly tenantId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  readonly defaultUser: string;
  private accessToken = "";
  private tokenExpiresAt = 0;

  constructor(config: GraphClientConfig) {
    this.tenantId = config.tenantId;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.defaultUser = config.defaultUser;
  }

  private async ensureToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) return;
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: "https://graph.microsoft.com/.default",
    });
    const res = await fetch(
      `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() }
    );
    if (!res.ok) throw new Error(`Token request failed: ${res.status} ${await res.text()}`);
    const data = await res.json() as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    await this.ensureToken();
    const res = await fetch(`${GRAPH_BASE}${path}`, {
      ...options,
      headers: {
        "Authorization": `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string> ?? {}),
      },
    });
    if (res.status === 204) return undefined as unknown as T;
    if (!res.ok) throw new Error(`Graph API ${options.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  private user(override?: string): string {
    return override ?? this.defaultUser;
  }

  // ── Messages ───────────────────────────────────────────────────────────────

  async listMessages(params: {
    folder?: string;
    search?: string;
    from_date?: string;
    limit?: number;
    user?: string;
  }) {
    const folder = params.folder ?? "inbox";
    const limit = params.limit ?? 20;
    const base = `/users/${this.user(params.user)}/mailFolders/${folder}/messages`;
    const qs = new URLSearchParams({ $top: String(limit), $orderby: "receivedDateTime desc" });
    if (params.search) qs.set("$search", `"${params.search}"`);
    if (params.from_date) qs.set("$filter", `receivedDateTime ge ${params.from_date}`);
    const data = await this.request<{ value: unknown[] }>(`${base}?${qs}`);
    return data.value ?? [];
  }

  async getMessage(messageId: string, user?: string) {
    return this.request<unknown>(`/users/${this.user(user)}/messages/${messageId}?$select=id,subject,from,toRecipients,ccRecipients,body,receivedDateTime,isRead`);
  }

  async sendMessage(params: {
    to: string[];
    subject: string;
    body: string;
    body_type?: string;
    cc?: string[];
    user?: string;
  }) {
    const payload = {
      message: {
        subject: params.subject,
        body: { contentType: params.body_type ?? "Text", content: params.body },
        toRecipients: params.to.map(a => ({ emailAddress: { address: a } })),
        ccRecipients: (params.cc ?? []).map(a => ({ emailAddress: { address: a } })),
      },
    };
    await this.request<unknown>(`/users/${this.user(params.user)}/sendMail`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return { sent: true };
  }

  async replyMessage(messageId: string, body: string, user?: string) {
    await this.request<unknown>(`/users/${this.user(user)}/messages/${messageId}/reply`, {
      method: "POST",
      body: JSON.stringify({ comment: body }),
    });
    return { replied: true };
  }

  async listFolders(user?: string) {
    const data = await this.request<{ value: unknown[] }>(`/users/${this.user(user)}/mailFolders?$top=50`);
    return data.value ?? [];
  }

  // ── Calendar ───────────────────────────────────────────────────────────────

  async listEvents(params: {
    start?: string;
    end?: string;
    limit?: number;
    user?: string;
  }) {
    const now = new Date().toISOString();
    const weekOut = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const start = params.start ?? now;
    const end = params.end ?? weekOut;
    const limit = params.limit ?? 20;
    const qs = new URLSearchParams({
      startDateTime: start,
      endDateTime: end,
      $top: String(limit),
      $orderby: "start/dateTime asc",
    });
    const data = await this.request<{ value: unknown[] }>(`/users/${this.user(params.user)}/calendarView?${qs}`);
    return data.value ?? [];
  }

  async getEvent(eventId: string, user?: string) {
    return this.request<unknown>(`/users/${this.user(user)}/events/${eventId}`);
  }

  async createEvent(params: {
    subject: string;
    start: string;
    end: string;
    timezone?: string;
    body?: string;
    attendees?: string[];
    location?: string;
    user?: string;
  }) {
    const tz = params.timezone ?? "UTC";
    const payload: Record<string, unknown> = {
      subject: params.subject,
      start: { dateTime: params.start, timeZone: tz },
      end: { dateTime: params.end, timeZone: tz },
    };
    if (params.body) payload.body = { contentType: "Text", content: params.body };
    if (params.location) payload.location = { displayName: params.location };
    if (params.attendees?.length) {
      payload.attendees = params.attendees.map(a => ({
        emailAddress: { address: a },
        type: "required",
      }));
    }
    return this.request<unknown>(`/users/${this.user(params.user)}/events`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateEvent(params: {
    event_id: string;
    subject?: string;
    start?: string;
    end?: string;
    timezone?: string;
    body?: string;
    location?: string;
    user?: string;
  }) {
    const tz = params.timezone ?? "UTC";
    const payload: Record<string, unknown> = {};
    if (params.subject) payload.subject = params.subject;
    if (params.start) payload.start = { dateTime: params.start, timeZone: tz };
    if (params.end) payload.end = { dateTime: params.end, timeZone: tz };
    if (params.body) payload.body = { contentType: "Text", content: params.body };
    if (params.location) payload.location = { displayName: params.location };
    return this.request<unknown>(`/users/${this.user(params.user)}/events/${params.event_id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async deleteEvent(eventId: string, user?: string) {
    await this.request<unknown>(`/users/${this.user(user)}/events/${eventId}`, { method: "DELETE" });
    return { deleted: true };
  }
}
