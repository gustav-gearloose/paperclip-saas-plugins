export class WorkableClient {
  private readonly base: string;
  private readonly authHeader: string;

  constructor(subdomain: string, accessToken: string) {
    this.base = `https://${subdomain}.workable.com/spi/v3`;
    this.authHeader = `Bearer ${accessToken}`;
  }

  private async req<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      ...opts,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        ...(opts.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`Workable ${opts.method ?? "GET"} ${path} → ${res.status}`);
    return res.json() as Promise<T>;
  }

  listJobs(params: { limit?: number; offset?: number; state?: string } = {}) {
    const q = new URLSearchParams();
    if (params.limit != null) q.set("limit", String(params.limit));
    if (params.offset != null) q.set("offset", String(params.offset));
    if (params.state) q.set("state", params.state);
    const qs = q.toString();
    return this.req<Record<string, unknown>>(`/jobs${qs ? "?" + qs : ""}`);
  }

  getJob(shortcode: string) {
    return this.req<Record<string, unknown>>(`/jobs/${shortcode}`);
  }

  listCandidates(params: { jobShortcode?: string; limit?: number; since_id?: string; max_id?: string } = {}) {
    const q = new URLSearchParams();
    if (params.limit != null) q.set("limit", String(params.limit));
    if (params.since_id) q.set("since_id", params.since_id);
    if (params.max_id) q.set("max_id", params.max_id);
    const basePath = params.jobShortcode ? `/jobs/${params.jobShortcode}/candidates` : "/candidates";
    const qs = q.toString();
    return this.req<Record<string, unknown>>(`${basePath}${qs ? "?" + qs : ""}`);
  }

  getCandidate(candidateId: string) {
    return this.req<Record<string, unknown>>(`/candidates/${candidateId}`);
  }

  createCandidate(jobShortcode: string, data: Record<string, unknown>) {
    return this.req<Record<string, unknown>>(`/jobs/${jobShortcode}/candidates`, {
      method: "POST",
      body: JSON.stringify({ candidate: data }),
    });
  }

  listMembers(params: { limit?: number; offset?: number } = {}) {
    const q = new URLSearchParams();
    if (params.limit != null) q.set("limit", String(params.limit));
    if (params.offset != null) q.set("offset", String(params.offset));
    const qs = q.toString();
    return this.req<Record<string, unknown>>(`/members${qs ? "?" + qs : ""}`);
  }

  listDepartments() {
    return this.req<Record<string, unknown>>("/departments");
  }

  listLocations() {
    return this.req<Record<string, unknown>>("/locations");
  }

  listStages() {
    return this.req<Record<string, unknown>>("/stages");
  }

  listRequisitions(params: { limit?: number; offset?: number } = {}) {
    const q = new URLSearchParams();
    if (params.limit != null) q.set("limit", String(params.limit));
    if (params.offset != null) q.set("offset", String(params.offset));
    const qs = q.toString();
    return this.req<Record<string, unknown>>(`/requisitions${qs ? "?" + qs : ""}`);
  }
}
