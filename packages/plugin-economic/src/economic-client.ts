/**
 * Minimal e-conomic REST API client.
 * Auth: X-AppSecretToken (developer) + X-AgreementGrantToken (customer).
 * Base: https://restapi.e-conomic.com
 */

const BASE = "https://restapi.e-conomic.com";

export class EconomicClient {
  private headers: Record<string, string>;

  constructor(appSecretToken: string, agreementGrantToken: string) {
    this.headers = {
      "X-AppSecretToken": appSecretToken,
      "X-AgreementGrantToken": agreementGrantToken,
      "Content-Type": "application/json",
    };
  }

  private async get(path: string, params?: Record<string, string | number>): Promise<unknown> {
    const url = new URL(`${BASE}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, String(v));
      }
    }
    const resp = await fetch(url.toString(), { headers: this.headers });
    if (!resp.ok) {
      throw new Error(`e-conomic API ${resp.status} ${path}: ${await resp.text()}`);
    }
    return resp.json();
  }

  async getSelf(): Promise<unknown> {
    return this.get("/self");
  }

  async listCustomers(opts?: { pageSize?: number; skipPages?: number; query?: string }): Promise<unknown> {
    const params: Record<string, string | number> = {
      pagesize: opts?.pageSize ?? 100,
      skippages: opts?.skipPages ?? 0,
    };
    if (opts?.query) params["filter"] = `name$like:${opts.query}`;
    return this.get("/customers/paged", params);
  }

  async getCustomer(customerNumber: number): Promise<unknown> {
    return this.get(`/customers/${customerNumber}`);
  }

  async listDraftInvoices(opts?: { pageSize?: number; skipPages?: number }): Promise<unknown> {
    return this.get("/invoices/drafts/paged", {
      pagesize: opts?.pageSize ?? 100,
      skippages: opts?.skipPages ?? 0,
    });
  }

  async listBookedInvoices(opts?: { pageSize?: number; skipPages?: number; dateFrom?: string; dateTo?: string }): Promise<unknown> {
    const params: Record<string, string | number> = {
      pagesize: opts?.pageSize ?? 100,
      skippages: opts?.skipPages ?? 0,
    };
    if (opts?.dateFrom) params["filter"] = `date$gte:${opts.dateFrom}`;
    if (opts?.dateTo) {
      const existing = params["filter"] as string | undefined;
      params["filter"] = existing ? `${existing}$and:date$lte:${opts.dateTo}` : `date$lte:${opts.dateTo}`;
    }
    return this.get("/invoices/booked/paged", params);
  }

  async getDraftInvoice(draftInvoiceNumber: number): Promise<unknown> {
    return this.get(`/invoices/drafts/${draftInvoiceNumber}`);
  }

  async getBookedInvoice(bookedInvoiceNumber: number): Promise<unknown> {
    return this.get(`/invoices/booked/${bookedInvoiceNumber}`);
  }

  async listAccounts(opts?: { pageSize?: number }): Promise<unknown> {
    return this.get("/accounts/paged", {
      pagesize: opts?.pageSize ?? 200,
      skippages: 0,
    });
  }

  async getAccount(accountNumber: number): Promise<unknown> {
    return this.get(`/accounts/${accountNumber}`);
  }

  async listProducts(opts?: { pageSize?: number; query?: string }): Promise<unknown> {
    const params: Record<string, string | number> = {
      pagesize: opts?.pageSize ?? 100,
      skippages: 0,
    };
    if (opts?.query) params["filter"] = `name$like:${opts.query}`;
    return this.get("/products/paged", params);
  }

  async getCompanyInfo(): Promise<unknown> {
    return this.get("/self");
  }
}
