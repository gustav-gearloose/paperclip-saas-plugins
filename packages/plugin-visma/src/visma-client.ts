/**
 * Minimal Visma eAccounting API v2 client with OAuth2 refresh token rotation.
 */

export class VismaClient {
  private clientId: string;
  private clientSecret: string;
  private refreshToken: string;
  private accessToken = "";
  private tokenExpiry = 0;
  private readonly BASE = "https://eaccountingapi.vismaonline.com/v2";
  private readonly TOKEN_URL = "https://identity.vismaonline.com/connect/token";

  constructor(clientId: string, clientSecret: string, refreshToken: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.refreshToken = refreshToken;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60_000) {
      return this.accessToken;
    }

    const resp = await fetch(this.TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!resp.ok) {
      throw new Error(`Visma token refresh failed: ${resp.status} ${await resp.text()}`);
    }

    const data = await resp.json() as { access_token: string; refresh_token?: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;
    if (data.refresh_token) this.refreshToken = data.refresh_token;
    return this.accessToken;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.getAccessToken();
    const resp = await fetch(`${this.BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Visma API ${method} ${path} → ${resp.status}: ${text}`);
    }

    return resp.json() as Promise<T>;
  }

  async listCustomerInvoices(params: { page?: number; limit?: number } = {}) {
    const qs = new URLSearchParams();
    qs.set("limit", String(params.limit ?? 100));
    if (params.page) qs.set("page", String(params.page));
    return this.request<unknown>("GET", `/customerinvoices?${qs}`);
  }

  async getCustomerInvoice(invoiceId: string) {
    return this.request<unknown>("GET", `/customerinvoices/${encodeURIComponent(invoiceId)}`);
  }

  async createCustomerInvoice(invoice: unknown) {
    return this.request<unknown>("POST", "/customerinvoices", invoice);
  }

  async listCustomers(params: { page?: number; limit?: number } = {}) {
    const qs = new URLSearchParams();
    qs.set("limit", String(params.limit ?? 100));
    if (params.page) qs.set("page", String(params.page));
    return this.request<unknown>("GET", `/customers?${qs}`);
  }

  async getCustomer(customerId: string) {
    return this.request<unknown>("GET", `/customers/${encodeURIComponent(customerId)}`);
  }

  async createCustomer(customer: unknown) {
    return this.request<unknown>("POST", "/customers", customer);
  }

  async listArticles(params: { page?: number; limit?: number } = {}) {
    const qs = new URLSearchParams();
    qs.set("limit", String(params.limit ?? 100));
    if (params.page) qs.set("page", String(params.page));
    return this.request<unknown>("GET", `/articles?${qs}`);
  }

  async getAccountBalances(date: string) {
    return this.request<unknown>("GET", `/accountbalances/${encodeURIComponent(date)}`);
  }

  async listVouchers(params: { page?: number; limit?: number } = {}) {
    const qs = new URLSearchParams();
    qs.set("limit", String(params.limit ?? 100));
    if (params.page) qs.set("page", String(params.page));
    return this.request<unknown>("GET", `/vouchers?${qs}`);
  }

  async listFiscalYears() {
    return this.request<unknown>("GET", "/fiscalyears");
  }
}
