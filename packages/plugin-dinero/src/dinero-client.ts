const DINERO_API_BASE_V1 = "https://api.dinero.dk/v1";
const DINERO_API_BASE_V2 = "https://api.dinero.dk/v2";

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

  private async request<T>(path: string, options: RequestInit = {}, apiVersion: "v1" | "v2" = "v1"): Promise<T> {
    await this.ensureToken();
    const base = apiVersion === "v2" ? DINERO_API_BASE_V2 : DINERO_API_BASE_V1;
    const url = `${base}/${this.config.orgId}${path}`;
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
    if (params.status && params.status !== "all") {
      // Dinero API enum: Draft, Booked, Paid, OverPaid, Overdue.
      // "sent" is our friendly alias for Booked (issued, not yet paid).
      const map: Record<string, string> = {
        draft: "Draft",
        sent: "Booked",
        booked: "Booked",
        paid: "Paid",
        overpaid: "OverPaid",
        overdue: "Overdue",
      };
      const mapped = map[params.status.toLowerCase()] ?? params.status;
      qs.set("statusFilter", mapped);
    }
    if (params.fiscalYear) {
      qs.set("startDate", `${params.fiscalYear}-01-01`);
      qs.set("endDate", `${params.fiscalYear}-12-31`);
    }
    qs.set("fields", "Guid,Number,ContactName,TotalExclVat,TotalInclVat,Status,Date,PaymentDate,Currency");
    qs.set("pageSize", String(params.pageSize ?? 100));
    return this.request(`/invoices?${qs}`);
  }

  async getInvoice(guid: string): Promise<unknown> {
    return this.request(`/invoices/${guid}`);
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
    return this.request(`/contacts?${qs}`, {}, "v2");
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
    // Dinero has no /keyfigures endpoint. The closest equivalent is the saldobalance
    // report, which includes both result (P&L) and balance for a whole accounting year.
    const year = fiscalYear ?? new Date().getFullYear();
    return this.request(`/${year}/reports/saldo`);
  }

  // ── Ledger Entries ────────────────────────────────────────────────────────
  // Uses /entries (date range) or /entries/changes (changesSince pattern)

  async listEntries(params: {
    fromDate?: string;
    toDate?: string;
    includePrimo?: boolean;
  } = {}): Promise<unknown> {
    const qs = new URLSearchParams();
    if (params.fromDate) qs.set("fromDate", params.fromDate);
    if (params.toDate) qs.set("toDate", params.toDate);
    if (params.includePrimo != null) qs.set("includePrimo", String(params.includePrimo));
    return this.request(`/entries?${qs}`);
  }

  async listEntryChanges(params: {
    changesFrom: string;
    changesTo?: string;
    includePrimo?: boolean;
  }): Promise<unknown> {
    const qs = new URLSearchParams();
    qs.set("changesFrom", params.changesFrom);
    if (params.changesTo) qs.set("changesTo", params.changesTo);
    if (params.includePrimo != null) qs.set("includePrimo", String(params.includePrimo));
    return this.request(`/entries/changes?${qs}`);
  }

  // ── VAT ───────────────────────────────────────────────────────────────────
  // /vatreport is not in the official OpenAPI spec; best-effort kept as-is.

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
    return this.request("/invoices", {
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

    const errors = [
      keyFigures.status === "rejected" ? { op: "keyFigures", message: keyFigures.reason instanceof Error ? keyFigures.reason.message : String(keyFigures.reason) } : null,
      invoices.status === "rejected" ? { op: "outstandingInvoices", message: invoices.reason instanceof Error ? invoices.reason.message : String(invoices.reason) } : null,
    ].filter((e): e is { op: string; message: string } => e !== null);

    return {
      fiscalYear: year,
      keyFigures: keyFigures.status === "fulfilled" ? keyFigures.value : null,
      outstandingInvoices: invoices.status === "fulfilled" ? invoices.value : null,
      ...(errors.length > 0 ? { errors } : {}),
    };
  }
}
