export class ShopifyClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(shopDomain: string, accessToken: string) {
    const normalized = shopDomain.replace(/\/$/, "").replace(/^https?:\/\//, "");
    this.baseUrl = `https://${normalized}/admin/api/2024-01`;
    this.headers = {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    };
  }

  private async request(path: string, options: RequestInit = {}): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: { ...this.headers, ...(options.headers as Record<string, string> | undefined) },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Shopify API error ${res.status}: ${text}`);
    }
    return res.json();
  }

  async listOrders(params: { status?: string; limit?: number; financial_status?: string; fulfillment_status?: string } = {}): Promise<unknown> {
    const qs = new URLSearchParams();
    qs.set("status", params.status ?? "any");
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.financial_status) qs.set("financial_status", params.financial_status);
    if (params.fulfillment_status) qs.set("fulfillment_status", params.fulfillment_status);
    return this.request(`/orders.json?${qs}`);
  }

  async getOrder(id: number): Promise<unknown> {
    return this.request(`/orders/${id}.json`);
  }

  async listProducts(params: { limit?: number; status?: string; title?: string } = {}): Promise<unknown> {
    const qs = new URLSearchParams();
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.status) qs.set("status", params.status);
    if (params.title) qs.set("title", params.title);
    return this.request(`/products.json?${qs}`);
  }

  async getProduct(id: number): Promise<unknown> {
    return this.request(`/products/${id}.json`);
  }

  async updateProduct(id: number, data: Record<string, unknown>): Promise<unknown> {
    return this.request(`/products/${id}.json`, {
      method: "PUT",
      body: JSON.stringify({ product: data }),
    });
  }

  async listCustomers(params: { limit?: number; query?: string } = {}): Promise<unknown> {
    const qs = new URLSearchParams();
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.query) qs.set("query", params.query);
    return this.request(`/customers/search.json?${qs}`);
  }

  async getCustomer(id: number): Promise<unknown> {
    return this.request(`/customers/${id}.json`);
  }

  async listInventoryLevels(locationId: number, params: { limit?: number } = {}): Promise<unknown> {
    const qs = new URLSearchParams({ location_ids: String(locationId) });
    if (params.limit) qs.set("limit", String(params.limit));
    return this.request(`/inventory_levels.json?${qs}`);
  }

  async listLocations(): Promise<unknown> {
    return this.request("/locations.json");
  }

  async getShop(): Promise<unknown> {
    return this.request("/shop.json");
  }

  async listDiscountCodes(priceRuleId: number): Promise<unknown> {
    return this.request(`/price_rules/${priceRuleId}/discount_codes.json`);
  }

  async listPriceRules(params: { limit?: number } = {}): Promise<unknown> {
    const qs = new URLSearchParams();
    if (params.limit) qs.set("limit", String(params.limit));
    return this.request(`/price_rules.json?${qs}`);
  }
}
