const TOKEN_URL = "https://oauth.accounting.sage.com/token";

// Sage Business Cloud base URL — same across all regions for the accounting API
const BASE = "https://api.accounting.sage.com/v3.1";

export class SageClient {
  private accessToken = "";
  private tokenExpiry = 0;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private refreshToken: string,
  ) {}

  private async ensureToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60_000) return;

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.refreshToken,
    });

    const resp = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!resp.ok) {
      throw new Error(`Sage token refresh failed: ${resp.status} ${await resp.text()}`);
    }

    const data = await resp.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;
    if (data.refresh_token) {
      this.refreshToken = data.refresh_token;
    }
  }

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    await this.ensureToken();
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    const resp = await fetch(`${BASE}${path}${qs}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
    });
    if (!resp.ok) {
      throw new Error(`Sage GET ${path} → ${resp.status}: ${await resp.text()}`);
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
      throw new Error(`Sage POST ${path} → ${resp.status}: ${await resp.text()}`);
    }
    return resp.json() as Promise<T>;
  }

  // ── Invoices ────────────────────────────────────────────────────────────────

  async listSalesInvoices(page = 1, perPage = 25): Promise<unknown> {
    return this.get("/sales_invoices", {
      page: String(page),
      items_per_page: String(perPage),
    });
  }

  async getSalesInvoice(id: string): Promise<unknown> {
    return this.get(`/sales_invoices/${id}`);
  }

  async createSalesInvoice(params: {
    contact_id: string;
    date?: string;
    due_date?: string;
    reference?: string;
    invoice_lines: Array<{ description: string; quantity: number; unit_price: number; ledger_account_id?: string }>;
  }): Promise<unknown> {
    const body = {
      sales_invoice: {
        contact_id: params.contact_id,
        date: params.date,
        due_date: params.due_date,
        reference: params.reference,
        invoice_lines: params.invoice_lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          ...(l.ledger_account_id ? { ledger_account_id: l.ledger_account_id } : {}),
        })),
      },
    };
    return this.post("/sales_invoices", body);
  }

  // ── Contacts (customers/suppliers) ─────────────────────────────────────────

  async listContacts(page = 1, perPage = 25): Promise<unknown> {
    return this.get("/contacts", {
      page: String(page),
      items_per_page: String(perPage),
    });
  }

  async getContact(id: string): Promise<unknown> {
    return this.get(`/contacts/${id}`);
  }

  async createContact(params: {
    name: string;
    contact_type_ids?: string[];
    email?: string;
    phone?: string;
  }): Promise<unknown> {
    return this.post("/contacts", {
      contact: {
        name: params.name,
        contact_type_ids: params.contact_type_ids ?? ["CUSTOMER"],
        email: params.email,
        phone: params.phone,
      },
    });
  }

  // ── Purchase Invoices ───────────────────────────────────────────────────────

  async listPurchaseInvoices(page = 1, perPage = 25): Promise<unknown> {
    return this.get("/purchase_invoices", {
      page: String(page),
      items_per_page: String(perPage),
    });
  }

  async getPurchaseInvoice(id: string): Promise<unknown> {
    return this.get(`/purchase_invoices/${id}`);
  }

  // ── Ledger Accounts ─────────────────────────────────────────────────────────

  async listLedgerAccounts(page = 1, perPage = 25): Promise<unknown> {
    return this.get("/ledger_accounts", {
      page: String(page),
      items_per_page: String(perPage),
    });
  }

  // ── Payments ────────────────────────────────────────────────────────────────

  async listPayments(page = 1, perPage = 25): Promise<unknown> {
    return this.get("/payments", {
      page: String(page),
      items_per_page: String(perPage),
    });
  }

  // ── Bank Accounts ───────────────────────────────────────────────────────────

  async listBankAccounts(): Promise<unknown> {
    return this.get("/bank_accounts");
  }

  // ── Trial Balance ───────────────────────────────────────────────────────────

  async getTrialBalance(): Promise<unknown> {
    return this.get("/trial_balance");
  }
}
