// Planday Workforce Management REST API
// OAuth2 refresh token flow — client_id only (no client_secret).
// Base URL: https://openapi.planday.com

const TOKEN_URL = "https://id.planday.com/connect/token";
const BASE = "https://openapi.planday.com";

export class PlandayClient {
  private accessToken = "";
  private tokenExpiry = 0;

  constructor(
    private readonly clientId: string,
    private refreshToken: string,
  ) {}

  private async ensureToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60_000) return;

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.clientId,
      refresh_token: this.refreshToken,
    });

    const resp = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!resp.ok) {
      throw new Error(`Planday token refresh failed: ${resp.status} ${await resp.text()}`);
    }

    const data = await resp.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;
    if (data.refresh_token) this.refreshToken = data.refresh_token;
  }

  private async req<T>(path: string, opts: RequestInit = {}): Promise<T> {
    await this.ensureToken();
    const resp = await fetch(`${BASE}${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...opts.headers,
      },
    });
    if (!resp.ok) {
      throw new Error(`Planday API error ${resp.status}: ${await resp.text()}`);
    }
    return resp.json() as Promise<T>;
  }

  // Employees
  listEmployees(limit = 50, offset = 0) {
    return this.req(`/hr/v1/employees?limit=${limit}&offset=${offset}`);
  }
  getEmployee(id: number) {
    return this.req(`/hr/v1/employees/${id}`);
  }
  listEmployeeGroups() {
    return this.req(`/hr/v1/employeegroups`);
  }

  // Scheduling — Shifts
  listShifts(from: string, to: string, departmentId?: number) {
    const q = new URLSearchParams({ from, to });
    if (departmentId) q.set("departmentId", String(departmentId));
    return this.req(`/scheduling/v1/shifts?${q}`);
  }
  getShift(id: number) {
    return this.req(`/scheduling/v1/shifts/${id}`);
  }
  createShift(body: Record<string, unknown>) {
    return this.req(`/scheduling/v1/shifts`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
  updateShift(id: number, body: Record<string, unknown>) {
    return this.req(`/scheduling/v1/shifts/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }
  deleteShift(id: number) {
    return this.req(`/scheduling/v1/shifts/${id}`, { method: "DELETE" });
  }

  // Departments
  listDepartments() {
    return this.req(`/hr/v1/departments`);
  }
  getDepartment(id: number) {
    return this.req(`/hr/v1/departments/${id}`);
  }

  // Time & Attendance — Punch Clock
  listPunchClockRecords(from: string, to: string, departmentId?: number) {
    const q = new URLSearchParams({ from, to });
    if (departmentId) q.set("departmentId", String(departmentId));
    return this.req(`/punch-clock/v1/records?${q}`);
  }

  // Leave/Absence Requests
  listLeaveRequests(from?: string, to?: string) {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return this.req(`/absence/v1/absencerequests?${q}`);
  }
}
