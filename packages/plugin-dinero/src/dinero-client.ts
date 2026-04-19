const DINERO_API_BASE = "https://api.dinero.dk/v1";

export interface DineroConfig {
  clientId: string;
  clientSecret: string;
  apiKey: string;
  orgId: string;
}

export class DineroClient {
  private config: DineroConfig;
  private accessToken = "";
  private tokenExpiresAt = 0;

  constructor(config: DineroConfig) {
    this.config = config;
  }

  private async ensureToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) return;
    const { clientId, clientSecret, apiKey } = this.config;
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch("https://authz.dinero.dk/dineroapi/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({ grant_type: "password", scope: "read write", username: apiKey, password: apiKey }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Dinero token refresh failed ${res.status}: ${body}`);
    }
    const json = await res.json() as Record<string, unknown>;
    this.accessToken = json["access_token"] as string;
    const expiresIn = (json["expires_in"] as number) ?? 3600;
    this.tokenExpiresAt = Date.now() + expiresIn * 1000;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    await this.ensureToken();
    const url = `${DINERO_API_BASE}/${this.config.orgId}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(options.headers ?? {})
      }
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Dinero API error ${res.status} for ${path}: ${body}`);
    }

    return res.json() as Promise<T>;
  }

  // ── Invoices ──────────────────────────────────────────────────────────────

  async listInvoices(params: {
    status?: string;
    fiscalYear?: number;
    pageSize?: number;
  } = {}): Promise<unknown> {
    const qs = new URLSearchParams();
    if (params.status && params.status !== "all") qs.set("statusFilter", params.status);
    if (params.fiscalYear) {
      qs.set("dateFrom", `${params.fiscalYear}-01-01`);
      qs.set("dateTo", `${params.fiscalYear}-12-31`);
    }
    qs.set("fields", "Guid,Number,ContactName,TotalExclVat,TotalInclVat,Status,Date,PaymentDate,Currency");
    qs.set("pageSize", String(params.pageSize ?? 100));
    return this.request(`/sales/invoices?${qs}`);
  }

  async getInvoice(guid: string): Promise<unknown> {
    return this.request(`/sales/invoices/${guid}`);
  }

  // ── Contacts ──────────────────────────────────────────────────────────────

  async listContacts(params: {
    type?: string;
    query?: string;
    pageSize?: number;
  } = {}): Promise<unknown> {
    const qs = new URLSearchParams();
    if (params.type && params.type !== "all") qs.set("typeFilter", params.type);
    if (params.query) qs.set("queryFilter", params.query);
    qs.set("fields", "ExternalReference,Name,Email,Phone,Address,City,ZipCode,CountryKey,VatNumber,IsPerson,IsCustomer,IsSupplier");
    qs.set("pageSize", String(params.pageSize ?? 200));
    return this.request(`/contacts?${qs}`);
  }

  // ── Accounts / Balance ────────────────────────────────────────────────────

  async listAccounts(fiscalYear?: number): Promise<unknown> {
    const qs = new URLSearchParams();
    if (fiscalYear) {
      qs.set("fiscalYearStart", `${fiscalYear}-01-01`);
    }
    return this.request(`/accounts?${qs}`);
  }

  async getKeyFigures(fiscalYear?: number): Promise<unknown> {
    const qs = new URLSearchParams();
    if (fiscalYear) {
      qs.set("fiscalYearStart", `${fiscalYear}-01-01`);
    }
    return this.request(`/keyfigures?${qs}`);
  }

  // ── Journal Entries ───────────────────────────────────────────────────────

  async listJournalEntries(params: {
    dateFrom?: string;
    dateTo?: string;
    accountNumber?: string;
    pageSize?: number;
  } = {}): Promise<unknown> {
    const qs = new URLSearchParams();
    if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
    if (params.dateTo) qs.set("dateTo", params.dateTo);
    if (params.accountNumber) qs.set("accountNumber", params.accountNumber);
    qs.set("pageSize", String(Math.min(params.pageSize ?? 100, 1000)));
    return this.request(`/vouchers?${qs}`);
  }

  // ── VAT ───────────────────────────────────────────────────────────────────

  async getVatReport(params: {
    year?: number;
    quarter?: number;
  } = {}): Promise<unknown> {
    const year = params.year ?? new Date().getFullYear();
    const qs = new URLSearchParams();
    if (params.quarter) {
      const qStart = (params.quarter - 1) * 3 + 1;
      const qEnd = qStart + 2;
      qs.set("dateFrom", `${year}-${String(qStart).padStart(2, "0")}-01`);
      qs.set("dateTo", `${year}-${String(qEnd).padStart(2, "0")}-31`);
    } else {
      qs.set("dateFrom", `${year}-01-01`);
      qs.set("dateTo", `${year}-12-31`);
    }
    return this.request(`/vatreport?${qs}`);
  }

  // ── Products ──────────────────────────────────────────────────────────────

  async listProducts(params: { query?: string } = {}): Promise<unknown> {
    const qs = new URLSearchParams();
    if (params.query) qs.set("queryFilter", params.query);
    qs.set("fields", "Guid,Name,Description,BaseAmountExclVat,VatScale,Unit,ProductNumber");
    qs.set("pageSize", "200");
    return this.request(`/products?${qs}`);
  }

  // ── Create Invoice ────────────────────────────────────────────────────────

  async createInvoice(invoice: {
    contactGuid: string;
    date: string;
    currency?: string;
    paymentConditionNumberOfDays?: number;
    lines: Array<{
      productGuid?: string;
      description: string;
      quantity: number;
      unit?: string;
      accountNumber?: number;
      baseAmountExclVat: number;
    }>;
  }): Promise<unknown> {
    const body = {
      ContactGuid: invoice.contactGuid,
      Date: invoice.date,
      Currency: invoice.currency ?? "DKK",
      ...(invoice.paymentConditionNumberOfDays !== undefined
        ? { PaymentConditions: "Netto", PaymentConditionNumberOfDays: invoice.paymentConditionNumberOfDays }
        : {}),
      ProductLines: invoice.lines.map((l) => ({
        ...(l.productGuid ? { ProductGuid: l.productGuid } : {}),
        Description: l.description,
        Quantity: l.quantity,
        Unit: l.unit ?? "parts",
        ...(l.accountNumber ? { AccountNumber: l.accountNumber } : {}),
        BaseAmountExclVat: l.baseAmountExclVat,
      })),
    };
    return this.request("/sales/invoices", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async createContact(contact: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    zipCode?: string;
    countryKey?: string;
    vatNumber?: string;
    isPerson?: boolean;
    isCustomer?: boolean;
    isSupplier?: boolean;
  }): Promise<unknown> {
    const body: Record<string, unknown> = {
      Name: contact.name,
      IsPerson: contact.isPerson ?? false,
      IsCustomer: contact.isCustomer ?? true,
      IsSupplier: contact.isSupplier ?? false,
    };
    if (contact.email) body["Email"] = contact.email;
    if (contact.phone) body["Phone"] = contact.phone;
    if (contact.address) body["Address"] = contact.address;
    if (contact.city) body["City"] = contact.city;
    if (contact.zipCode) body["ZipCode"] = contact.zipCode;
    if (contact.countryKey) body["CountryKey"] = contact.countryKey;
    if (contact.vatNumber) body["VatNumber"] = contact.vatNumber;
    return this.request("/contacts", { method: "POST", body: JSON.stringify(body) });
  }

  // ── Financial Summary (composite) ─────────────────────────────────────────

  async getFinancialSummary(fiscalYear?: number): Promise<unknown> {
    const year = fiscalYear ?? new Date().getFullYear();

    const [keyFigures, invoices] = await Promise.allSettled([
      this.getKeyFigures(year),
      this.listInvoices({ fiscalYear: year, status: "sent", pageSize: 1000 })
    ]);

    return {
      fiscalYear: year,
      keyFigures: keyFigures.status === "fulfilled" ? keyFigures.value : null,
      outstandingInvoices: invoices.status === "fulfilled" ? invoices.value : null
    };
  }
}
