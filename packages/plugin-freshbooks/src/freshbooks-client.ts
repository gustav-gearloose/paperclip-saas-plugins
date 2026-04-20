const TOKEN_URL = "https://api.freshbooks.com/auth/oauth/token";
const BASE = "https://api.freshbooks.com";

export class FreshBooksClient {
  private accessToken = "";
  private tokenExpiry = 0;
  private accountId = "";
  private businessId = "";

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private refreshToken: string,
  ) {}

  private async ensureToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60_000) return;

    const resp = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        redirect_uri: "https://gearloose.dk/auth/freshbooks/callback",
      }),
    });

    if (!resp.ok) {
      throw new Error(`FreshBooks token refresh failed: ${resp.status} ${await resp.text()}`);
    }

    const data = await resp.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;
    if (data.refresh_token) {
      this.refreshToken = data.refresh_token;
    }
  }

  private async ensureAccountId(): Promise<void> {
    if (this.accountId) return;
    await this.ensureToken();

    const resp = await fetch(`${BASE}/auth/api/v1/users/me`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!resp.ok) {
      throw new Error(`FreshBooks /users/me failed: ${resp.status} ${await resp.text()}`);
    }

    const data = await resp.json() as {
      response: {
        result: {
          business_memberships: Array<{
            business: { account_id: string; id: number };
          }>;
        };
      };
    };

    const memberships = data?.response?.result?.business_memberships ?? [];
    if (memberships.length === 0) {
      throw new Error("FreshBooks: no business memberships found for this user");
    }
    this.accountId = memberships[0].business.account_id;
    this.businessId = String(memberships[0].business.id);
  }

  private async get<T>(path: string): Promise<T> {
    await this.ensureToken();
    const resp = await fetch(`${BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
    });
    if (!resp.ok) {
      throw new Error(`FreshBooks GET ${path} → ${resp.status}: ${await resp.text()}`);
    }
    return resp.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    await this.ensureToken();
    const resp = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      throw new Error(`FreshBooks POST ${path} → ${resp.status}: ${await resp.text()}`);
    }
    return resp.json() as Promise<T>;
  }

  async listInvoices(page = 1, perPage = 25): Promise<unknown> {
    await this.ensureAccountId();
    const qs = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    const data = await this.get<{ response: { result: unknown } }>(
      `/accounting/account/${this.accountId}/invoices/invoices?${qs}`,
    );
    return data?.response?.result;
  }

  async getInvoice(invoiceId: string): Promise<unknown> {
    await this.ensureAccountId();
    const data = await this.get<{ response: { result: unknown } }>(
      `/accounting/account/${this.accountId}/invoices/invoices/${invoiceId}`,
    );
    return data?.response?.result;
  }

  async createInvoice(params: {
    client_id: number;
    create_date?: string;
    due_date?: string;
    currency_code?: string;
    lines: Array<{ name: string; qty: number; unit_cost: number }>;
  }): Promise<unknown> {
    await this.ensureAccountId();
    const body = {
      invoice: {
        customerid: params.client_id,
        create_date: params.create_date,
        due_date: params.due_date,
        currency_code: params.currency_code,
        lines: params.lines.map((l) => ({
          name: l.name,
          qty: l.qty,
          unit_cost: { amount: String(l.unit_cost), code: params.currency_code ?? "USD" },
        })),
      },
    };
    const data = await this.post<{ response: { result: unknown } }>(
      `/accounting/account/${this.accountId}/invoices/invoices`,
      body,
    );
    return data?.response?.result;
  }

  async listClients(page = 1, perPage = 25): Promise<unknown> {
    await this.ensureAccountId();
    const qs = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    const data = await this.get<{ response: { result: unknown } }>(
      `/accounting/account/${this.accountId}/clients?${qs}`,
    );
    return data?.response?.result;
  }

  async getClient(clientId: string): Promise<unknown> {
    await this.ensureAccountId();
    const data = await this.get<{ response: { result: unknown } }>(
      `/accounting/account/${this.accountId}/clients/${clientId}`,
    );
    return data?.response?.result;
  }

  async createClient(params: {
    fname: string;
    lname: string;
    email?: string;
    organization?: string;
    currency_code?: string;
  }): Promise<unknown> {
    await this.ensureAccountId();
    const data = await this.post<{ response: { result: unknown } }>(
      `/accounting/account/${this.accountId}/clients`,
      { client: params },
    );
    return data?.response?.result;
  }

  async listExpenses(page = 1, perPage = 25): Promise<unknown> {
    await this.ensureAccountId();
    const qs = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    const data = await this.get<{ response: { result: unknown } }>(
      `/accounting/account/${this.accountId}/expenses/expenses?${qs}`,
    );
    return data?.response?.result;
  }

  async getExpense(expenseId: string): Promise<unknown> {
    await this.ensureAccountId();
    const data = await this.get<{ response: { result: unknown } }>(
      `/accounting/account/${this.accountId}/expenses/expenses/${expenseId}`,
    );
    return data?.response?.result;
  }

  async listPayments(page = 1, perPage = 25): Promise<unknown> {
    await this.ensureAccountId();
    const qs = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    const data = await this.get<{ response: { result: unknown } }>(
      `/accounting/account/${this.accountId}/payments/payments?${qs}`,
    );
    return data?.response?.result;
  }

  async listTimeEntries(page = 1, perPage = 25): Promise<unknown> {
    await this.ensureAccountId();
    const qs = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    const data = await this.get<{ response: { result: unknown } }>(
      `/timetracking/business/${this.businessId}/time_entries?${qs}`,
    );
    return data;
  }
}
