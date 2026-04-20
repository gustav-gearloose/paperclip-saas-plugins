const API = "https://api.dropboxapi.com/2";
const CONTENT = "https://content.dropboxapi.com/2";

export class DropboxClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private auth(): Record<string, string> {
    return { "Authorization": `Bearer ${this.accessToken}` };
  }

  private async rpc<T>(endpoint: string, body: unknown): Promise<T> {
    const res = await fetch(`${API}/${endpoint}`, {
      method: "POST",
      headers: { ...this.auth(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Dropbox ${endpoint}: ${res.status} ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) as T : undefined as unknown as T;
  }

  // ── Files ──────────────────────────────────────────────────────────────────

  async listFolder(params: { path?: string; limit?: number; recursive?: boolean }) {
    const path = params.path ?? "";
    const result = await this.rpc<{ entries: unknown[]; cursor: string; has_more: boolean }>(
      "files/list_folder",
      { path, limit: params.limit ?? 100, recursive: params.recursive ?? false }
    );
    return result.entries ?? [];
  }

  async getMetadata(params: { path: string }) {
    return this.rpc<unknown>("files/get_metadata", { path: params.path });
  }

  async search(params: { query: string; path?: string; limit?: number; file_category?: string }) {
    const options: Record<string, unknown> = { query: params.query };
    if (params.path) options.path = params.path;
    if (params.limit) options.max_results = params.limit;
    if (params.file_category) options.file_categories = [{ ".tag": params.file_category }];
    const result = await this.rpc<{ matches: Array<{ metadata: { metadata: unknown } }> }>(
      "files/search_v2", options
    );
    return (result.matches ?? []).map(m => m.metadata?.metadata);
  }

  async download(params: { path: string }): Promise<string> {
    const res = await fetch(`${CONTENT}/files/download`, {
      method: "POST",
      headers: {
        ...this.auth(),
        "Dropbox-API-Arg": JSON.stringify({ path: params.path }),
      },
    });
    if (!res.ok) throw new Error(`Dropbox download ${params.path}: ${res.status} ${await res.text()}`);
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("text") || ct.includes("json") || ct.includes("xml") || ct.includes("markdown")) {
      return res.text();
    }
    const buf = await res.arrayBuffer();
    const meta = res.headers.get("dropbox-api-result") ?? "{}";
    const name = (JSON.parse(meta) as { name?: string }).name ?? params.path;
    return `[Binary file: ${name}, ${buf.byteLength} bytes, ${ct}]`;
  }

  async upload(params: { path: string; content: string; mode?: string; autorename?: boolean }) {
    const res = await fetch(`${CONTENT}/files/upload`, {
      method: "POST",
      headers: {
        ...this.auth(),
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: params.path,
          mode: params.mode ?? "add",
          autorename: params.autorename ?? false,
        }),
      },
      body: params.content,
    });
    if (!res.ok) throw new Error(`Dropbox upload ${params.path}: ${res.status} ${await res.text()}`);
    return res.json();
  }

  async createFolder(params: { path: string; autorename?: boolean }) {
    return this.rpc<unknown>("files/create_folder_v2", {
      path: params.path,
      autorename: params.autorename ?? false,
    });
  }

  async delete(params: { path: string }) {
    return this.rpc<unknown>("files/delete_v2", { path: params.path });
  }

  async move(params: { from_path: string; to_path: string; autorename?: boolean }) {
    return this.rpc<unknown>("files/move_v2", {
      from_path: params.from_path,
      to_path: params.to_path,
      autorename: params.autorename ?? false,
    });
  }

  async copy(params: { from_path: string; to_path: string; autorename?: boolean }) {
    return this.rpc<unknown>("files/copy_v2", {
      from_path: params.from_path,
      to_path: params.to_path,
      autorename: params.autorename ?? false,
    });
  }

  // ── Sharing ────────────────────────────────────────────────────────────────

  async createSharedLink(params: { path: string; requested_visibility?: string }) {
    try {
      return await this.rpc<unknown>("sharing/create_shared_link_with_settings", {
        path: params.path,
        settings: {
          requested_visibility: { ".tag": params.requested_visibility ?? "public" },
        },
      });
    } catch (err) {
      // If link already exists, fetch existing
      if (err instanceof Error && err.message.includes("shared_link_already_exists")) {
        const result = await this.rpc<{ links: unknown[] }>(
          "sharing/list_shared_links",
          { path: params.path, direct_only: true }
        );
        return result.links?.[0] ?? result;
      }
      throw err;
    }
  }

  async listSharedLinks(params: { path?: string }) {
    const body: Record<string, unknown> = { direct_only: false };
    if (params.path) body.path = params.path;
    const result = await this.rpc<{ links: unknown[] }>("sharing/list_shared_links", body);
    return result.links ?? [];
  }

  // ── Account ────────────────────────────────────────────────────────────────

  async getCurrentAccount() {
    return this.rpc<unknown>("users/get_current_account", null);
  }

  async getSpaceUsage() {
    return this.rpc<unknown>("users/get_space_usage", null);
  }
}
