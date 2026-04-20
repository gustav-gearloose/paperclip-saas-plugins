// Mailgun API v3. Region: "us" → api.mailgun.net, "eu" → api.eu.mailgun.net
export class MailgunClient {
  private baseUrl: string;
  private domain: string;
  private authHeader: string;

  constructor(apiKey: string, domain: string, region: string = "us") {
    const host = region === "eu" ? "api.eu.mailgun.net" : "api.mailgun.net";
    this.baseUrl = `https://${host}/v3`;
    this.domain = domain;
    this.authHeader = `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: this.authHeader,
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Mailgun API error ${res.status}: ${text}`);
    }
    if (res.status === 200 && options.method === "DELETE") return { deleted: true } as T;
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

  async sendMessage(data: {
    from: string;
    to: string[];
    subject: string;
    text?: string;
    html?: string;
    cc?: string[];
    bcc?: string[];
    "h:Reply-To"?: string;
    "o:tag"?: string[];
    "o:tracking"?: boolean;
    template?: string;
    "h:X-Mailgun-Variables"?: string;
  }): Promise<unknown> {
    const form = new URLSearchParams();
    form.set("from", data.from);
    data.to.forEach((t) => form.append("to", t));
    form.set("subject", data.subject);
    if (data.text) form.set("text", data.text);
    if (data.html) form.set("html", data.html);
    if (data.cc) data.cc.forEach((c) => form.append("cc", c));
    if (data.bcc) data.bcc.forEach((b) => form.append("bcc", b));
    if (data["h:Reply-To"]) form.set("h:Reply-To", data["h:Reply-To"]);
    if (data.template) form.set("template", data.template);
    if (data["h:X-Mailgun-Variables"]) form.set("h:X-Mailgun-Variables", data["h:X-Mailgun-Variables"]);
    if (data["o:tag"]) data["o:tag"].forEach((t) => form.append("o:tag", t));
    if (data["o:tracking"] !== undefined) form.set("o:tracking", String(data["o:tracking"]));

    return this.request(`/${this.domain}/messages`, {
      method: "POST",
      body: form,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  }

  async getEvents(params: {
    event?: string; limit?: number; begin?: string; end?: string; ascending?: string;
  }): Promise<unknown> {
    return this.request(`/${this.domain}/events${this.buildQs(params as Record<string, unknown>)}`);
  }

  async listSuppressions(type: "bounces" | "unsubscribes" | "complaints", params: { limit?: number; p?: string }): Promise<unknown> {
    return this.request(`/${this.domain}/${type}${this.buildQs(params as Record<string, unknown>)}`);
  }

  async deleteSuppressions(type: "bounces" | "unsubscribes" | "complaints", address: string): Promise<unknown> {
    return this.request(`/${this.domain}/${type}/${encodeURIComponent(address)}`, { method: "DELETE" });
  }

  async listDomains(params: { limit?: number; skip?: number }): Promise<unknown> {
    return this.request(`/domains${this.buildQs(params as Record<string, unknown>)}`);
  }

  async getDomain(): Promise<unknown> {
    return this.request(`/domains/${this.domain}`);
  }

  async listMailingLists(params: { limit?: number; p?: string }): Promise<unknown> {
    return this.request(`/lists/pages${this.buildQs(params as Record<string, unknown>)}`);
  }

  async getMailingList(address: string): Promise<unknown> {
    return this.request(`/lists/${encodeURIComponent(address)}`);
  }

  async listMailingListMembers(address: string, params: { limit?: number; subscribed?: boolean }): Promise<unknown> {
    return this.request(`/lists/${encodeURIComponent(address)}/members/pages${this.buildQs(params as Record<string, unknown>)}`);
  }

  async addMailingListMember(listAddress: string, memberEmail: string, name?: string, upsert = true): Promise<unknown> {
    const form = new URLSearchParams();
    form.set("address", memberEmail);
    if (name) form.set("name", name);
    form.set("upsert", String(upsert));
    return this.request(`/lists/${encodeURIComponent(listAddress)}/members`, {
      method: "POST",
      body: form,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  }

  async getStats(params: { event: string[]; start?: string; end?: string; resolution?: string }): Promise<unknown> {
    const qs = new URLSearchParams();
    params.event.forEach((e) => qs.append("event", e));
    if (params.start) qs.set("start", params.start);
    if (params.end) qs.set("end", params.end);
    if (params.resolution) qs.set("resolution", params.resolution);
    return this.request(`/${this.domain}/stats/total?${qs.toString()}`);
  }
}
