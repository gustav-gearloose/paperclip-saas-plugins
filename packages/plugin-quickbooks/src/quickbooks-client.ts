const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const PROD_BASE = "https://quickbooks.api.intuit.com";
const SANDBOX_BASE = "https://sandbox-quickbooks.api.intuit.com";
const MINOR_VERSION = 75;

export class QuickBooksClient {
  private readonly base: string;
  private accessToken = "";
  private tokenExpiry = 0;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private refreshToken: string,
    private readonly realmId: string,
    sandbox = false,
  ) {
    this.base = sandbox ? SANDBOX_BASE : PROD_BASE;
  }

  private async ensureToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60_000) return;
    const creds = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const resp = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.refreshToken,
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`QuickBooks token refresh failed (${resp.status}): ${text}`);
    }
    const data = await resp.json() as { access_token: string; refresh_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;
  }

  private url(path: string, extraParams?: Record<string, string>): string {
    const params = new URLSearchParams({ minorversion: String(MINOR_VERSION), ...extraParams });
    return `${this.base}/v3/company/${this.realmId}/${path}?${params}`;
  }

  private async get<T>(path: string, extraParams?: Record<string, string>): Promise<T> {
    await this.ensureToken();
    const resp = await fetch(this.url(path, extraParams), {
      headers: {
        "Authorization": `Bearer ${this.accessToken}`,
        "Accept": "application/json",
      },
    });
    const data = await resp.json() as T & { Fault?: { Error: Array<{ Message: string; Detail: string }> } };
    if (!resp.ok || (data as { Fault?: unknown }).Fault) {
      const fault = (data as { Fault?: { Error: Array<{ Message: string }> } }).Fault;
      const msg = fault?.Error?.[0]?.Message ?? `HTTP ${resp.status}`;
      throw new Error(`QuickBooks API error: ${msg}`);
    }
    return data;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    await this.ensureToken();
    const resp = await fetch(this.url(path), {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.accessToken}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await resp.json() as T & { Fault?: { Error: Array<{ Message: string }> } };
    if (!resp.ok || (data as { Fault?: unknown }).Fault) {
      const fault = (data as { Fault?: { Error: Array<{ Message: string }> } }).Fault;
      const msg = fault?.Error?.[0]?.Message ?? `HTTP ${resp.status}`;
      throw new Error(`QuickBooks API error: ${msg}`);
    }
    return data;
  }

  private async query<T>(sql: string): Promise<T> {
    await this.ensureToken();
    const url = `${this.base}/v3/company/${this.realmId}/query?minorversion=${MINOR_VERSION}&query=${encodeURIComponent(sql)}`;
    const resp = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${this.accessToken}`,
        "Accept": "application/json",
      },
    });
    const data = await resp.json() as T & { Fault?: { Error: Array<{ Message: string }> } };
    if (!resp.ok || (data as { Fault?: unknown }).Fault) {
      const fault = (data as { Fault?: { Error: Array<{ Message: string }> } }).Fault;
      const msg = fault?.Error?.[0]?.Message ?? `HTTP ${resp.status}`;
      throw new Error(`QuickBooks API error: ${msg}`);
    }
    return data;
  }

  async listInvoices(startPosition = 1, maxResults = 100): Promise<unknown> {
    return this.query(`SELECT * FROM Invoice STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`);
  }

  async getInvoice(invoiceId: string): Promise<unknown> {
    return this.get(`invoice/${invoiceId}`);
  }

  async createInvoice(params: {
    customer_id: string;
    due_date?: string;
    lines: Array<{
      description?: string;
      amount: number;
      item_id?: string;
      quantity?: number;
      unit_price?: number;
    }>;
  }): Promise<unknown> {
    const Line = params.lines.map(l => ({
      Amount: l.amount,
      DetailType: "SalesItemLineDetail",
      Description: l.description,
      SalesItemLineDetail: {
        ...(l.item_id ? { ItemRef: { value: l.item_id } } : {}),
        Qty: l.quantity ?? 1,
        UnitPrice: l.unit_price ?? l.amount,
      },
    }));
    const body: Record<string, unknown> = {
      CustomerRef: { value: params.customer_id },
      Line,
    };
    if (params.due_date) body.DueDate = params.due_date;
    return this.post("invoice", body);
  }

  async listCustomers(startPosition = 1, maxResults = 100): Promise<unknown> {
    return this.query(`SELECT * FROM Customer STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`);
  }

  async getCustomer(customerId: string): Promise<unknown> {
    return this.get(`customer/${customerId}`);
  }

  async createCustomer(params: {
    display_name: string;
    email?: string;
    phone?: string;
    company_name?: string;
  }): Promise<unknown> {
    const body: Record<string, unknown> = { DisplayName: params.display_name };
    if (params.email) body.PrimaryEmailAddr = { Address: params.email };
    if (params.phone) body.PrimaryPhone = { FreeFormNumber: params.phone };
    if (params.company_name) body.CompanyName = params.company_name;
    return this.post("customer", body);
  }

  async listAccounts(startPosition = 1, maxResults = 100): Promise<unknown> {
    return this.query(`SELECT * FROM Account STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`);
  }

  async getProfitAndLoss(startDate: string, endDate: string, accountingMethod = "Accrual"): Promise<unknown> {
    return this.get("reports/ProfitAndLoss", {
      start_date: startDate,
      end_date: endDate,
      accounting_method: accountingMethod,
    });
  }

  async listVendors(startPosition = 1, maxResults = 100): Promise<unknown> {
    return this.query(`SELECT * FROM Vendor STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`);
  }

  async listBills(startPosition = 1, maxResults = 100): Promise<unknown> {
    return this.query(`SELECT * FROM Bill STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`);
  }
}
