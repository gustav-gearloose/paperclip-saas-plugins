const BASE = "https://api.twilio.com/2010-04-01";

export class TwilioClient {
  private accountSid: string;
  private authToken: string;

  constructor(accountSid: string, authToken: string) {
    this.accountSid = accountSid;
    this.authToken = authToken;
  }

  private get authHeader(): string {
    return `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = path.startsWith("http") ? path : `${BASE}/Accounts/${this.accountSid}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: this.authHeader,
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Twilio API error ${res.status}: ${text}`);
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

  async getAccountInfo(): Promise<unknown> {
    return this.request(`.json`);
  }

  async sendSms(from: string, to: string, body: string): Promise<unknown> {
    const formData = new URLSearchParams({ From: from, To: to, Body: body });
    return this.request(`/Messages.json`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });
  }

  async listMessages(params: {
    PageSize?: number;
    To?: string;
    From?: string;
    DateSent?: string;
    DateSentAfter?: string;
    DateSentBefore?: string;
  }): Promise<unknown> {
    return this.request(`/Messages.json${this.buildQs(params as Record<string, unknown>)}`);
  }

  async getMessage(messageSid: string): Promise<unknown> {
    return this.request(`/Messages/${messageSid}.json`);
  }

  async listPhoneNumbers(): Promise<unknown> {
    return this.request(`/IncomingPhoneNumbers.json`);
  }

  async listCalls(params: {
    PageSize?: number;
    To?: string;
    From?: string;
    Status?: string;
    StartTimeAfter?: string;
    StartTimeBefore?: string;
  }): Promise<unknown> {
    return this.request(`/Calls.json${this.buildQs(params as Record<string, unknown>)}`);
  }

  async getCall(callSid: string): Promise<unknown> {
    return this.request(`/Calls/${callSid}.json`);
  }

  async makeCall(from: string, to: string, url: string): Promise<unknown> {
    const formData = new URLSearchParams({ From: from, To: to, Url: url });
    return this.request(`/Calls.json`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });
  }
}
