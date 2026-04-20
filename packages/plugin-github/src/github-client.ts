const BASE_URL = "https://api.github.com";

export class GitHubClient {
  private headers: Record<string, string>;
  private defaultOwner: string;

  constructor(token: string, defaultOwner = "") {
    this.defaultOwner = defaultOwner;
    this.headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };
  }

  private owner(override?: string): string {
    const o = override ?? this.defaultOwner;
    if (!o) throw new Error("owner is required (set a default owner in plugin config or pass owner parameter)");
    return o;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: this.headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`GitHub ${method} ${path} → ${res.status}: ${text}`);
    }
    if (res.status === 204) return {} as T;
    return res.json() as Promise<T>;
  }

  async listRepos(params: { owner?: string; type?: string; limit?: number }): Promise<unknown> {
    const o = this.owner(params.owner);
    return this.request("GET", `/users/${o}/repos?type=${params.type ?? "all"}&per_page=${params.limit ?? 30}&sort=updated`);
  }

  async getRepo(owner: string | undefined, repo: string): Promise<unknown> {
    return this.request("GET", `/repos/${this.owner(owner)}/${repo}`);
  }

  async searchIssues(query: string, limit: number): Promise<unknown> {
    return this.request("GET", `/search/issues?q=${encodeURIComponent(query)}&per_page=${limit}`);
  }

  async getIssue(owner: string | undefined, repo: string, issueNumber: number): Promise<unknown> {
    const o = this.owner(owner);
    const [issue, comments] = await Promise.all([
      this.request("GET", `/repos/${o}/${repo}/issues/${issueNumber}`),
      this.request("GET", `/repos/${o}/${repo}/issues/${issueNumber}/comments?per_page=20`),
    ]);
    return { issue, comments };
  }

  async createIssue(params: {
    owner?: string;
    repo: string;
    title: string;
    body?: string;
    labels?: string[];
    assignees?: string[];
  }): Promise<unknown> {
    return this.request("POST", `/repos/${this.owner(params.owner)}/${params.repo}/issues`, {
      title: params.title,
      body: params.body,
      labels: params.labels,
      assignees: params.assignees,
    });
  }

  async listPRs(params: { owner?: string; repo: string; state?: string; limit?: number }): Promise<unknown> {
    return this.request(
      "GET",
      `/repos/${this.owner(params.owner)}/${params.repo}/pulls?state=${params.state ?? "open"}&per_page=${params.limit ?? 20}&sort=updated`
    );
  }

  async getPR(owner: string | undefined, repo: string, prNumber: number): Promise<unknown> {
    return this.request("GET", `/repos/${this.owner(owner)}/${repo}/pulls/${prNumber}`);
  }

  async addComment(params: {
    owner?: string;
    repo: string;
    issue_number: number;
    body: string;
  }): Promise<unknown> {
    return this.request("POST", `/repos/${this.owner(params.owner)}/${params.repo}/issues/${params.issue_number}/comments`, {
      body: params.body,
    });
  }

  async searchCode(query: string, limit: number): Promise<unknown> {
    return this.request("GET", `/search/code?q=${encodeURIComponent(query)}&per_page=${limit}`);
  }

  async listCommits(params: { owner?: string; repo: string; branch?: string; limit?: number }): Promise<unknown> {
    const qs = new URLSearchParams({ per_page: String(params.limit ?? 20) });
    if (params.branch) qs.set("sha", params.branch);
    return this.request("GET", `/repos/${this.owner(params.owner)}/${params.repo}/commits?${qs}`);
  }
}
