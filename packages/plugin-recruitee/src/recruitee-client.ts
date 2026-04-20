export class RecruiteeClient {
  private readonly base: string;
  private readonly authHeader: string;

  constructor(companyId: string, apiToken: string) {
    this.base = `https://api.recruitee.com/c/${companyId}`;
    this.authHeader = `Bearer ${apiToken}`;
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
    if (!res.ok) throw new Error(`Recruitee ${opts.method ?? "GET"} ${path} → ${res.status}`);
    return res.json() as Promise<T>;
  }

  listOffers(params: { limit?: number; offset?: number } = {}) {
    const q = new URLSearchParams();
    if (params.limit != null) q.set("limit", String(params.limit));
    if (params.offset != null) q.set("offset", String(params.offset));
    const qs = q.toString();
    return this.req<Record<string, unknown>>(`/offers${qs ? "?" + qs : ""}`);
  }

  getOffer(offerId: number) {
    return this.req<Record<string, unknown>>(`/offers/${offerId}`);
  }

  listCandidates(params: { limit?: number; offset?: number } = {}) {
    const q = new URLSearchParams();
    if (params.limit != null) q.set("limit", String(params.limit));
    if (params.offset != null) q.set("offset", String(params.offset));
    const qs = q.toString();
    return this.req<Record<string, unknown>>(`/candidates${qs ? "?" + qs : ""}`);
  }

  getCandidate(candidateId: number) {
    return this.req<Record<string, unknown>>(`/candidates/${candidateId}`);
  }

  searchCandidates(query: string, params: { limit?: number; offset?: number } = {}) {
    const q = new URLSearchParams({ query });
    if (params.limit != null) q.set("limit", String(params.limit));
    if (params.offset != null) q.set("offset", String(params.offset));
    return this.req<Record<string, unknown>>(`/search/new/candidates?${q.toString()}`);
  }

  listCandidatesForOffer(offerSlug: string) {
    return this.req<Record<string, unknown>>(`/offers/${offerSlug}/candidates`);
  }

  createCandidate(offerSlug: string, data: Record<string, unknown>) {
    return this.req<Record<string, unknown>>(`/offers/${offerSlug}/candidates`, {
      method: "POST",
      body: JSON.stringify({ candidate: data }),
    });
  }

  listPipelines() {
    return this.req<Record<string, unknown>>("/pipelines");
  }

  listMembers() {
    return this.req<Record<string, unknown>>("/members");
  }

  listTags() {
    return this.req<Record<string, unknown>>("/tags");
  }
}
