/**
 * Minimal Google Sheets v4 REST client using service account JWT auth.
 * No googleapis npm package — just fetch + crypto.
 */

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export interface SheetInfo {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
}

export class GoogleSheetsClient {
  private serviceAccount: ServiceAccountKey;
  private accessToken = "";
  private tokenExpiry = 0;

  constructor(serviceAccountJson: string) {
    this.serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccountKey;
    if (!this.serviceAccount.client_email || !this.serviceAccount.private_key) {
      throw new Error("Service account JSON must contain client_email and private_key");
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60_000) {
      return this.accessToken;
    }

    const now = Math.floor(Date.now() / 1000);
    const claim = {
      iss: this.serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: this.serviceAccount.token_uri ?? "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    const jwt = await this.signJwt(claim);

    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!resp.ok) {
      throw new Error(`Google OAuth token error: ${resp.status} ${await resp.text()}`);
    }

    const data = await resp.json() as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;
    return this.accessToken;
  }

  private async signJwt(payload: Record<string, unknown>): Promise<string> {
    const header = { alg: "RS256", typ: "JWT" };
    const encode = (obj: unknown) =>
      Buffer.from(JSON.stringify(obj)).toString("base64url");

    const signingInput = `${encode(header)}.${encode(payload)}`;

    // Node.js crypto for RSA-SHA256 signing
    const { createSign } = await import("crypto");
    const sign = createSign("RSA-SHA256");
    sign.update(signingInput);
    const signature = sign.sign(this.serviceAccount.private_key, "base64url");

    return `${signingInput}.${signature}`;
  }

  private async apiFetch(path: string, init?: RequestInit): Promise<unknown> {
    const token = await this.getAccessToken();
    const resp = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...((init?.headers as Record<string, string>) ?? {}),
      },
    });

    if (!resp.ok) {
      throw new Error(`Sheets API ${resp.status}: ${await resp.text()}`);
    }
    return resp.json();
  }

  async getSpreadsheetInfo(spreadsheetId: string): Promise<{
    spreadsheetId: string;
    title: string;
    sheets: SheetInfo[];
  }> {
    const data = await this.apiFetch(`/${spreadsheetId}?fields=spreadsheetId,properties.title,sheets.properties`) as {
      spreadsheetId: string;
      properties: { title: string };
      sheets: Array<{ properties: { sheetId: number; title: string; gridProperties: { rowCount: number; columnCount: number } } }>;
    };

    return {
      spreadsheetId: data.spreadsheetId,
      title: data.properties.title,
      sheets: data.sheets.map((s) => ({
        sheetId: s.properties.sheetId,
        title: s.properties.title,
        rowCount: s.properties.gridProperties.rowCount,
        columnCount: s.properties.gridProperties.columnCount,
      })),
    };
  }

  async readRange(spreadsheetId: string, range: string): Promise<{
    range: string;
    values: unknown[][];
    rowCount: number;
    columnCount: number;
  }> {
    const data = await this.apiFetch(
      `/${spreadsheetId}/values/${encodeURIComponent(range)}`
    ) as { range: string; values?: unknown[][] };

    const values = data.values ?? [];
    return {
      range: data.range,
      values,
      rowCount: values.length,
      columnCount: values.reduce((max, row) => Math.max(max, (row as unknown[]).length), 0),
    };
  }

  async writeRange(
    spreadsheetId: string,
    range: string,
    values: unknown[][]
  ): Promise<{ updatedRange: string; updatedRows: number; updatedCells: number }> {
    const data = await this.apiFetch(
      `/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        body: JSON.stringify({ range, values }),
      }
    ) as { updatedRange: string; updatedRows: number; updatedCells: number };

    return {
      updatedRange: data.updatedRange,
      updatedRows: data.updatedRows,
      updatedCells: data.updatedCells,
    };
  }

  async appendRows(
    spreadsheetId: string,
    range: string,
    values: unknown[][]
  ): Promise<{ updatedRange: string; updatedRows: number }> {
    const data = await this.apiFetch(
      `/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        body: JSON.stringify({ values }),
      }
    ) as { updates: { updatedRange: string; updatedRows: number } };

    return {
      updatedRange: data.updates.updatedRange,
      updatedRows: data.updates.updatedRows,
    };
  }

  async clearRange(
    spreadsheetId: string,
    range: string
  ): Promise<{ clearedRange: string }> {
    const data = await this.apiFetch(
      `/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`,
      { method: "POST", body: "{}" }
    ) as { clearedRange: string };

    return { clearedRange: data.clearedRange };
  }
}
