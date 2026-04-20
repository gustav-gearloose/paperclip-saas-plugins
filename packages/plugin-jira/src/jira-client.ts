export class JiraClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(domain: string, email: string, apiToken: string) {
    this.baseUrl = `https://${domain}.atlassian.net`;
    const credentials = Buffer.from(`${email}:${apiToken}`).toString("base64");
    this.headers = {
      Authorization: `Basic ${credentials}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Jira ${method} ${path} → ${res.status}: ${text}`);
    }
    if (res.status === 204) return {} as T;
    return res.json() as Promise<T>;
  }

  async searchIssues(params: {
    jql?: string;
    text?: string;
    limit?: number;
  }): Promise<unknown> {
    const jql = params.jql ?? (params.text ? `text ~ "${params.text}"` : "order by created DESC");
    return this.request("POST", "/rest/api/3/issue/picker", undefined).catch(() =>
      this.request("GET", `/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${params.limit ?? 20}`)
    );
  }

  async searchIssuesJql(jql: string, limit: number): Promise<unknown> {
    return this.request("GET", `/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${limit}&fields=summary,status,assignee,priority,issuetype,description,labels,comment`);
  }

  async getIssue(issueKey: string): Promise<unknown> {
    return this.request("GET", `/rest/api/3/issue/${issueKey}`);
  }

  async createIssue(params: {
    project_key: string;
    summary: string;
    description?: string;
    issue_type?: string;
    priority?: string;
    assignee_account_id?: string;
    labels?: string[];
  }): Promise<unknown> {
    const fields: Record<string, unknown> = {
      project: { key: params.project_key },
      summary: params.summary,
      issuetype: { name: params.issue_type ?? "Task" },
    };
    if (params.description) {
      fields.description = {
        type: "doc",
        version: 1,
        content: [{ type: "paragraph", content: [{ type: "text", text: params.description }] }],
      };
    }
    if (params.priority) fields.priority = { name: params.priority };
    if (params.assignee_account_id) fields.assignee = { accountId: params.assignee_account_id };
    if (params.labels) fields.labels = params.labels;
    return this.request("POST", "/rest/api/3/issue", { fields });
  }

  async updateIssue(params: {
    issue_key: string;
    summary?: string;
    description?: string;
    priority?: string;
    assignee_account_id?: string;
    labels?: string[];
  }): Promise<unknown> {
    const fields: Record<string, unknown> = {};
    if (params.summary) fields.summary = params.summary;
    if (params.description) {
      fields.description = {
        type: "doc",
        version: 1,
        content: [{ type: "paragraph", content: [{ type: "text", text: params.description }] }],
      };
    }
    if (params.priority) fields.priority = { name: params.priority };
    if (params.assignee_account_id) fields.assignee = { accountId: params.assignee_account_id };
    if (params.labels) fields.labels = params.labels;
    await this.request("PUT", `/rest/api/3/issue/${params.issue_key}`, { fields });
    return { updated: true, issue_key: params.issue_key };
  }

  async transitionIssue(issueKey: string, transitionName: string): Promise<unknown> {
    const transitions = await this.request<{ transitions: Array<{ id: string; name: string }> }>(
      "GET",
      `/rest/api/3/issue/${issueKey}/transitions`
    );
    const match = transitions.transitions.find(
      (t) => t.name.toLowerCase() === transitionName.toLowerCase()
    );
    if (!match) {
      const names = transitions.transitions.map((t) => t.name).join(", ");
      throw new Error(`No transition named "${transitionName}". Available: ${names}`);
    }
    await this.request("POST", `/rest/api/3/issue/${issueKey}/transitions`, {
      transition: { id: match.id },
    });
    return { transitioned: true, issue_key: issueKey, status: transitionName };
  }

  async addComment(issueKey: string, comment: string): Promise<unknown> {
    return this.request("POST", `/rest/api/3/issue/${issueKey}/comment`, {
      body: {
        type: "doc",
        version: 1,
        content: [{ type: "paragraph", content: [{ type: "text", text: comment }] }],
      },
    });
  }

  async listProjects(limit: number): Promise<unknown> {
    return this.request("GET", `/rest/api/3/project/search?maxResults=${limit}`);
  }

  async getProject(projectKey: string): Promise<unknown> {
    return this.request("GET", `/rest/api/3/project/${projectKey}`);
  }

  async listSprints(boardId: number, state: string): Promise<unknown> {
    return this.request("GET", `/rest/agile/1.0/board/${boardId}/sprint?state=${state}`);
  }

  async listUsers(query: string, limit: number): Promise<unknown> {
    return this.request("GET", `/rest/api/3/user/search?query=${encodeURIComponent(query)}&maxResults=${limit}`);
  }
}
