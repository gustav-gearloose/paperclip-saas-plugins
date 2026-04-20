const BASE = "https://api.airtable.com/v0";

export class AirtableClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Airtable API error ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async listBases(): Promise<unknown> {
    return this.request("/meta/bases");
  }

  async listTables(baseId: string): Promise<unknown> {
    return this.request(`/meta/bases/${baseId}/tables`);
  }

  async listRecords(baseId: string, tableName: string, params: {
    filterFormula?: string;
    maxRecords?: number;
    view?: string;
  }): Promise<unknown> {
    const qs = new URLSearchParams();
    if (params.filterFormula) qs.set("filterByFormula", params.filterFormula);
    if (params.maxRecords) qs.set("maxRecords", String(params.maxRecords));
    if (params.view) qs.set("view", params.view);
    const query = qs.toString();
    return this.request(`/${baseId}/${encodeURIComponent(tableName)}${query ? "?" + query : ""}`);
  }

  async getRecord(baseId: string, tableName: string, recordId: string): Promise<unknown> {
    return this.request(`/${baseId}/${encodeURIComponent(tableName)}/${recordId}`);
  }

  async createRecord(baseId: string, tableName: string, fields: Record<string, unknown>): Promise<unknown> {
    return this.request(`/${baseId}/${encodeURIComponent(tableName)}`, {
      method: "POST",
      body: JSON.stringify({ fields }),
    });
  }

  async updateRecord(baseId: string, tableName: string, recordId: string, fields: Record<string, unknown>): Promise<unknown> {
    return this.request(`/${baseId}/${encodeURIComponent(tableName)}/${recordId}`, {
      method: "PATCH",
      body: JSON.stringify({ fields }),
    });
  }

  async deleteRecord(baseId: string, tableName: string, recordId: string): Promise<unknown> {
    return this.request(`/${baseId}/${encodeURIComponent(tableName)}/${recordId}`, {
      method: "DELETE",
    });
  }

  async searchRecords(baseId: string, tableName: string, searchField: string, searchValue: string, maxRecords: number): Promise<unknown> {
    const formula = `FIND("${searchValue.replace(/"/g, '\\"')}",{${searchField}})`;
    return this.listRecords(baseId, tableName, { filterFormula: formula, maxRecords });
  }
}
