/**
 * Minimal HubSpot CRM v3 REST client.
 * Auth: Authorization: Bearer <private-app-token>
 * Base: https://api.hubapi.com
 */

const BASE = "https://api.hubapi.com";

interface HubSpotPage {
  results: unknown[];
  paging?: { next?: { after: string } };
}

interface SearchBody {
  filterGroups?: Array<{ filters: Array<{ propertyName: string; operator: string; value?: string }> }>;
  properties?: string[];
  sorts?: Array<{ propertyName: string; direction: "ASCENDING" | "DESCENDING" }>;
  limit?: number;
  after?: number | string;
  query?: string;
}

export class HubSpotClient {
  private headers: Record<string, string>;

  constructor(accessToken: string) {
    this.headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
  }

  private async get(path: string, params?: Record<string, string | number>): Promise<unknown> {
    const url = new URL(`${BASE}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, String(v));
      }
    }
    const resp = await fetch(url.toString(), { headers: this.headers });
    if (!resp.ok) throw new Error(`HubSpot API ${resp.status} GET ${path}: ${await resp.text()}`);
    return resp.json();
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const resp = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`HubSpot API ${resp.status} POST ${path}: ${await resp.text()}`);
    return resp.json();
  }

  async searchContacts(opts: {
    query?: string;
    email?: string;
    properties?: string[];
    limit?: number;
    after?: string;
  }): Promise<HubSpotPage> {
    const body: SearchBody = {
      properties: opts.properties ?? ["firstname", "lastname", "email", "phone", "company", "jobtitle"],
      limit: opts.limit ?? 20,
    };
    if (opts.after) body.after = opts.after;
    if (opts.query) body.query = opts.query;
    if (opts.email) {
      body.filterGroups = [{ filters: [{ propertyName: "email", operator: "EQ", value: opts.email }] }];
    }
    return this.post("/crm/v3/objects/contacts/search", body) as Promise<HubSpotPage>;
  }

  async getContact(id: string, properties?: string[]): Promise<unknown> {
    const props = (properties ?? ["firstname", "lastname", "email", "phone", "company", "jobtitle", "createdate", "lastmodifieddate"]).join(",");
    return this.get(`/crm/v3/objects/contacts/${id}`, { properties: props });
  }

  async listCompanies(opts?: { limit?: number; after?: string; properties?: string[] }): Promise<HubSpotPage> {
    const params: Record<string, string | number> = {
      limit: opts?.limit ?? 20,
      properties: (opts?.properties ?? ["name", "domain", "industry", "city", "country", "phone"]).join(","),
    };
    if (opts?.after) params.after = opts.after;
    return this.get("/crm/v3/objects/companies", params) as Promise<HubSpotPage>;
  }

  async searchCompanies(opts: { query?: string; name?: string; limit?: number }): Promise<HubSpotPage> {
    const body: SearchBody = {
      properties: ["name", "domain", "industry", "city", "country", "phone", "numberofemployees"],
      limit: opts.limit ?? 20,
    };
    if (opts.query) body.query = opts.query;
    if (opts.name) {
      body.filterGroups = [{ filters: [{ propertyName: "name", operator: "CONTAINS_TOKEN", value: opts.name }] }];
    }
    return this.post("/crm/v3/objects/companies/search", body) as Promise<HubSpotPage>;
  }

  async getCompany(id: string): Promise<unknown> {
    return this.get(`/crm/v3/objects/companies/${id}`, {
      properties: "name,domain,industry,city,country,phone,numberofemployees,annualrevenue",
    });
  }

  async listDeals(opts?: { limit?: number; after?: string; properties?: string[] }): Promise<HubSpotPage> {
    const params: Record<string, string | number> = {
      limit: opts?.limit ?? 20,
      properties: (opts?.properties ?? ["dealname", "amount", "dealstage", "closedate", "pipeline"]).join(","),
    };
    if (opts?.after) params.after = opts.after;
    return this.get("/crm/v3/objects/deals", params) as Promise<HubSpotPage>;
  }

  async searchDeals(opts: { query?: string; stage?: string; limit?: number }): Promise<HubSpotPage> {
    const body: SearchBody = {
      properties: ["dealname", "amount", "dealstage", "closedate", "pipeline", "hubspot_owner_id"],
      limit: opts.limit ?? 20,
      sorts: [{ propertyName: "closedate", direction: "DESCENDING" }],
    };
    if (opts.query) body.query = opts.query;
    if (opts.stage) {
      body.filterGroups = [{ filters: [{ propertyName: "dealstage", operator: "EQ", value: opts.stage }] }];
    }
    return this.post("/crm/v3/objects/deals/search", body) as Promise<HubSpotPage>;
  }

  async getDeal(id: string): Promise<unknown> {
    return this.get(`/crm/v3/objects/deals/${id}`, {
      properties: "dealname,amount,dealstage,closedate,pipeline,hubspot_owner_id,description",
    });
  }

  async listNotes(opts?: { limit?: number; after?: string }): Promise<HubSpotPage> {
    const params: Record<string, string | number> = {
      limit: opts?.limit ?? 20,
      properties: "hs_note_body,hs_timestamp,hubspot_owner_id",
    };
    if (opts?.after) params.after = opts.after;
    return this.get("/crm/v3/objects/notes", params) as Promise<HubSpotPage>;
  }

  async createNote(opts: { body: string; contactId?: string; dealId?: string; companyId?: string }): Promise<unknown> {
    const note = await this.post("/crm/v3/objects/notes", {
      properties: {
        hs_note_body: opts.body,
        hs_timestamp: new Date().toISOString(),
      },
    }) as { id: string };

    // Associate with CRM objects if provided
    const assocPromises: Promise<unknown>[] = [];
    if (opts.contactId) {
      assocPromises.push(this.post(
        `/crm/v3/objects/notes/${note.id}/associations/contacts/${opts.contactId}/202`, {}
      ));
    }
    if (opts.dealId) {
      assocPromises.push(this.post(
        `/crm/v3/objects/notes/${note.id}/associations/deals/${opts.dealId}/214`, {}
      ));
    }
    if (opts.companyId) {
      assocPromises.push(this.post(
        `/crm/v3/objects/notes/${note.id}/associations/companies/${opts.companyId}/190`, {}
      ));
    }
    if (assocPromises.length > 0) await Promise.allSettled(assocPromises);

    return note;
  }

  async createContact(opts: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    company?: string;
    jobTitle?: string;
  }): Promise<unknown> {
    const properties: Record<string, string> = {};
    if (opts.email) properties["email"] = opts.email;
    if (opts.firstName) properties["firstname"] = opts.firstName;
    if (opts.lastName) properties["lastname"] = opts.lastName;
    if (opts.phone) properties["phone"] = opts.phone;
    if (opts.company) properties["company"] = opts.company;
    if (opts.jobTitle) properties["jobtitle"] = opts.jobTitle;
    return this.post("/crm/v3/objects/contacts", { properties });
  }

  async createDeal(opts: {
    name: string;
    stage?: string;
    amount?: number;
    closeDate?: string;
    pipeline?: string;
    contactId?: string;
    companyId?: string;
  }): Promise<unknown> {
    const properties: Record<string, string> = {
      dealname: opts.name,
      dealstage: opts.stage ?? "appointmentscheduled",
      pipeline: opts.pipeline ?? "default",
    };
    if (opts.amount !== undefined) properties["amount"] = String(opts.amount);
    if (opts.closeDate) properties["closedate"] = opts.closeDate;

    const deal = await this.post("/crm/v3/objects/deals", { properties }) as { id: string };

    const assocPromises: Promise<unknown>[] = [];
    if (opts.contactId) {
      assocPromises.push(this.post(
        `/crm/v3/objects/deals/${deal.id}/associations/contacts/${opts.contactId}/3`, {}
      ));
    }
    if (opts.companyId) {
      assocPromises.push(this.post(
        `/crm/v3/objects/deals/${deal.id}/associations/companies/${opts.companyId}/5`, {}
      ));
    }
    if (assocPromises.length > 0) await Promise.allSettled(assocPromises);

    return deal;
  }
}
