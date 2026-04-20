const BASE_URL = "https://api.fortnox.se/3";
const TOKEN_URL = "https://accounts.fortnox.se/oauth-v1/token";

export interface FortnoxClientConfig {
  accessToken: string;
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  onTokensRefreshed?: (tokens: { accessToken: string; refreshToken: string }) => Promise<void>;
}

export class FortnoxClient {
  private accessToken: string;
  private refreshToken: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly onTokensRefreshed?: (tokens: { accessToken: string; refreshToken: string }) => Promise<void>;

  constructor(config: FortnoxClientConfig) {
    this.accessToken = config.accessToken;
    this.refreshToken = config.refreshToken;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.onTokensRefreshed = config.onTokensRefreshed;
  }

  private async refreshAccessToken(): Promise<void> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.refreshToken,
    });
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    if (!res.ok) {
      throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
    }
    const data = await res.json() as { access_token: string; refresh_token?: string };
    this.accessToken = data.access_token;
    if (data.refresh_token) {
      this.refreshToken = data.refresh_token;
    }
    if (this.onTokensRefreshed) {
      await this.onTokensRefreshed({ accessToken: this.accessToken, refreshToken: this.refreshToken });
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const doReq = async (token: string) =>
      fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
          ...(options.headers as Record<string, string> ?? {}),
        },
      });

    let res = await doReq(this.accessToken);
    if (res.status === 401) {
      await this.refreshAccessToken();
      res = await doReq(this.accessToken);
    }
    if (!res.ok) {
      throw new Error(`Fortnox API ${options.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  // ── Invoices ──────────────────────────────────────────────────────────────

  async listInvoices(params: {
    customer_number?: string;
    filter?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
  }) {
    const qs = new URLSearchParams();
    if (params.customer_number) qs.set("customernumber", params.customer_number);
    if (params.filter) qs.set("filter", params.filter);
    if (params.from_date) qs.set("fromdate", params.from_date);
    if (params.to_date) qs.set("todate", params.to_date);
    qs.set("limit", String(params.limit ?? 100));
    const data = await this.request<{ Invoices: unknown[] }>(`/invoices?${qs}`);
    return data.Invoices ?? [];
  }

  async getInvoice(documentNumber: string) {
    const data = await this.request<{ Invoice: unknown }>(`/invoices/${documentNumber}`);
    return data.Invoice;
  }

  async createInvoice(payload: {
    customer_number: string;
    invoice_date?: string;
    due_date?: string;
    invoice_rows: Array<{
      article_number?: string;
      description?: string;
      quantity?: number;
      price?: number;
      vat?: number;
    }>;
    your_order_number?: string;
    remarks?: string;
  }) {
    const body = {
      Invoice: {
        CustomerNumber: payload.customer_number,
        ...(payload.invoice_date ? { InvoiceDate: payload.invoice_date } : {}),
        ...(payload.due_date ? { DueDate: payload.due_date } : {}),
        ...(payload.your_order_number ? { YourOrderNumber: payload.your_order_number } : {}),
        ...(payload.remarks ? { Remarks: payload.remarks } : {}),
        InvoiceRows: payload.invoice_rows.map(r => ({
          ...(r.article_number ? { ArticleNumber: r.article_number } : {}),
          ...(r.description ? { Description: r.description } : {}),
          ...(r.quantity != null ? { DeliveredQuantity: r.quantity } : {}),
          ...(r.price != null ? { Price: r.price } : {}),
          ...(r.vat != null ? { VAT: r.vat } : {}),
        })),
      },
    };
    const data = await this.request<{ Invoice: unknown }>("/invoices", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return data.Invoice;
  }

  // ── Customers ─────────────────────────────────────────────────────────────

  async listCustomers(params: { search?: string; limit?: number }) {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    qs.set("limit", String(params.limit ?? 100));
    const data = await this.request<{ Customers: unknown[] }>(`/customers?${qs}`);
    return data.Customers ?? [];
  }

  async getCustomer(customerNumber: string) {
    const data = await this.request<{ Customer: unknown }>(`/customers/${customerNumber}`);
    return data.Customer;
  }

  async createCustomer(payload: {
    name: string;
    email?: string;
    phone?: string;
    address1?: string;
    city?: string;
    zip_code?: string;
    country_code?: string;
    organisation_number?: string;
    vat_number?: string;
    currency?: string;
  }) {
    const body = {
      Customer: {
        Name: payload.name,
        ...(payload.email ? { Email: payload.email } : {}),
        ...(payload.phone ? { Phone1: payload.phone } : {}),
        ...(payload.address1 ? { Address1: payload.address1 } : {}),
        ...(payload.city ? { City: payload.city } : {}),
        ...(payload.zip_code ? { ZipCode: payload.zip_code } : {}),
        ...(payload.country_code ? { CountryCode: payload.country_code } : {}),
        ...(payload.organisation_number ? { OrganisationNumber: payload.organisation_number } : {}),
        ...(payload.vat_number ? { VATNumber: payload.vat_number } : {}),
        ...(payload.currency ? { Currency: payload.currency } : {}),
      },
    };
    const data = await this.request<{ Customer: unknown }>("/customers", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return data.Customer;
  }

  // ── Articles ──────────────────────────────────────────────────────────────

  async listArticles(params: { search?: string; limit?: number }) {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    qs.set("limit", String(params.limit ?? 100));
    const data = await this.request<{ Articles: unknown[] }>(`/articles?${qs}`);
    return data.Articles ?? [];
  }

  // ── Vouchers ──────────────────────────────────────────────────────────────

  async listVouchers(params: {
    from_date?: string;
    to_date?: string;
    voucher_series?: string;
    limit?: number;
  }) {
    const qs = new URLSearchParams();
    if (params.from_date) qs.set("fromdate", params.from_date);
    if (params.to_date) qs.set("todate", params.to_date);
    if (params.voucher_series) qs.set("voucherseries", params.voucher_series);
    qs.set("limit", String(params.limit ?? 100));
    const data = await this.request<{ Vouchers: unknown[] }>(`/vouchers?${qs}`);
    return data.Vouchers ?? [];
  }

  // ── Accounts ──────────────────────────────────────────────────────────────

  async getAccount(accountNumber: number, financialYear?: number) {
    const qs = financialYear ? `?financialyear=${financialYear}` : "";
    const data = await this.request<{ Account: unknown }>(`/accounts/${accountNumber}${qs}`);
    return data.Account;
  }

  // ── Suppliers ─────────────────────────────────────────────────────────────

  async listSuppliers(params: { search?: string; limit?: number }) {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    qs.set("limit", String(params.limit ?? 100));
    const data = await this.request<{ Suppliers: unknown[] }>(`/suppliers?${qs}`);
    return data.Suppliers ?? [];
  }
}
