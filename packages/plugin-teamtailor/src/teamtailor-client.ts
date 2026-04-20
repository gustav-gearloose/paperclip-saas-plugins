const BASE = "https://api.teamtailor.com/v1";
const API_VERSION = "20210218";

export class TeamtailorClient {
  private readonly authHeader: string;

  constructor(apiKey: string) {
    this.authHeader = `Token token=${apiKey}`;
  }

  private async req<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...opts,
      headers: {
        Authorization: this.authHeader,
        "X-Api-Version": API_VERSION,
        "Content-Type": "application/json",
        ...(opts.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`Teamtailor ${opts.method ?? "GET"} ${path} → ${res.status}`);
    return res.json() as Promise<T>;
  }

  listJobs(params: { limit?: number; page?: number } = {}) {
    const q = new URLSearchParams();
    if (params.limit != null) q.set("page[size]", String(params.limit));
    if (params.page != null) q.set("page[number]", String(params.page));
    const qs = q.toString();
    return this.req<Record<string, unknown>>(`/jobs${qs ? "?" + qs : ""}`);
  }

  getJob(jobId: number) {
    return this.req<Record<string, unknown>>(`/jobs/${jobId}`);
  }

  listCandidates(params: { limit?: number; page?: number } = {}) {
    const q = new URLSearchParams();
    if (params.limit != null) q.set("page[size]", String(params.limit));
    if (params.page != null) q.set("page[number]", String(params.page));
    const qs = q.toString();
    return this.req<Record<string, unknown>>(`/candidates${qs ? "?" + qs : ""}`);
  }

  getCandidate(candidateId: number) {
    return this.req<Record<string, unknown>>(`/candidates/${candidateId}`);
  }

  createCandidate(data: Record<string, unknown>) {
    return this.req<Record<string, unknown>>("/candidates", {
      method: "POST",
      body: JSON.stringify({ data: { type: "candidates", attributes: data } }),
    });
  }

  listJobApplications(params: { jobId?: number; limit?: number; page?: number } = {}) {
    const q = new URLSearchParams();
    if (params.jobId != null) q.set("filter[job-id]", String(params.jobId));
    if (params.limit != null) q.set("page[size]", String(params.limit));
    if (params.page != null) q.set("page[number]", String(params.page));
    const qs = q.toString();
    return this.req<Record<string, unknown>>(`/job-applications${qs ? "?" + qs : ""}`);
  }

  listDepartments() {
    return this.req<Record<string, unknown>>("/departments");
  }

  listLocations() {
    return this.req<Record<string, unknown>>("/locations");
  }

  listUsers(params: { limit?: number; page?: number } = {}) {
    const q = new URLSearchParams();
    if (params.limit != null) q.set("page[size]", String(params.limit));
    if (params.page != null) q.set("page[number]", String(params.page));
    const qs = q.toString();
    return this.req<Record<string, unknown>>(`/users${qs ? "?" + qs : ""}`);
  }

  listStages() {
    return this.req<Record<string, unknown>>("/stages");
  }

  listCustomFields() {
    return this.req<Record<string, unknown>>("/custom-fields");
  }
}
