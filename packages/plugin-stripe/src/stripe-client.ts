const BASE_URL = "https://api.stripe.com/v1";

export class StripeClient {
  private headers: Record<string, string>;

  constructor(secretKey: string) {
    this.headers = {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };
  }

  private async request<T>(method: string, path: string, params?: Record<string, string>): Promise<T> {
    const url = `${BASE_URL}${path}`;
    const options: RequestInit = { method, headers: this.headers };
    if (params && method === "GET") {
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`${url}?${qs}`, options);
      return this.handleResponse<T>(res, method, path);
    }
    if (params && method === "POST") {
      options.body = new URLSearchParams(params).toString();
    }
    const res = await fetch(url, options);
    return this.handleResponse<T>(res, method, path);
  }

  private async handleResponse<T>(res: Response, method: string, path: string): Promise<T> {
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Stripe ${method} ${path} → ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async listCustomers(params: { email?: string; limit?: number; starting_after?: string }): Promise<unknown> {
    const p: Record<string, string> = { limit: String(params.limit ?? 20) };
    if (params.email) p.email = params.email;
    if (params.starting_after) p.starting_after = params.starting_after;
    return this.request("GET", "/customers", p);
  }

  async getCustomer(id: string): Promise<unknown> {
    return this.request("GET", `/customers/${id}`);
  }

  async createCustomer(params: { email?: string; name?: string; phone?: string; description?: string }): Promise<unknown> {
    const p: Record<string, string> = {};
    if (params.email) p.email = params.email;
    if (params.name) p.name = params.name;
    if (params.phone) p.phone = params.phone;
    if (params.description) p.description = params.description;
    return this.request("POST", "/customers", p);
  }

  async listSubscriptions(params: { customer?: string; status?: string; limit?: number }): Promise<unknown> {
    const p: Record<string, string> = { limit: String(params.limit ?? 20) };
    if (params.customer) p.customer = params.customer;
    if (params.status) p.status = params.status;
    return this.request("GET", "/subscriptions", p);
  }

  async getSubscription(id: string): Promise<unknown> {
    return this.request("GET", `/subscriptions/${id}`);
  }

  async listInvoices(params: { customer?: string; status?: string; limit?: number; subscription?: string }): Promise<unknown> {
    const p: Record<string, string> = { limit: String(params.limit ?? 20) };
    if (params.customer) p.customer = params.customer;
    if (params.status) p.status = params.status;
    if (params.subscription) p.subscription = params.subscription;
    return this.request("GET", "/invoices", p);
  }

  async getInvoice(id: string): Promise<unknown> {
    return this.request("GET", `/invoices/${id}`);
  }

  async listPaymentIntents(params: { customer?: string; limit?: number }): Promise<unknown> {
    const p: Record<string, string> = { limit: String(params.limit ?? 20) };
    if (params.customer) p.customer = params.customer;
    return this.request("GET", "/payment_intents", p);
  }

  async getPaymentIntent(id: string): Promise<unknown> {
    return this.request("GET", `/payment_intents/${id}`);
  }

  async listProducts(params: { active?: boolean; limit?: number }): Promise<unknown> {
    const p: Record<string, string> = { limit: String(params.limit ?? 20) };
    if (params.active != null) p.active = String(params.active);
    return this.request("GET", "/products", p);
  }
}
