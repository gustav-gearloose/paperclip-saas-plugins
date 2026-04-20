export class WooCommerceClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(siteUrl: string, consumerKey: string, consumerSecret: string) {
    const normalized = siteUrl.replace(/\/$/, "");
    this.baseUrl = `${normalized}/wp-json/wc/v3`;
    const encoded = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
    this.authHeader = `Basic ${encoded}`;
  }

  private async request(path: string, options: RequestInit = {}): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string> | undefined),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`WooCommerce API error ${res.status}: ${text}`);
    }
    return res.json();
  }

  async listOrders(params: { status?: string; per_page?: number; page?: number; customer?: number } = {}): Promise<unknown> {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.per_page) qs.set("per_page", String(params.per_page));
    if (params.page) qs.set("page", String(params.page));
    if (params.customer) qs.set("customer", String(params.customer));
    return this.request(`/orders?${qs}`);
  }

  async getOrder(id: number): Promise<unknown> {
    return this.request(`/orders/${id}`);
  }

  async listProducts(params: { status?: string; per_page?: number; page?: number; search?: string; category?: string } = {}): Promise<unknown> {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.per_page) qs.set("per_page", String(params.per_page));
    if (params.page) qs.set("page", String(params.page));
    if (params.search) qs.set("search", params.search);
    if (params.category) qs.set("category", params.category);
    return this.request(`/products?${qs}`);
  }

  async getProduct(id: number): Promise<unknown> {
    return this.request(`/products/${id}`);
  }

  async updateProduct(id: number, data: Record<string, unknown>): Promise<unknown> {
    return this.request(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async listCustomers(params: { per_page?: number; page?: number; search?: string; email?: string } = {}): Promise<unknown> {
    const qs = new URLSearchParams();
    if (params.per_page) qs.set("per_page", String(params.per_page));
    if (params.page) qs.set("page", String(params.page));
    if (params.search) qs.set("search", params.search);
    if (params.email) qs.set("email", params.email);
    return this.request(`/customers?${qs}`);
  }

  async getCustomer(id: number): Promise<unknown> {
    return this.request(`/customers/${id}`);
  }

  async listCoupons(params: { per_page?: number; page?: number; search?: string } = {}): Promise<unknown> {
    const qs = new URLSearchParams();
    if (params.per_page) qs.set("per_page", String(params.per_page));
    if (params.page) qs.set("page", String(params.page));
    if (params.search) qs.set("search", params.search);
    return this.request(`/coupons?${qs}`);
  }

  async getReports(report: "sales" | "top_sellers" | "orders/totals" | "products/totals" | "customers/totals"): Promise<unknown> {
    return this.request(`/reports/${report}`);
  }

  async listRefunds(orderId: number): Promise<unknown> {
    return this.request(`/orders/${orderId}/refunds`);
  }

  async updateOrderStatus(id: number, status: string): Promise<unknown> {
    return this.request(`/orders/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
  }
}
