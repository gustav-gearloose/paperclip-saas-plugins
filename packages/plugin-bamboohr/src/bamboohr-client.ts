export class BambooHRClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(apiKey: string, domain: string) {
    this.baseUrl = `https://${domain}.bamboohr.com/api/v1`;
    const encoded = Buffer.from(`${apiKey}:x`).toString("base64");
    this.headers = {
      Authorization: `Basic ${encoded}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`BambooHR ${method} ${path} → ${res.status}: ${text}`);
    }
    if (res.status === 204) return {} as T;
    return res.json() as Promise<T>;
  }

  // ── Employees ──────────────────────────────────────────────────────────────

  async getDirectory(): Promise<unknown> {
    return this.request("GET", "/employees/directory");
  }

  async getEmployee(params: { id: number | string; fields?: string }): Promise<unknown> {
    const defaultFields = "firstName,lastName,jobTitle,department,workEmail,mobilePhone,workPhone,status,hireDate,location,division,supervisor";
    const fields = params.fields ?? defaultFields;
    return this.request("GET", `/employees/${params.id}?fields=${encodeURIComponent(fields)}`);
  }

  async updateEmployee(id: number | string, fields: Record<string, string>): Promise<unknown> {
    return this.request("POST", `/employees/${id}`, fields);
  }

  // ── Time Off ───────────────────────────────────────────────────────────────

  async getTimeOffRequests(params: {
    start: string;
    end: string;
    employeeId?: number;
    status?: string;
  }): Promise<unknown> {
    const qs = new URLSearchParams({ start: params.start, end: params.end });
    if (params.employeeId) qs.set("employeeId", String(params.employeeId));
    if (params.status) qs.set("status", params.status);
    return this.request("GET", `/time_off/requests?${qs}`);
  }

  async getTimeOffTypes(): Promise<unknown> {
    return this.request("GET", "/time_off/types");
  }

  async getTimeOffBalance(employeeId: number | string): Promise<unknown> {
    const today = new Date().toISOString().split("T")[0];
    return this.request("GET", `/employees/${employeeId}/time_off/calculator?end=${today}`);
  }

  async addTimeOffRequest(params: {
    status: "approved" | "requested";
    start: string;
    end: string;
    timeOffTypeId: number;
    employeeId: number;
    note?: string;
  }): Promise<unknown> {
    const body: Record<string, unknown> = {
      status: params.status,
      start: params.start,
      end: params.end,
      timeOffTypeId: params.timeOffTypeId,
      employeeId: params.employeeId,
    };
    if (params.note) body.note = params.note;
    return this.request("PUT", "/time_off/request", body);
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  async runCustomReport(params: {
    fields: string[];
    filters?: { lastChanged?: { includeNull: "yes" | "no"; value: string } };
  }): Promise<unknown> {
    const body: Record<string, unknown> = {
      title: "Paperclip AI Report",
      fields: params.fields,
    };
    if (params.filters) body.filters = params.filters;
    return this.request("POST", "/reports/custom?format=json&onlyCurrent=true", body);
  }

  // ── Org Chart ─────────────────────────────────────────────────────────────

  async getEmployeeFields(): Promise<unknown> {
    return this.request("GET", "/employees/0/tables/emergencyContacts");
  }

  async listJobTitles(): Promise<unknown> {
    return this.request("GET", "/lists/jobTitle");
  }

  async listDepartments(): Promise<unknown> {
    return this.request("GET", "/lists/department");
  }

  // ── Who Is Out ─────────────────────────────────────────────────────────────

  async whoIsOut(params: { start?: string; end?: string } = {}): Promise<unknown> {
    const today = new Date().toISOString().split("T")[0];
    const qs = new URLSearchParams({
      start: params.start ?? today,
      end: params.end ?? today,
    });
    return this.request("GET", `/time_off/whos_out?${qs}`);
  }
}
