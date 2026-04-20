const BASE = "https://tripletex.no/v2";

export class TripletexClient {
  private authHeader: string = "";

  async init(consumerToken: string, employeeToken: string): Promise<void> {
    const credentials = Buffer.from(`${consumerToken}:${employeeToken}`).toString("base64");
    const res = await fetch(`${BASE}/token/session/:create?consumerToken=${encodeURIComponent(consumerToken)}&employeeToken=${encodeURIComponent(employeeToken)}&expirationDate=2099-12-31`, {
      method: "PUT",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) throw new Error(`Tripletex session create → ${res.status}`);
    const data = await res.json() as { value?: { token?: string } };
    const token = data?.value?.token;
    if (!token) throw new Error("Tripletex: no session token in response");
    this.authHeader = "Basic " + Buffer.from(`0:${token}`).toString("base64");
  }

  private async req<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...opts,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        ...(opts.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`Tripletex ${opts.method ?? "GET"} ${path} → ${res.status}`);
    return res.json() as Promise<T>;
  }

  listInvoices(params: { from?: number; count?: number; dateFrom?: string; dateTo?: string } = {}) {
    const q = new URLSearchParams();
    if (params.from != null) q.set("from", String(params.from));
    if (params.count != null) q.set("count", String(params.count));
    if (params.dateFrom) q.set("invoiceDateFrom", params.dateFrom);
    if (params.dateTo) q.set("invoiceDateTo", params.dateTo);
    const qs = q.toString();
    return this.req<Record<string, unknown>>(`/invoice${qs ? "?" + qs : ""}`);
  }

  getInvoice(id: number) {
    return this.req<Record<string, unknown>>(`/invoice/${id}`);
  }

  listCustomers(params: { from?: number; count?: number } = {}) {
    const q = new URLSearchParams();
    if (params.from != null) q.set("from", String(params.from));
    if (params.count != null) q.set("count", String(params.count));
    const qs = q.toString();
    return this.req<Record<string, unknown>>(`/customer${qs ? "?" + qs : ""}`);
  }

  listSuppliers(params: { from?: number; count?: number } = {}) {
    const q = new URLSearchParams();
    if (params.from != null) q.set("from", String(params.from));
    if (params.count != null) q.set("count", String(params.count));
    const qs = q.toString();
    return this.req<Record<string, unknown>>(`/supplier${qs ? "?" + qs : ""}`);
  }

  listProjects(params: { from?: number; count?: number } = {}) {
    const q = new URLSearchParams();
    if (params.from != null) q.set("from", String(params.from));
    if (params.count != null) q.set("count", String(params.count));
    const qs = q.toString();
    return this.req<Record<string, unknown>>(`/project${qs ? "?" + qs : ""}`);
  }

  getProject(id: number) {
    return this.req<Record<string, unknown>>(`/project/${id}`);
  }

  listTimesheetEntries(params: { from?: number; count?: number; dateFrom?: string; dateTo?: string; employeeId?: number; projectId?: number } = {}) {
    const q = new URLSearchParams();
    if (params.from != null) q.set("from", String(params.from));
    if (params.count != null) q.set("count", String(params.count));
    if (params.dateFrom) q.set("dateFrom", params.dateFrom);
    if (params.dateTo) q.set("dateTo", params.dateTo);
    if (params.employeeId != null) q.set("employeeId", String(params.employeeId));
    if (params.projectId != null) q.set("projectId", String(params.projectId));
    const qs = q.toString();
    return this.req<Record<string, unknown>>(`/timesheet/entry${qs ? "?" + qs : ""}`);
  }

  listEmployees(params: { from?: number; count?: number } = {}) {
    const q = new URLSearchParams();
    if (params.from != null) q.set("from", String(params.from));
    if (params.count != null) q.set("count", String(params.count));
    const qs = q.toString();
    return this.req<Record<string, unknown>>(`/employee${qs ? "?" + qs : ""}`);
  }

  listLedgerPostings(params: { from?: number; count?: number; dateFrom?: string; dateTo?: string } = {}) {
    const q = new URLSearchParams();
    if (params.from != null) q.set("from", String(params.from));
    if (params.count != null) q.set("count", String(params.count));
    if (params.dateFrom) q.set("dateFrom", params.dateFrom);
    if (params.dateTo) q.set("dateTo", params.dateTo);
    const qs = q.toString();
    return this.req<Record<string, unknown>>(`/ledger/posting${qs ? "?" + qs : ""}`);
  }

  listAccounts(params: { from?: number; count?: number } = {}) {
    const q = new URLSearchParams();
    if (params.from != null) q.set("from", String(params.from));
    if (params.count != null) q.set("count", String(params.count));
    const qs = q.toString();
    return this.req<Record<string, unknown>>(`/ledger/account${qs ? "?" + qs : ""}`);
  }
}
