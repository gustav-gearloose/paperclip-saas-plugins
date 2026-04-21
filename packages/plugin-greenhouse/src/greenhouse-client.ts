const BASE = "https://harvest.greenhouse.io/v1";

export class GreenhouseClient {
  private readonly authHeader: string;
  private readonly onBehalfOf: string;

  constructor(apiKey: string, onBehalfOfUserId: string) {
    this.authHeader = "Basic " + Buffer.from(apiKey + ":").toString("base64");
    this.onBehalfOf = onBehalfOfUserId;
  }

  private async req<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      "Content-Type": "application/json",
      ...(opts.headers as Record<string, string> ?? {}),
    };
    if (this.onBehalfOf) {
      headers["On-Behalf-Of"] = this.onBehalfOf;
    }
    const res = await fetch(`${BASE}${path}`, { ...opts, headers });
    if (!res.ok) throw new Error(`Greenhouse ${opts.method ?? "GET"} ${path} → ${res.status}`);
    return res.json() as Promise<T>;
  }

  listJobs(params: { status?: string; department_id?: number; office_id?: number; per_page?: number; page?: number } = {}) {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.department_id != null) q.set("department_id", String(params.department_id));
    if (params.office_id != null) q.set("office_id", String(params.office_id));
    if (params.per_page != null) q.set("per_page", String(params.per_page));
    if (params.page != null) q.set("page", String(params.page));
    const qs = q.toString();
    return this.req<Record<string, unknown>>(`/jobs${qs ? "?" + qs : ""}`);
  }

  getJob(jobId: number) {
    return this.req<Record<string, unknown>>(`/jobs/${jobId}`);
  }

  listCandidates(params: { job_id?: number; per_page?: number; page?: number } = {}) {
    const q = new URLSearchParams();
    if (params.job_id != null) q.set("job_id", String(params.job_id));
    if (params.per_page != null) q.set("per_page", String(params.per_page));
    if (params.page != null) q.set("page", String(params.page));
    const qs = q.toString();
    return this.req<Record<string, unknown>>(`/candidates${qs ? "?" + qs : ""}`);
  }

  getCandidate(candidateId: number) {
    return this.req<Record<string, unknown>>(`/candidates/${candidateId}`);
  }

  createCandidate(data: Record<string, unknown>) {
    return this.req<Record<string, unknown>>("/candidates", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  listApplications(params: { job_id?: number; candidate_id?: number; per_page?: number; page?: number } = {}) {
    const q = new URLSearchParams();
    if (params.job_id != null) q.set("job_id", String(params.job_id));
    if (params.candidate_id != null) q.set("candidate_id", String(params.candidate_id));
    if (params.per_page != null) q.set("per_page", String(params.per_page));
    if (params.page != null) q.set("page", String(params.page));
    const qs = q.toString();
    return this.req<Record<string, unknown>>(`/applications${qs ? "?" + qs : ""}`);
  }

  listDepartments() {
    return this.req<Record<string, unknown>>("/departments");
  }

  listOffices() {
    return this.req<Record<string, unknown>>("/offices");
  }

  listUsers(params: { per_page?: number; page?: number } = {}) {
    const q = new URLSearchParams();
    if (params.per_page != null) q.set("per_page", String(params.per_page));
    if (params.page != null) q.set("page", String(params.page));
    const qs = q.toString();
    return this.req<Record<string, unknown>>(`/users${qs ? "?" + qs : ""}`);
  }

  listJobStages(jobId: number) {
    return this.req<Record<string, unknown>>(`/jobs/${jobId}/stages`);
  }
}
