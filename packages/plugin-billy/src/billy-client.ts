/**
 * Minimal Billy.dk API v2 client.
 * Auth: X-Access-Token header (permanent API key from mit.billy.dk → Settings → Access tokens).
 * Base: https://api.billysbilling.com/v2
 */

const BASE = "https://api.billysbilling.com/v2";

export class BillyClient {
  private headers: Record<string, string>;

  constructor(accessToken: string) {
    this.headers = {
      "X-Access-Token": accessToken,
      "Content-Type": "application/json",
      "Accept-Language": "da_DK",
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
    if (!resp.ok) throw new Error(`Billy API ${resp.status} GET ${path}: ${await resp.text()}`);
    return resp.json();
  }

  async listInvoices(opts?: {
    pageSize?: number;
    page?: number;
    contactId?: string;
    state?: string;
  }): Promise<unknown> {
    const params: Record<string, string | number> = {
      pageSize: opts?.pageSize ?? 50,
      page: opts?.page ?? 1,
      include: "invoice.contact:sideload",
    };
    if (opts?.contactId) params["contactId"] = opts.contactId;
    if (opts?.state) params["state"] = opts.state;
    return this.get("/invoices", params);
  }

  async getInvoice(invoiceId: string): Promise<unknown> {
    return this.get(`/invoices/${invoiceId}`, {
      include: "invoice.lines:embed,invoice.contact:sideload",
    });
  }

  async listContacts(opts?: {
    pageSize?: number;
    page?: number;
    type?: string;
    name?: string;
  }): Promise<unknown> {
    const params: Record<string, string | number> = {
      pageSize: opts?.pageSize ?? 100,
      page: opts?.page ?? 1,
    };
    if (opts?.type) params["type"] = opts.type;
    if (opts?.name) params["name"] = opts.name;
    return this.get("/contacts", params);
  }

  async getContact(contactId: string): Promise<unknown> {
    return this.get(`/contacts/${contactId}`);
  }

  async listAccounts(opts?: { pageSize?: number }): Promise<unknown> {
    return this.get("/accounts", {
      pageSize: opts?.pageSize ?? 200,
      page: 1,
    });
  }

  async listProducts(opts?: { pageSize?: number; name?: string }): Promise<unknown> {
    const params: Record<string, string | number> = {
      pageSize: opts?.pageSize ?? 100,
      page: 1,
    };
    if (opts?.name) params["name"] = opts.name;
    return this.get("/products", params);
  }

  async getOrganization(): Promise<unknown> {
    return this.get("/organization");
  }

  async listSalesTaxReturns(opts?: { pageSize?: number }): Promise<unknown> {
    return this.get("/salesTaxReturns", {
      pageSize: opts?.pageSize ?? 20,
      page: 1,
    });
  }
}
