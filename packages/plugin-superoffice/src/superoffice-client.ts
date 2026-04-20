// SuperOffice Online REST WebAPI v1
// OAuth2 with refresh token rotation. tenantId = e.g. "Cust12345".
// All REST calls: https://online.superoffice.com/<tenantId>/api/v1/...

const TOKEN_URL = "https://online.superoffice.com/login/common/oauth/tokens";

export class SuperOfficeClient {
  private accessToken = "";
  private tokenExpiry = 0;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private refreshToken: string,
    private readonly tenantId: string,
  ) {}

  private get base(): string {
    return `https://online.superoffice.com/${this.tenantId}/api/v1`;
  }

  private async ensureToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60_000) return;

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken,
    });

    const resp = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!resp.ok) {
      throw new Error(`SuperOffice token refresh failed: ${resp.status} ${await resp.text()}`);
    }

    const data = await resp.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;
    if (data.refresh_token) this.refreshToken = data.refresh_token;
  }

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    await this.ensureToken();
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    const resp = await fetch(`${this.base}${path}${qs}`, {
      headers: { Authorization: `Bearer ${this.accessToken}`, Accept: "application/json" },
    });
    if (!resp.ok) {
      throw new Error(`SuperOffice GET ${path} → ${resp.status}: ${await resp.text()}`);
    }
    return resp.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    await this.ensureToken();
    const resp = await fetch(`${this.base}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      throw new Error(`SuperOffice POST ${path} → ${resp.status}: ${await resp.text()}`);
    }
    return resp.json() as Promise<T>;
  }

  // ── Contacts (companies) ────────────────────────────────────────────────────

  async listContacts(top = 25, skip = 0): Promise<unknown> {
    return this.get("/Contact", { $top: String(top), $skip: String(skip) });
  }

  async getContact(id: string): Promise<unknown> {
    return this.get(`/Contact/${id}`);
  }

  async createContact(params: {
    Name: string;
    Department?: string;
    Phone?: string;
    Email?: string;
  }): Promise<unknown> {
    return this.post("/Contact", params);
  }

  // ── Persons ─────────────────────────────────────────────────────────────────

  async listPersons(top = 25, skip = 0): Promise<unknown> {
    return this.get("/Person", { $top: String(top), $skip: String(skip) });
  }

  async getPerson(id: string): Promise<unknown> {
    return this.get(`/Person/${id}`);
  }

  async createPerson(params: {
    Firstname: string;
    Lastname: string;
    ContactId?: number;
    Email?: string;
    Phone?: string;
    Title?: string;
  }): Promise<unknown> {
    return this.post("/Person", params);
  }

  // ── Sales ───────────────────────────────────────────────────────────────────

  async listSales(top = 25, skip = 0): Promise<unknown> {
    return this.get("/Sale", { $top: String(top), $skip: String(skip) });
  }

  async getSale(id: string): Promise<unknown> {
    return this.get(`/Sale/${id}`);
  }

  async createSale(params: {
    Heading: string;
    ContactId?: number;
    Amount?: number;
    SaleDate?: string;
    Status?: string;
    Description?: string;
  }): Promise<unknown> {
    return this.post("/Sale", params);
  }

  // ── Appointments ────────────────────────────────────────────────────────────

  async listAppointments(top = 25, skip = 0): Promise<unknown> {
    return this.get("/Appointment", { $top: String(top), $skip: String(skip) });
  }

  async getAppointment(id: string): Promise<unknown> {
    return this.get(`/Appointment/${id}`);
  }

  async createAppointment(params: {
    ContactId?: number;
    AppointmentText?: string;
    StartDate?: string;
    EndDate?: string;
  }): Promise<unknown> {
    return this.post("/Appointment", params);
  }

  // ── Projects ─────────────────────────────────────────────────────────────────

  async listProjects(top = 25, skip = 0): Promise<unknown> {
    return this.get("/Project", { $top: String(top), $skip: String(skip) });
  }

  async getProject(id: string): Promise<unknown> {
    return this.get(`/Project/${id}`);
  }

  // ── Current user ────────────────────────────────────────────────────────────

  async getCurrentUser(): Promise<unknown> {
    return this.get("/User/currentPrincipal");
  }
}
