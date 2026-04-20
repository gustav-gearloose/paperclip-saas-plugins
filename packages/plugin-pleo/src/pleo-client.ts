// Pleo Expense Management API v0
// OAuth2 client credentials flow — no refresh token; access token expires in 1 hour.
// Token endpoint: https://external.pleo.io/v0/auth/headless/token
// Base URL: https://external.pleo.io/v0

const TOKEN_URL = "https://external.pleo.io/v0/auth/headless/token";
const BASE = "https://external.pleo.io/v0";

export class PleoClient {
  private accessToken = "";
  private tokenExpiry = 0;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  private async ensureToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60_000) return;

    const resp = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        grantType: "client_credentials",
      }),
    });

    if (!resp.ok) {
      throw new Error(`Pleo token request failed: ${resp.status} ${await resp.text()}`);
    }

    const data = await resp.json() as { data?: { accessToken: string; expiresIn: number } };
    const token = data.data;
    if (!token) throw new Error("Pleo token response missing data field");
    this.accessToken = token.accessToken;
    this.tokenExpiry = Date.now() + token.expiresIn * 1000;
  }

  private async req<T>(path: string, opts: RequestInit = {}): Promise<T> {
    await this.ensureToken();
    const resp = await fetch(`${BASE}${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...opts.headers,
      },
    });
    if (!resp.ok) {
      throw new Error(`Pleo API error ${resp.status}: ${await resp.text()}`);
    }
    return resp.json() as Promise<T>;
  }

  // Company
  getCompany() {
    return this.req(`/companies/me`);
  }

  // Expenses
  listExpenses(limit = 50, offset = 0, status?: string) {
    const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (status) q.set("status", status);
    return this.req(`/expenses?${q}`);
  }
  getExpense(id: string) {
    return this.req(`/expenses/${id}`);
  }

  // Export (pocket = expense pocket)
  listPockets(limit = 50, offset = 0) {
    const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    return this.req(`/pockets?${q}`);
  }

  // Cards
  listCards(limit = 50, offset = 0) {
    const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    return this.req(`/cards?${q}`);
  }
  getCard(id: string) {
    return this.req(`/cards/${id}`);
  }

  // Users (employees)
  listUsers(limit = 50, offset = 0) {
    const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    return this.req(`/users?${q}`);
  }
  getUser(id: string) {
    return this.req(`/users/${id}`);
  }

  // Tags (expense categories)
  listTags() {
    return this.req(`/tags`);
  }

  // Teams
  listTeams(limit = 50, offset = 0) {
    const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    return this.req(`/teams?${q}`);
  }

  // Accounting entries
  listAccountingEntries(limit = 50, offset = 0) {
    const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    return this.req(`/accounting-entries?${q}`);
  }
}
