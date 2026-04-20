const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export interface GraphClientConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  defaultUser: string;
}

export class GraphClient {
  private readonly tenantId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  readonly defaultUser: string;
  private accessToken = "";
  private tokenExpiresAt = 0;

  constructor(config: GraphClientConfig) {
    this.tenantId = config.tenantId;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.defaultUser = config.defaultUser;
  }

  private async ensureToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) return;
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: "https://graph.microsoft.com/.default",
    });
    const res = await fetch(
      `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() }
    );
    if (!res.ok) throw new Error(`Token request failed: ${res.status} ${await res.text()}`);
    const data = await res.json() as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    await this.ensureToken();
    const res = await fetch(`${GRAPH_BASE}${path}`, {
      ...options,
      headers: {
        "Authorization": `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string> ?? {}),
      },
    });
    if (res.status === 204) return undefined as unknown as T;
    if (!res.ok) throw new Error(`Graph API ${options.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  private user(override?: string): string {
    return override ?? this.defaultUser;
  }

  // ── Drive / Files ──────────────────────────────────────────────────────────

  async listDriveItems(params: {
    folder_path?: string;
    drive_id?: string;
    limit?: number;
    user?: string;
  }) {
    const limit = params.limit ?? 50;
    const u = this.user(params.user);
    let base: string;
    if (params.drive_id) {
      const folder = params.folder_path ? `:/${params.folder_path}:` : "/root";
      base = `/drives/${params.drive_id}/root${folder}/children`;
    } else if (params.folder_path) {
      base = `/users/${u}/drive/root:/${params.folder_path}:/children`;
    } else {
      base = `/users/${u}/drive/root/children`;
    }
    const data = await this.request<{ value: unknown[] }>(`${base}?$top=${limit}&$select=id,name,size,lastModifiedDateTime,file,folder,webUrl`);
    return data.value ?? [];
  }

  async getDriveItem(params: {
    item_id?: string;
    item_path?: string;
    drive_id?: string;
    user?: string;
  }) {
    const u = this.user(params.user);
    let path: string;
    if (params.drive_id && params.item_id) {
      path = `/drives/${params.drive_id}/items/${params.item_id}`;
    } else if (params.item_id) {
      path = `/users/${u}/drive/items/${params.item_id}`;
    } else if (params.item_path) {
      path = `/users/${u}/drive/root:/${params.item_path}`;
    } else {
      throw new Error("Either item_id or item_path is required");
    }
    return this.request<unknown>(`${path}?$select=id,name,size,lastModifiedDateTime,file,folder,webUrl,parentReference,createdBy,lastModifiedBy`);
  }

  async getFileContent(params: {
    item_id?: string;
    item_path?: string;
    user?: string;
  }): Promise<string> {
    const u = this.user(params.user);
    let path: string;
    if (params.item_id) {
      path = `/users/${u}/drive/items/${params.item_id}/content`;
    } else if (params.item_path) {
      path = `/users/${u}/drive/root:/${params.item_path}:/content`;
    } else {
      throw new Error("Either item_id or item_path is required");
    }
    await this.ensureToken();
    const res = await fetch(`${GRAPH_BASE}${path}`, {
      headers: { "Authorization": `Bearer ${this.accessToken}` },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`Graph API GET ${path}: ${res.status} ${await res.text()}`);
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("text") || ct.includes("json")) {
      return res.text();
    }
    const buf = await res.arrayBuffer();
    return `[Binary content, ${buf.byteLength} bytes, content-type: ${ct}]`;
  }

  async searchDrive(params: {
    query: string;
    limit?: number;
    user?: string;
  }) {
    const u = this.user(params.user);
    const limit = params.limit ?? 25;
    const data = await this.request<{ value: unknown[] }>(
      `/users/${u}/drive/search(q='${encodeURIComponent(params.query)}')?$top=${limit}&$select=id,name,size,lastModifiedDateTime,file,folder,webUrl`
    );
    return data.value ?? [];
  }

  async createFolder(params: {
    name: string;
    parent_path?: string;
    parent_id?: string;
    user?: string;
  }) {
    const u = this.user(params.user);
    let base: string;
    if (params.parent_id) {
      base = `/users/${u}/drive/items/${params.parent_id}/children`;
    } else if (params.parent_path) {
      base = `/users/${u}/drive/root:/${params.parent_path}:/children`;
    } else {
      base = `/users/${u}/drive/root/children`;
    }
    return this.request<unknown>(base, {
      method: "POST",
      body: JSON.stringify({ name: params.name, folder: {}, "@microsoft.graph.conflictBehavior": "rename" }),
    });
  }

  async uploadFile(params: {
    file_path: string;
    content: string;
    content_type?: string;
    user?: string;
  }) {
    const u = this.user(params.user);
    await this.ensureToken();
    const ct = params.content_type ?? "text/plain";
    const body = params.content;
    const res = await fetch(`${GRAPH_BASE}/users/${u}/drive/root:/${params.file_path}:/content`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${this.accessToken}`,
        "Content-Type": ct,
      },
      body,
    });
    if (!res.ok) throw new Error(`Graph API PUT file: ${res.status} ${await res.text()}`);
    return res.json();
  }

  async deleteItem(params: {
    item_id?: string;
    item_path?: string;
    user?: string;
  }) {
    const u = this.user(params.user);
    let path: string;
    if (params.item_id) {
      path = `/users/${u}/drive/items/${params.item_id}`;
    } else if (params.item_path) {
      path = `/users/${u}/drive/root:/${params.item_path}`;
    } else {
      throw new Error("Either item_id or item_path is required");
    }
    await this.request<unknown>(path, { method: "DELETE" });
    return { deleted: true };
  }

  async moveItem(params: {
    item_id: string;
    destination_parent_id: string;
    new_name?: string;
    user?: string;
  }) {
    const u = this.user(params.user);
    const body: Record<string, unknown> = {
      parentReference: { id: params.destination_parent_id },
    };
    if (params.new_name) body.name = params.new_name;
    return this.request<unknown>(`/users/${u}/drive/items/${params.item_id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  async copyItem(params: {
    item_id: string;
    destination_parent_id: string;
    new_name?: string;
    user?: string;
  }) {
    const u = this.user(params.user);
    const body: Record<string, unknown> = {
      parentReference: { id: params.destination_parent_id },
    };
    if (params.new_name) body.name = params.new_name;
    return this.request<unknown>(`/users/${u}/drive/items/${params.item_id}/copy`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async listDrives(params: { user?: string }) {
    const u = this.user(params.user);
    const data = await this.request<{ value: unknown[] }>(`/users/${u}/drives?$select=id,name,driveType,quota,owner`);
    return data.value ?? [];
  }

  async getSharingLink(params: {
    item_id: string;
    link_type?: string;
    scope?: string;
    user?: string;
  }) {
    const u = this.user(params.user);
    const body = {
      type: params.link_type ?? "view",
      scope: params.scope ?? "organization",
    };
    return this.request<unknown>(`/users/${u}/drive/items/${params.item_id}/createLink`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
}
