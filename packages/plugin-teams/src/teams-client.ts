const GRAPH_API = "https://graph.microsoft.com/v1.0";
const TOKEN_ENDPOINT = "https://login.microsoftonline.com";

interface GraphResponse {
  value?: unknown[];
  [key: string]: unknown;
}

export class TeamsClient {
  private tenantId: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(tenantId: string, clientId: string, clientSecret: string) {
    this.tenantId = tenantId;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  private async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: "https://graph.microsoft.com/.default",
    });

    const resp = await fetch(`${TOKEN_ENDPOINT}/${this.tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Teams auth failed (${resp.status}): ${text}`);
    }

    const data = (await resp.json()) as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
    return this.accessToken;
  }

  private async get(path: string, params?: Record<string, string | number>): Promise<GraphResponse> {
    const token = await this.getToken();
    let url = `${GRAPH_API}${path}`;
    if (params) {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
      );
      url += `?${qs}`;
    }

    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Graph API error (${resp.status}) ${path}: ${text}`);
    }
    return resp.json() as Promise<GraphResponse>;
  }

  private async post(path: string, body: Record<string, unknown>): Promise<GraphResponse> {
    const token = await this.getToken();
    const resp = await fetch(`${GRAPH_API}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Graph API error (${resp.status}) POST ${path}: ${text}`);
    }
    return resp.json() as Promise<GraphResponse>;
  }

  async listTeams(limit = 50): Promise<GraphResponse> {
    return this.get("/groups", {
      $filter: "resourceProvisioningOptions/Any(x:x eq 'Team')",
      $select: "id,displayName,description,visibility",
      $top: limit,
    });
  }

  async listChannels(teamId: string): Promise<GraphResponse> {
    return this.get(`/teams/${teamId}/channels`, {
      $select: "id,displayName,description,membershipType",
    });
  }

  async getChannelMessages(teamId: string, channelId: string, limit = 20): Promise<GraphResponse> {
    return this.get(`/teams/${teamId}/channels/${channelId}/messages`, {
      $top: Math.min(limit, 50),
    });
  }

  async sendChannelMessage(teamId: string, channelId: string, message: string): Promise<GraphResponse> {
    return this.post(`/teams/${teamId}/channels/${channelId}/messages`, {
      body: { contentType: "html", content: message },
    });
  }

  async replyToMessage(teamId: string, channelId: string, messageId: string, reply: string): Promise<GraphResponse> {
    return this.post(`/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies`, {
      body: { contentType: "html", content: reply },
    });
  }

  async listChats(limit = 20): Promise<GraphResponse> {
    return this.get("/chats", {
      $select: "id,topic,chatType,lastUpdatedDateTime",
      $top: limit,
      $orderby: "lastUpdatedDateTime desc",
    });
  }

  async getChatMessages(chatId: string, limit = 20): Promise<GraphResponse> {
    return this.get(`/chats/${chatId}/messages`, {
      $top: Math.min(limit, 50),
    });
  }

  async listTeamMembers(teamId: string): Promise<GraphResponse> {
    return this.get(`/teams/${teamId}/members`, {
      $select: "id,displayName,email,roles",
    });
  }
}
