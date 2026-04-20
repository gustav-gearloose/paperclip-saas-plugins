const BASE_URL = "https://api.track.toggl.com/api/v9";
const REPORTS_URL = "https://api.track.toggl.com/reports/api/v3";

export class TogglClient {
  private headers: Record<string, string>;

  constructor(apiToken: string) {
    const encoded = Buffer.from(`${apiToken}:api_token`).toString("base64");
    this.headers = {
      Authorization: `Basic ${encoded}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  private async request<T>(method: string, url: string, body?: unknown): Promise<T> {
    const res = await fetch(url, {
      method,
      headers: this.headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Toggl ${method} ${url} → ${res.status}: ${text}`);
    }
    if (res.status === 204) return {} as T;
    return res.json() as Promise<T>;
  }

  // ── Me / Workspaces ────────────────────────────────────────────────────────

  async getMe(): Promise<unknown> {
    return this.request("GET", `${BASE_URL}/me`);
  }

  async getWorkspaces(): Promise<unknown> {
    return this.request("GET", `${BASE_URL}/workspaces`);
  }

  // ── Time Entries ───────────────────────────────────────────────────────────

  async getTimeEntries(params?: { startDate?: string; endDate?: string }): Promise<unknown> {
    const qs = new URLSearchParams();
    if (params?.startDate) qs.set("start_date", params.startDate);
    if (params?.endDate) qs.set("end_date", params.endDate);
    const q = qs.toString();
    return this.request("GET", `${BASE_URL}/me/time_entries${q ? `?${q}` : ""}`);
  }

  async getCurrentTimeEntry(): Promise<unknown> {
    return this.request("GET", `${BASE_URL}/me/time_entries/current`);
  }

  async startTimeEntry(params: {
    workspaceId: number;
    description?: string;
    projectId?: number;
    tags?: string[];
    billable?: boolean;
  }): Promise<unknown> {
    const body: Record<string, unknown> = {
      created_with: "Paperclip AI",
      start: new Date().toISOString(),
      duration: -1,
      workspace_id: params.workspaceId,
    };
    if (params.description) body.description = params.description;
    if (params.projectId) body.project_id = params.projectId;
    if (params.tags) body.tags = params.tags;
    if (params.billable !== undefined) body.billable = params.billable;
    return this.request("POST", `${BASE_URL}/workspaces/${params.workspaceId}/time_entries`, body);
  }

  async stopTimeEntry(workspaceId: number, timeEntryId: number): Promise<unknown> {
    return this.request("PATCH", `${BASE_URL}/workspaces/${workspaceId}/time_entries/${timeEntryId}/stop`, {});
  }

  async createTimeEntry(params: {
    workspaceId: number;
    description?: string;
    projectId?: number;
    start: string;
    durationSeconds: number;
    tags?: string[];
    billable?: boolean;
  }): Promise<unknown> {
    const body: Record<string, unknown> = {
      created_with: "Paperclip AI",
      start: params.start,
      duration: params.durationSeconds,
      workspace_id: params.workspaceId,
    };
    if (params.description) body.description = params.description;
    if (params.projectId) body.project_id = params.projectId;
    if (params.tags) body.tags = params.tags;
    if (params.billable !== undefined) body.billable = params.billable;
    return this.request("POST", `${BASE_URL}/workspaces/${params.workspaceId}/time_entries`, body);
  }

  // ── Projects ───────────────────────────────────────────────────────────────

  async getProjects(workspaceId: number, params?: { active?: boolean }): Promise<unknown> {
    const qs = new URLSearchParams();
    if (params?.active !== undefined) qs.set("active", String(params.active));
    const q = qs.toString();
    return this.request("GET", `${BASE_URL}/workspaces/${workspaceId}/projects${q ? `?${q}` : ""}`);
  }

  async createProject(workspaceId: number, params: { name: string; clientId?: number; color?: string; billable?: boolean; active?: boolean }): Promise<unknown> {
    const body: Record<string, unknown> = { name: params.name, workspace_id: workspaceId };
    if (params.clientId) body.client_id = params.clientId;
    if (params.color) body.color = params.color;
    if (params.billable !== undefined) body.billable = params.billable;
    if (params.active !== undefined) body.active = params.active;
    return this.request("POST", `${BASE_URL}/workspaces/${workspaceId}/projects`, body);
  }

  // ── Clients ────────────────────────────────────────────────────────────────

  async getClients(workspaceId: number): Promise<unknown> {
    return this.request("GET", `${BASE_URL}/workspaces/${workspaceId}/clients`);
  }

  // ── Summary report ─────────────────────────────────────────────────────────

  async getSummaryReport(workspaceId: number, params: { startDate: string; endDate: string; groupBy?: string }): Promise<unknown> {
    const body: Record<string, unknown> = {
      start_date: params.startDate,
      end_date: params.endDate,
      grouping: params.groupBy ?? "projects",
    };
    return this.request("POST", `${REPORTS_URL}/workspace/${workspaceId}/summary/time_entries`, body);
  }
}
