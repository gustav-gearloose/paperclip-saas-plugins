const LINEAR_API = "https://api.linear.app/graphql";

interface LinearResponse {
  data?: Record<string, unknown>;
  errors?: Array<{ message: string }>;
}

export class LinearClient {
  private token: string;

  constructor(apiKey: string) {
    this.token = apiKey;
  }

  private async query(gql: string, variables?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const resp = await fetch(LINEAR_API, {
      method: "POST",
      headers: {
        Authorization: this.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: gql, variables: variables ?? {} }),
    });
    const result = (await resp.json()) as LinearResponse;
    if (result.errors?.length) {
      throw new Error(`Linear API error: ${result.errors.map(e => e.message).join(", ")}`);
    }
    return result.data ?? {};
  }

  async listIssues(teamId?: string, states?: string[], first = 25): Promise<Record<string, unknown>> {
    const filters: string[] = [];
    if (teamId) filters.push(`team: { id: { eq: "${teamId}" } }`);
    if (states?.length) filters.push(`state: { name: { in: [${states.map(s => `"${s}"`).join(",")}] } }`);
    const filterStr = filters.length ? `(filter: { ${filters.join(", ")} }, first: ${first})` : `(first: ${first})`;
    return this.query(`query {
      issues${filterStr} {
        nodes { id title state { name } assignee { name } priority dueDate createdAt updatedAt url }
      }
    }`);
  }

  async getIssue(issueId: string): Promise<Record<string, unknown>> {
    return this.query(`query { issue(id: "${issueId}") { id title description state { name } assignee { name } priority dueDate createdAt updatedAt url team { name } labels { nodes { name } } } }`);
  }

  async createIssue(teamId: string, title: string, description?: string, priority?: number, assigneeId?: string): Promise<Record<string, unknown>> {
    const input: Record<string, unknown> = { teamId, title };
    if (description) input.description = description;
    if (priority !== undefined) input.priority = priority;
    if (assigneeId) input.assigneeId = assigneeId;
    return this.query(`mutation CreateIssue($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id title url } } }`, { input });
  }

  async updateIssue(issueId: string, update: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.query(`mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success issue { id title state { name } url } } }`, { id: issueId, input: update });
  }

  async listTeams(): Promise<Record<string, unknown>> {
    return this.query(`query { teams { nodes { id name key description } } }`);
  }

  async listProjects(teamId?: string): Promise<Record<string, unknown>> {
    const filter = teamId ? `(filter: { teams: { id: { eq: "${teamId}" } } })` : "";
    return this.query(`query { projects${filter} { nodes { id name description state { name } progress startDate targetDate } } }`);
  }

  async listMembers(): Promise<Record<string, unknown>> {
    return this.query(`query { users { nodes { id name email displayName } } }`);
  }

  async addComment(issueId: string, body: string): Promise<Record<string, unknown>> {
    return this.query(`mutation AddComment($input: CommentCreateInput!) { commentCreate(input: $input) { success comment { id body createdAt } } }`, { input: { issueId, body } });
  }

  async searchIssues(query: string, first = 20): Promise<Record<string, unknown>> {
    return this.query(`query SearchIssues($term: String!, $first: Int!) { issueSearch(query: $term, first: $first) { nodes { id title state { name } assignee { name } priority url } } }`, { term: query, first });
  }
}
