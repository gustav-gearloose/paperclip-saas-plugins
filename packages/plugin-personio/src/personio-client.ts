const BASE_URL = "https://api.personio.de/v1";

export class PersonioClient {
  private token: string;

  private constructor(token: string) {
    this.token = token;
  }

  static async create(clientId: string, clientSecret: string): Promise<PersonioClient> {
    const res = await fetch(`${BASE_URL}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Personio auth failed ${res.status}: ${text}`);
    }
    const data = await res.json() as { data?: { token?: string }; success?: boolean };
    const token = data?.data?.token;
    if (!token) throw new Error("Personio auth: no token in response");
    return new PersonioClient(token);
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  private async request<T>(method: string, path: string, body?: unknown, params?: Record<string, string | number | undefined>): Promise<T> {
    let url = `${BASE_URL}${path}`;
    if (params) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) qs.set(k, String(v));
      }
      const str = qs.toString();
      if (str) url += `?${str}`;
    }
    const res = await fetch(url, {
      method,
      headers: this.headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Personio ${method} ${path} → ${res.status}: ${text}`);
    }
    if (res.status === 204) return {} as T;
    return res.json() as Promise<T>;
  }

  // ── Employees ──────────────────────────────────────────────────────────────

  async listEmployees(params?: { limit?: number; offset?: number; email?: string }): Promise<unknown> {
    return this.request("GET", "/company/employees", undefined, {
      limit: params?.limit ?? 200,
      offset: params?.offset,
      email: params?.email,
    });
  }

  async getEmployee(id: number): Promise<unknown> {
    return this.request("GET", `/company/employees/${id}`);
  }

  async createEmployee(fields: Record<string, unknown>): Promise<unknown> {
    return this.request("POST", "/company/employees", { employee: fields });
  }

  async updateEmployee(id: number, fields: Record<string, unknown>): Promise<unknown> {
    return this.request("PATCH", `/company/employees/${id}`, { employee: fields });
  }

  // ── Absences (time off) ───────────────────────────────────────────────────

  async listAbsenceTypes(): Promise<unknown> {
    return this.request("GET", "/company/time-off-types");
  }

  async listAbsences(params?: { startDate?: string; endDate?: string; employeeId?: number; limit?: number; offset?: number }): Promise<unknown> {
    return this.request("GET", "/company/time-offs", undefined, {
      start_date: params?.startDate,
      end_date: params?.endDate,
      employee_id: params?.employeeId,
      limit: params?.limit ?? 200,
      offset: params?.offset,
    });
  }

  async createAbsence(params: {
    employeeId: number;
    timeOffTypeId: number;
    startDate: string;
    endDate: string;
    halfDayStart?: boolean;
    halfDayEnd?: boolean;
    comment?: string;
  }): Promise<unknown> {
    const body: Record<string, unknown> = {
      employee_id: params.employeeId,
      time_off_type_id: params.timeOffTypeId,
      start_date: params.startDate,
      end_date: params.endDate,
    };
    if (params.halfDayStart !== undefined) body.half_day_start = params.halfDayStart;
    if (params.halfDayEnd !== undefined) body.half_day_end = params.halfDayEnd;
    if (params.comment) body.comment = params.comment;
    return this.request("POST", "/company/time-offs", body);
  }

  async deleteAbsence(id: number): Promise<unknown> {
    return this.request("DELETE", `/company/time-offs/${id}`);
  }

  // ── Attendance ────────────────────────────────────────────────────────────

  async listAttendances(params?: { startDate?: string; endDate?: string; employeeId?: number; limit?: number; offset?: number }): Promise<unknown> {
    return this.request("GET", "/company/attendances", undefined, {
      start_date: params?.startDate,
      end_date: params?.endDate,
      employee_id: params?.employeeId,
      limit: params?.limit ?? 200,
      offset: params?.offset,
    });
  }

  async createAttendance(params: {
    employeeId: number;
    date: string;
    startTime: string;
    endTime: string;
    breakDuration?: number;
    comment?: string;
  }): Promise<unknown> {
    const attendances = [{
      employee: params.employeeId,
      date: params.date,
      start_time: params.startTime,
      end_time: params.endTime,
      break: params.breakDuration ?? 0,
      comment: params.comment ?? "",
    }];
    return this.request("POST", "/company/attendances", { attendances });
  }

  // ── Departments & positions ────────────────────────────────────────────────

  async listDepartments(): Promise<unknown> {
    return this.request("GET", "/company/departments");
  }
}
