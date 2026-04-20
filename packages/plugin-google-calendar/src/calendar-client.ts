/**
 * Minimal Google Calendar v3 REST client using service account JWT auth.
 * No googleapis npm package — just fetch + Node crypto.
 */

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export class GoogleCalendarClient {
  private serviceAccount: ServiceAccountKey;
  private accessToken = "";
  private tokenExpiry = 0;
  private readonly BASE = "https://www.googleapis.com/calendar/v3";

  constructor(serviceAccountJson: string) {
    this.serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccountKey;
    if (!this.serviceAccount.client_email || !this.serviceAccount.private_key) {
      throw new Error("Service account JSON must contain client_email and private_key");
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60_000) {
      return this.accessToken;
    }

    const now = Math.floor(Date.now() / 1000);
    const claim = {
      iss: this.serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/calendar",
      aud: this.serviceAccount.token_uri ?? "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    const jwt = await this.signJwt(claim);

    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!resp.ok) {
      throw new Error(`Google OAuth token error: ${resp.status} ${await resp.text()}`);
    }

    const data = await resp.json() as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;
    return this.accessToken;
  }

  private async signJwt(payload: Record<string, unknown>): Promise<string> {
    const header = { alg: "RS256", typ: "JWT" };
    const encode = (obj: unknown) =>
      Buffer.from(JSON.stringify(obj)).toString("base64url");

    const signingInput = `${encode(header)}.${encode(payload)}`;

    const { createSign } = await import("crypto");
    const sign = createSign("RSA-SHA256");
    sign.update(signingInput);
    const signature = sign.sign(this.serviceAccount.private_key, "base64url");

    return `${signingInput}.${signature}`;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.getAccessToken();
    const resp = await fetch(`${this.BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Google Calendar API ${resp.status}: ${text}`);
    }

    if (resp.status === 204) return {} as T;
    return resp.json() as Promise<T>;
  }

  async listCalendars() {
    return this.request<unknown>("GET", "/users/me/calendarList");
  }

  async listEvents(calendarId: string, params: {
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    q?: string;
    orderBy?: string;
  } = {}) {
    const qs = new URLSearchParams();
    qs.set("singleEvents", "true");
    if (params.timeMin) qs.set("timeMin", params.timeMin);
    if (params.timeMax) qs.set("timeMax", params.timeMax);
    if (params.maxResults) qs.set("maxResults", String(params.maxResults));
    if (params.q) qs.set("q", params.q);
    if (params.orderBy) qs.set("orderBy", params.orderBy);
    return this.request<unknown>("GET", `/calendars/${encodeURIComponent(calendarId)}/events?${qs}`);
  }

  async getEvent(calendarId: string, eventId: string) {
    return this.request<unknown>("GET", `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);
  }

  async createEvent(calendarId: string, event: unknown) {
    return this.request<unknown>("POST", `/calendars/${encodeURIComponent(calendarId)}/events`, event);
  }

  async updateEvent(calendarId: string, eventId: string, patch: unknown) {
    return this.request<unknown>("PATCH", `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, patch);
  }

  async deleteEvent(calendarId: string, eventId: string) {
    return this.request<unknown>("DELETE", `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);
  }

  async findFreeSlots(calendarIds: string[], timeMin: string, timeMax: string) {
    return this.request<unknown>("POST", "/freeBusy", {
      timeMin,
      timeMax,
      items: calendarIds.map(id => ({ id })),
    });
  }
}
