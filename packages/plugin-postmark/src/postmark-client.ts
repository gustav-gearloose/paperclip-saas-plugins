const BASE = "https://api.postmarkapp.com";

export class PostmarkClient {
  private serverToken: string;

  constructor(serverToken: string) {
    this.serverToken = serverToken;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        "X-Postmark-Server-Token": this.serverToken,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Postmark API error ${res.status}: ${text}`);
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

  async sendEmail(data: {
    From: string;
    To: string;
    Subject: string;
    TextBody?: string;
    HtmlBody?: string;
    ReplyTo?: string;
    Cc?: string;
    Bcc?: string;
    Tag?: string;
    TrackOpens?: boolean;
    TrackLinks?: string;
    MessageStream?: string;
  }): Promise<unknown> {
    return this.request("/email", { method: "POST", body: JSON.stringify(data) });
  }

  async sendEmailWithTemplate(data: {
    From: string;
    To: string;
    TemplateId?: number;
    TemplateAlias?: string;
    TemplateModel: Record<string, unknown>;
    ReplyTo?: string;
    Tag?: string;
    MessageStream?: string;
  }): Promise<unknown> {
    return this.request("/email/withTemplate", { method: "POST", body: JSON.stringify(data) });
  }

  async getOutboundStats(params: {
    tag?: string; fromdate?: string; todate?: string; messagestream?: string;
  }): Promise<unknown> {
    return this.request(`/stats/outbound${this.buildQs(params as Record<string, unknown>)}`);
  }

  async listOutboundMessages(params: {
    count?: number; offset?: number; recipient?: string; tag?: string; status?: string;
    fromdate?: string; todate?: string; messagestream?: string;
  }): Promise<unknown> {
    return this.request(`/messages/outbound${this.buildQs(params as Record<string, unknown>)}`);
  }

  async getOutboundMessageDetails(messageId: string): Promise<unknown> {
    return this.request(`/messages/outbound/${messageId}/details`);
  }

  async listInboundMessages(params: {
    count?: number; offset?: number; recipient?: string; subject?: string; mailboxhash?: string; status?: string;
  }): Promise<unknown> {
    return this.request(`/messages/inbound${this.buildQs(params as Record<string, unknown>)}`);
  }

  async listBounces(params: {
    count?: number; offset?: number; type?: string; emailFilter?: string;
    fromdate?: string; todate?: string; messagestream?: string;
  }): Promise<unknown> {
    return this.request(`/bounces${this.buildQs(params as Record<string, unknown>)}`);
  }

  async getBounce(bounceId: number): Promise<unknown> {
    return this.request(`/bounces/${bounceId}`);
  }

  async activateBounce(bounceId: number): Promise<unknown> {
    return this.request(`/bounces/${bounceId}/activate`, { method: "PUT" });
  }

  async listTemplates(params: { count?: number; offset?: number; messagestream?: string }): Promise<unknown> {
    return this.request(`/templates${this.buildQs(params as Record<string, unknown>)}`);
  }

  async getTemplate(idOrAlias: string | number): Promise<unknown> {
    return this.request(`/templates/${idOrAlias}`);
  }

  async listServers(params: { count?: number; offset?: number; name?: string }): Promise<unknown> {
    return this.request(`/servers${this.buildQs(params as Record<string, unknown>)}`);
  }

  async getServer(): Promise<unknown> {
    return this.request("/server");
  }

  async listSuppressions(params: { messagestream?: string; emailaddress?: string }): Promise<unknown> {
    return this.request(`/message-streams/${params.messagestream ?? "outbound"}/suppressions${this.buildQs({ emailaddress: params.emailaddress } as Record<string, unknown>)}`);
  }
}
