const DRIVE_BASE = "https://www.googleapis.com/drive/v3";
const UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export class GoogleDriveClient {
  private serviceAccount: ServiceAccountKey;
  private readonly delegatedUser: string;
  private accessToken = "";
  private tokenExpiry = 0;

  constructor(serviceAccountJson: string, delegatedUser: string) {
    this.serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccountKey;
    if (!this.serviceAccount.client_email || !this.serviceAccount.private_key) {
      throw new Error("Service account JSON must contain client_email and private_key");
    }
    this.delegatedUser = delegatedUser;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60_000) return this.accessToken;
    const now = Math.floor(Date.now() / 1000);
    const claim: Record<string, unknown> = {
      iss: this.serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/drive",
      aud: this.serviceAccount.token_uri ?? "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };
    if (this.delegatedUser) claim.sub = this.delegatedUser;

    const jwt = await this.signJwt(claim);
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
    if (!resp.ok) throw new Error(`Google OAuth token error: ${resp.status} ${await resp.text()}`);
    const data = await resp.json() as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;
    return this.accessToken;
  }

  private async signJwt(payload: Record<string, unknown>): Promise<string> {
    const header = { alg: "RS256", typ: "JWT" };
    const encode = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
    const signingInput = `${encode(header)}.${encode(payload)}`;
    const { createSign } = await import("crypto");
    const sign = createSign("RSA-SHA256");
    sign.update(signingInput);
    const signature = sign.sign(this.serviceAccount.private_key, "base64url");
    return `${signingInput}.${signature}`;
  }

  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken();
    const res = await fetch(url, {
      ...options,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string> ?? {}),
      },
    });
    if (res.status === 204) return undefined as unknown as T;
    if (!res.ok) throw new Error(`Drive API ${options.method ?? "GET"} ${url}: ${res.status} ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  // ── Files ─────────────────────────────────────────────────────────────────

  async listFiles(params: {
    folder_id?: string;
    query?: string;
    mime_type?: string;
    limit?: number;
    order_by?: string;
  }) {
    const limit = params.limit ?? 50;
    const parts: string[] = ["trashed = false"];
    if (params.folder_id) parts.push(`'${params.folder_id}' in parents`);
    if (params.mime_type) parts.push(`mimeType = '${params.mime_type}'`);
    if (params.query) parts.push(`name contains '${params.query}'`);
    const q = encodeURIComponent(parts.join(" and "));
    const orderBy = encodeURIComponent(params.order_by ?? "modifiedTime desc");
    const fields = encodeURIComponent("files(id,name,mimeType,size,modifiedTime,createdTime,webViewLink,parents)");
    const url = `${DRIVE_BASE}/files?q=${q}&pageSize=${limit}&orderBy=${orderBy}&fields=${fields}`;
    const data = await this.request<{ files: unknown[] }>(url);
    return data.files ?? [];
  }

  async getFile(fileId: string) {
    const fields = "id,name,mimeType,size,modifiedTime,createdTime,webViewLink,parents,description,sharingUser,owners";
    return this.request<unknown>(`${DRIVE_BASE}/files/${fileId}?fields=${encodeURIComponent(fields)}`);
  }

  async getFileContent(fileId: string): Promise<string> {
    const token = await this.getAccessToken();
    // First get the file's mimeType
    const meta = await this.getFile(fileId) as { mimeType?: string; name?: string };
    const mimeType = meta.mimeType ?? "";

    let url: string;
    if (mimeType.startsWith("application/vnd.google-apps.")) {
      // Google Workspace file — export as plain text
      const exportMime = encodeURIComponent("text/plain");
      url = `${DRIVE_BASE}/files/${fileId}/export?mimeType=${exportMime}`;
    } else {
      url = `${DRIVE_BASE}/files/${fileId}?alt=media`;
    }

    const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Drive API download ${fileId}: ${res.status} ${await res.text()}`);
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("text") || ct.includes("json")) return res.text();
    const buf = await res.arrayBuffer();
    return `[Binary file: ${meta.name ?? fileId}, ${buf.byteLength} bytes, ${ct}]`;
  }

  async searchFiles(params: {
    query: string;
    limit?: number;
  }) {
    const limit = params.limit ?? 25;
    const q = encodeURIComponent(`fullText contains '${params.query}' and trashed = false`);
    const fields = encodeURIComponent("files(id,name,mimeType,size,modifiedTime,webViewLink,parents)");
    const url = `${DRIVE_BASE}/files?q=${q}&pageSize=${limit}&fields=${fields}`;
    const data = await this.request<{ files: unknown[] }>(url);
    return data.files ?? [];
  }

  async createFolder(params: {
    name: string;
    parent_id?: string;
  }) {
    const body: Record<string, unknown> = {
      name: params.name,
      mimeType: "application/vnd.google-apps.folder",
    };
    if (params.parent_id) body.parents = [params.parent_id];
    return this.request<unknown>(`${DRIVE_BASE}/files`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async uploadFile(params: {
    name: string;
    content: string;
    mime_type?: string;
    parent_id?: string;
  }) {
    const token = await this.getAccessToken();
    const mimeType = params.mime_type ?? "text/plain";
    const metadata: Record<string, unknown> = { name: params.name };
    if (params.parent_id) metadata.parents = [params.parent_id];

    // Multipart upload
    const boundary = "paperclip_boundary";
    const body = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      `Content-Type: ${mimeType}`,
      "",
      params.content,
      `--${boundary}--`,
    ].join("\r\n");

    const res = await fetch(`${UPLOAD_BASE}/files?uploadType=multipart`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    if (!res.ok) throw new Error(`Drive API upload: ${res.status} ${await res.text()}`);
    return res.json();
  }

  async updateFile(params: {
    file_id: string;
    content: string;
    mime_type?: string;
  }) {
    const token = await this.getAccessToken();
    const mimeType = params.mime_type ?? "text/plain";
    const res = await fetch(`${UPLOAD_BASE}/files/${params.file_id}?uploadType=media`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": mimeType,
      },
      body: params.content,
    });
    if (!res.ok) throw new Error(`Drive API update: ${res.status} ${await res.text()}`);
    return res.json();
  }

  async deleteFile(fileId: string) {
    await this.request<unknown>(`${DRIVE_BASE}/files/${fileId}`, { method: "DELETE" });
    return { deleted: true };
  }

  async moveFile(params: {
    file_id: string;
    new_parent_id: string;
    remove_parent_id?: string;
  }) {
    const token = await this.getAccessToken();
    const current = await this.getFile(params.file_id) as { parents?: string[] };
    const removeParents = params.remove_parent_id ?? (current.parents?.[0] ?? "");
    const url = `${DRIVE_BASE}/files/${params.file_id}?addParents=${params.new_parent_id}&removeParents=${removeParents}&fields=id,name,parents`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) throw new Error(`Drive API move: ${res.status} ${await res.text()}`);
    return res.json();
  }

  async copyFile(params: {
    file_id: string;
    name?: string;
    parent_id?: string;
  }) {
    const body: Record<string, unknown> = {};
    if (params.name) body.name = params.name;
    if (params.parent_id) body.parents = [params.parent_id];
    return this.request<unknown>(`${DRIVE_BASE}/files/${params.file_id}/copy`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async createSharingLink(params: {
    file_id: string;
    role?: string;
    type?: string;
  }) {
    const body = {
      role: params.role ?? "reader",
      type: params.type ?? "domain",
    };
    await this.request<unknown>(`${DRIVE_BASE}/files/${params.file_id}/permissions`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const file = await this.getFile(params.file_id) as { webViewLink?: string };
    return { webViewLink: file.webViewLink, permission: body };
  }

  async listSharedWithMe(params: { limit?: number }) {
    const limit = params.limit ?? 25;
    const q = encodeURIComponent("sharedWithMe = true and trashed = false");
    const fields = encodeURIComponent("files(id,name,mimeType,size,modifiedTime,webViewLink,sharingUser)");
    const data = await this.request<{ files: unknown[] }>(
      `${DRIVE_BASE}/files?q=${q}&pageSize=${limit}&fields=${fields}`
    );
    return data.files ?? [];
  }

  async getAbout() {
    return this.request<unknown>(`${DRIVE_BASE}/about?fields=user,storageQuota`);
  }
}
