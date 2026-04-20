export class SalesforceClient {
  private instanceUrl: string;
  private accessToken: string;
  private refreshToken: string;
  private clientId: string;
  private clientSecret: string;

  constructor(params: {
    instanceUrl: string;
    accessToken: string;
    refreshToken: string;
    clientId: string;
    clientSecret: string;
  }) {
    this.instanceUrl = params.instanceUrl.replace(/\/$/, "");
    this.accessToken = params.accessToken;
    this.refreshToken = params.refreshToken;
    this.clientId = params.clientId;
    this.clientSecret = params.clientSecret;
  }

  private async refreshAccessToken(): Promise<void> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken,
    });
    const resp = await fetch(`${this.instanceUrl}/services/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Salesforce token refresh failed: ${resp.status} ${text}`);
    }
    const data = await resp.json() as { access_token: string; instance_url?: string };
    this.accessToken = data.access_token;
    if (data.instance_url) {
      this.instanceUrl = data.instance_url.replace(/\/$/, "");
    }
  }

  private async request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
    const url = path.startsWith("http") ? path : `${this.instanceUrl}${path}`;
    const resp = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(options.headers as Record<string, string> ?? {}),
      },
    });
    if (resp.status === 401 && retry) {
      await this.refreshAccessToken();
      return this.request<T>(path, options, false);
    }
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Salesforce API error ${resp.status}: ${text}`);
    }
    if (resp.status === 204) return {} as T;
    return resp.json() as Promise<T>;
  }

  private async query<T>(soql: string): Promise<T> {
    const encoded = encodeURIComponent(soql);
    return this.request<T>(`/services/data/v59.0/query?q=${encoded}`);
  }

  private async sobjectGet(sobject: string, id: string, fields?: string): Promise<unknown> {
    const qs = fields ? `?fields=${encodeURIComponent(fields)}` : "";
    return this.request(`/services/data/v59.0/sobjects/${sobject}/${id}${qs}`);
  }

  private async sobjectCreate(sobject: string, body: Record<string, unknown>): Promise<unknown> {
    return this.request(`/services/data/v59.0/sobjects/${sobject}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  private async sobjectUpdate(sobject: string, id: string, body: Record<string, unknown>): Promise<unknown> {
    await this.request(`/services/data/v59.0/sobjects/${sobject}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return { id, updated: true };
  }

  async listContacts(params: { limit?: number; search?: string }): Promise<unknown> {
    const limit = params.limit ?? 50;
    let soql = `SELECT Id, FirstName, LastName, Email, Phone, Title, AccountId, Account.Name FROM Contact`;
    if (params.search) soql += ` WHERE Name LIKE '%${params.search.replace(/'/g, "\\'")}%'`;
    soql += ` ORDER BY LastName ASC LIMIT ${limit}`;
    return this.query(soql);
  }

  async getContact(id: string): Promise<unknown> {
    return this.sobjectGet("Contact", id, "Id,FirstName,LastName,Email,Phone,Title,Department,AccountId,Account.Name,OwnerId,CreatedDate,LastModifiedDate,Description");
  }

  async createContact(params: {
    firstName?: string;
    lastName: string;
    email?: string;
    phone?: string;
    title?: string;
    accountId?: string;
  }): Promise<unknown> {
    const body: Record<string, unknown> = { LastName: params.lastName };
    if (params.firstName) body["FirstName"] = params.firstName;
    if (params.email) body["Email"] = params.email;
    if (params.phone) body["Phone"] = params.phone;
    if (params.title) body["Title"] = params.title;
    if (params.accountId) body["AccountId"] = params.accountId;
    return this.sobjectCreate("Contact", body);
  }

  async listAccounts(params: { limit?: number; search?: string }): Promise<unknown> {
    const limit = params.limit ?? 50;
    let soql = `SELECT Id, Name, Industry, Phone, Website, BillingCity, BillingCountry, NumberOfEmployees, AnnualRevenue FROM Account`;
    if (params.search) soql += ` WHERE Name LIKE '%${params.search.replace(/'/g, "\\'")}%'`;
    soql += ` ORDER BY Name ASC LIMIT ${limit}`;
    return this.query(soql);
  }

  async getAccount(id: string): Promise<unknown> {
    return this.sobjectGet("Account", id, "Id,Name,Industry,Phone,Website,BillingStreet,BillingCity,BillingCountry,NumberOfEmployees,AnnualRevenue,OwnerId,Description,CreatedDate");
  }

  async createAccount(params: {
    name: string;
    industry?: string;
    phone?: string;
    website?: string;
    billingCity?: string;
    billingCountry?: string;
  }): Promise<unknown> {
    const body: Record<string, unknown> = { Name: params.name };
    if (params.industry) body["Industry"] = params.industry;
    if (params.phone) body["Phone"] = params.phone;
    if (params.website) body["Website"] = params.website;
    if (params.billingCity) body["BillingCity"] = params.billingCity;
    if (params.billingCountry) body["BillingCountry"] = params.billingCountry;
    return this.sobjectCreate("Account", body);
  }

  async listOpportunities(params: { limit?: number; accountId?: string; stage?: string }): Promise<unknown> {
    const limit = params.limit ?? 50;
    let soql = `SELECT Id, Name, StageName, Amount, CloseDate, AccountId, Account.Name, OwnerId, Probability FROM Opportunity`;
    const wheres: string[] = [];
    if (params.accountId) wheres.push(`AccountId = '${params.accountId}'`);
    if (params.stage) wheres.push(`StageName = '${params.stage.replace(/'/g, "\\'")}'`);
    if (wheres.length) soql += ` WHERE ${wheres.join(" AND ")}`;
    soql += ` ORDER BY CloseDate ASC LIMIT ${limit}`;
    return this.query(soql);
  }

  async getOpportunity(id: string): Promise<unknown> {
    return this.sobjectGet("Opportunity", id, "Id,Name,StageName,Amount,CloseDate,AccountId,Account.Name,OwnerId,Probability,Description,LeadSource,CreatedDate,LastModifiedDate");
  }

  async createOpportunity(params: {
    name: string;
    stageName: string;
    closeDate: string;
    accountId?: string;
    amount?: number;
    probability?: number;
    description?: string;
  }): Promise<unknown> {
    const body: Record<string, unknown> = {
      Name: params.name,
      StageName: params.stageName,
      CloseDate: params.closeDate,
    };
    if (params.accountId) body["AccountId"] = params.accountId;
    if (params.amount !== undefined) body["Amount"] = params.amount;
    if (params.probability !== undefined) body["Probability"] = params.probability;
    if (params.description) body["Description"] = params.description;
    return this.sobjectCreate("Opportunity", body);
  }

  async updateOpportunity(id: string, data: Record<string, unknown>): Promise<unknown> {
    return this.sobjectUpdate("Opportunity", id, data);
  }

  async listLeads(params: { limit?: number; search?: string; status?: string }): Promise<unknown> {
    const limit = params.limit ?? 50;
    let soql = `SELECT Id, FirstName, LastName, Email, Company, Status, Phone, LeadSource FROM Lead`;
    const wheres: string[] = [];
    if (params.search) wheres.push(`Name LIKE '%${params.search.replace(/'/g, "\\'")}%'`);
    if (params.status) wheres.push(`Status = '${params.status.replace(/'/g, "\\'")}'`);
    if (wheres.length) soql += ` WHERE ${wheres.join(" AND ")}`;
    soql += ` ORDER BY LastName ASC LIMIT ${limit}`;
    return this.query(soql);
  }

  async createLead(params: {
    firstName?: string;
    lastName: string;
    company: string;
    email?: string;
    phone?: string;
    status?: string;
    leadSource?: string;
  }): Promise<unknown> {
    const body: Record<string, unknown> = {
      LastName: params.lastName,
      Company: params.company,
    };
    if (params.firstName) body["FirstName"] = params.firstName;
    if (params.email) body["Email"] = params.email;
    if (params.phone) body["Phone"] = params.phone;
    if (params.status) body["Status"] = params.status;
    if (params.leadSource) body["LeadSource"] = params.leadSource;
    return this.sobjectCreate("Lead", body);
  }

  async soqlQuery(soql: string): Promise<unknown> {
    return this.query(soql);
  }
}
