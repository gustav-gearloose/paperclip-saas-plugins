const BASE = "https://api.hibob.com/v1";

export class HiBobClient {
  private readonly authHeader: string;

  constructor(serviceUserId: string, token: string) {
    this.authHeader = "Basic " + Buffer.from(`${serviceUserId}:${token}`).toString("base64");
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
    if (!res.ok) throw new Error(`HiBob ${opts.method ?? "GET"} ${path} → ${res.status}`);
    return res.json() as Promise<T>;
  }

  listEmployees(params: { offset?: number; limit?: number } = {}) {
    const q = new URLSearchParams();
    if (params.offset != null) q.set("offset", String(params.offset));
    if (params.limit != null) q.set("limit", String(params.limit));
    const qs = q.toString();
    return this.req<Record<string, unknown>>(`/people${qs ? "?" + qs : ""}`);
  }

  getEmployee(employeeId: string) {
    return this.req<Record<string, unknown>>(`/people/${employeeId}`);
  }

  createEmployee(data: Record<string, unknown>) {
    return this.req<Record<string, unknown>>("/people", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  getDirectory() {
    return this.req<Record<string, unknown>>("/people/search", {
      method: "POST",
      body: JSON.stringify({ fields: ["firstName", "surname", "email", "department", "site", "title"] }),
    });
  }

  listDepartments() {
    return this.req<Record<string, unknown>>("/company/named-lists/department");
  }

  listTimeOffRequests(params: { employeeId?: string; from?: string; to?: string } = {}) {
    const q = new URLSearchParams();
    if (params.from) q.set("from", params.from);
    if (params.to) q.set("to", params.to);
    const qs = q.toString();
    const base = params.employeeId
      ? `/timeoff/employees/${params.employeeId}/requests`
      : "/timeoff/requests/changes";
    return this.req<Record<string, unknown>>(`${base}${qs ? "?" + qs : ""}`);
  }

  submitTimeOffRequest(employeeId: string, data: Record<string, unknown>) {
    return this.req<Record<string, unknown>>(`/timeoff/employees/${employeeId}/requests`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  getWhosOut(params: { from?: string; to?: string } = {}) {
    const q = new URLSearchParams();
    if (params.from) q.set("from", params.from);
    if (params.to) q.set("to", params.to);
    const qs = q.toString();
    return this.req<Record<string, unknown>>(`/timeoff/whosout${qs ? "?" + qs : ""}`);
  }

  listOpenTasks() {
    return this.req<Record<string, unknown>>("/tasks/people/tasks");
  }

  getEmployeeDocuments(employeeId: string) {
    return this.req<Record<string, unknown>>(`/docs/people/${employeeId}/shared`);
  }

  searchEmployees(fields: string[], filters: Record<string, unknown>[] = []) {
    return this.req<Record<string, unknown>>("/people/search", {
      method: "POST",
      body: JSON.stringify({ fields, filters }),
    });
  }
}
