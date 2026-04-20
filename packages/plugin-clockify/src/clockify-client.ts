const BASE = "https://api.clockify.me/api/v1";

export class ClockifyClient {
  constructor(private readonly apiKey: string) {}

  private async req<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...opts,
      headers: {
        "X-Api-Key": this.apiKey,
        "Content-Type": "application/json",
        ...(opts.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`Clockify ${opts.method ?? "GET"} ${path} → ${res.status}`);
    return res.json() as Promise<T>;
  }

  getUser() {
    return this.req<Record<string, unknown>>("/user");
  }

  listWorkspaces() {
    return this.req<Record<string, unknown>[]>("/workspaces");
  }

  listProjects(workspaceId: string, params: { page?: number; pageSize?: number } = {}) {
    const q = new URLSearchParams();
    if (params.page) q.set("page", String(params.page));
    if (params.pageSize) q.set("page-size", String(params.pageSize));
    return this.req<Record<string, unknown>[]>(`/workspaces/${workspaceId}/projects?${q}`);
  }

  listClients(workspaceId: string) {
    return this.req<Record<string, unknown>[]>(`/workspaces/${workspaceId}/clients`);
  }

  listTags(workspaceId: string) {
    return this.req<Record<string, unknown>[]>(`/workspaces/${workspaceId}/tags`);
  }

  listUsers(workspaceId: string) {
    return this.req<Record<string, unknown>[]>(`/workspaces/${workspaceId}/users`);
  }

  listTimeEntries(
    workspaceId: string,
    userId: string,
    params: { start?: string; end?: string; page?: number; pageSize?: number } = {}
  ) {
    const q = new URLSearchParams();
    if (params.start) q.set("start", params.start);
    if (params.end) q.set("end", params.end);
    if (params.page) q.set("page", String(params.page));
    if (params.pageSize) q.set("page-size", String(params.pageSize));
    return this.req<Record<string, unknown>[]>(
      `/workspaces/${workspaceId}/user/${userId}/time-entries?${q}`
    );
  }

  addTimeEntry(
    workspaceId: string,
    body: {
      start: string;
      end?: string;
      description?: string;
      projectId?: string;
      tagIds?: string[];
    }
  ) {
    return this.req<Record<string, unknown>>(`/workspaces/${workspaceId}/time-entries`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  deleteTimeEntry(workspaceId: string, entryId: string) {
    return this.req<void>(`/workspaces/${workspaceId}/time-entries/${entryId}`, {
      method: "DELETE",
    });
  }

  getSummaryReport(
    workspaceId: string,
    body: {
      dateRangeStart: string;
      dateRangeEnd: string;
      summaryFilter?: { groups?: string[] };
    }
  ) {
    return this.req<Record<string, unknown>>(
      `/workspaces/${workspaceId}/reports/summary`,
      { method: "POST", body: JSON.stringify(body) }
    );
  }
}
