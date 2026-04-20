/**
 * Minimal Xero API v2 client with OAuth2 refresh token rotation.
 * No xero-node SDK — pure fetch.
 */

export class XeroClient {
  private clientId: string;
  private clientSecret: string;
  private refreshToken: string;
  private tenantId: string;
  private accessToken = "";
  private tokenExpiry = 0;
  private readonly BASE = "https://api.xero.com/api.xro/2.0";

  constructor(clientId: string, clientSecret: string, refreshToken: string, tenantId: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.refreshToken = refreshToken;
    this.tenantId = tenantId;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60_000) {
      return this.accessToken;
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const resp = await fetch("https://identity.xero.com/connect/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.refreshToken,
      }),
    });

    if (!resp.ok) {
      throw new Error(`Xero token refresh failed: ${resp.status} ${await resp.text()}`);
    }

    const data = await resp.json() as { access_token: string; refresh_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;
    if (data.refresh_token) {
      this.refreshToken = data.refresh_token;
    }
    return this.accessToken;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.getAccessToken();
    const resp = await fetch(`${this.BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Xero-Tenant-Id": this.tenantId,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Xero API ${method} ${path} → ${resp.status}: ${text}`);
    }

    return resp.json() as Promise<T>;
  }

  async listInvoices(params: { status?: string; page?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set("where", `Status=="${params.status}"`);
    if (params.page) qs.set("page", String(params.page));
    const q = qs.toString() ? `?${qs}` : "";
    return this.request<unknown>("GET", `/Invoices${q}`);
  }

  async getInvoice(invoiceId: string) {
    return this.request<unknown>("GET", `/Invoices/${encodeURIComponent(invoiceId)}`);
  }

  async createInvoice(invoice: unknown) {
    return this.request<unknown>("PUT", "/Invoices", { Invoices: [invoice] });
  }

  async listContacts(params: { search?: string; page?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.search) qs.set("searchFields", `Name,EmailAddress`);
    if (params.search) qs.set("where", `Name.Contains("${params.search}")`);
    if (params.page) qs.set("page", String(params.page));
    const q = qs.toString() ? `?${qs}` : "";
    return this.request<unknown>("GET", `/Contacts${q}`);
  }

  async getContact(contactId: string) {
    return this.request<unknown>("GET", `/Contacts/${encodeURIComponent(contactId)}`);
  }

  async createContact(contact: unknown) {
    return this.request<unknown>("PUT", "/Contacts", { Contacts: [contact] });
  }

  async listAccounts() {
    return this.request<unknown>("GET", "/Accounts");
  }

  async getBalanceSheet(date?: string) {
    const qs = date ? `?date=${encodeURIComponent(date)}` : "";
    return this.request<unknown>("GET", `/Reports/BalanceSheet${qs}`);
  }

  async listPayments(params: { status?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set("where", `Status=="${params.status}"`);
    const q = qs.toString() ? `?${qs}` : "";
    return this.request<unknown>("GET", `/Payments${q}`);
  }

  async listCreditNotes(params: { status?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set("where", `Status=="${params.status}"`);
    const q = qs.toString() ? `?${qs}` : "";
    return this.request<unknown>("GET", `/CreditNotes${q}`);
  }
}
