const BASE = "https://a.klaviyo.com/api";

export class KlaviyoClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Klaviyo-API-Key ${this.apiKey}`,
        "Content-Type": "application/json",
        revision: "2024-02-15",
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Klaviyo API error ${res.status}: ${text}`);
    }
    if (res.status === 204) return {} as T;
    return res.json() as Promise<T>;
  }

  private buildQs(params: Record<string, unknown>): string {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) qs.set(k, String(v));
    }
    const s = qs.toString();
    return s ? "?" + s : "";
  }

  async getProfiles(params: { "page[size]"?: number; "page[cursor]"?: string; filter?: string }): Promise<unknown> {
    return this.request(`/profiles/${this.buildQs(params as Record<string, unknown>)}`);
  }

  async getProfile(profileId: string): Promise<unknown> {
    return this.request(`/profiles/${profileId}/`);
  }

  async createProfile(data: {
    email?: string;
    phone_number?: string;
    first_name?: string;
    last_name?: string;
    properties?: Record<string, unknown>;
  }): Promise<unknown> {
    return this.request("/profiles/", {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "profile",
          attributes: data,
        },
      }),
    });
  }

  async updateProfile(profileId: string, data: {
    email?: string;
    phone_number?: string;
    first_name?: string;
    last_name?: string;
    properties?: Record<string, unknown>;
  }): Promise<unknown> {
    return this.request(`/profiles/${profileId}/`, {
      method: "PATCH",
      body: JSON.stringify({
        data: {
          type: "profile",
          id: profileId,
          attributes: data,
        },
      }),
    });
  }

  async getLists(params: { "page[size]"?: number; "page[cursor]"?: string }): Promise<unknown> {
    return this.request(`/lists/${this.buildQs(params as Record<string, unknown>)}`);
  }

  async getList(listId: string): Promise<unknown> {
    return this.request(`/lists/${listId}/`);
  }

  async createList(name: string): Promise<unknown> {
    return this.request("/lists/", {
      method: "POST",
      body: JSON.stringify({
        data: { type: "list", attributes: { name } },
      }),
    });
  }

  async addProfilesToList(listId: string, profileIds: string[]): Promise<unknown> {
    return this.request(`/lists/${listId}/relationships/profiles/`, {
      method: "POST",
      body: JSON.stringify({
        data: profileIds.map((id) => ({ type: "profile", id })),
      }),
    });
  }

  async removeProfilesFromList(listId: string, profileIds: string[]): Promise<unknown> {
    return this.request(`/lists/${listId}/relationships/profiles/`, {
      method: "DELETE",
      body: JSON.stringify({
        data: profileIds.map((id) => ({ type: "profile", id })),
      }),
    });
  }

  async getCampaigns(params: {
    "filter"?: string;
    "page[size]"?: number;
    "page[cursor]"?: string;
    "sort"?: string;
  }): Promise<unknown> {
    const qs = this.buildQs({
      filter: params.filter ?? "equals(messages.channel,'email')",
      "page[size]": params["page[size]"],
      "page[cursor]": params["page[cursor]"],
      sort: params.sort,
    } as Record<string, unknown>);
    return this.request(`/campaigns/${qs}`);
  }

  async getCampaign(campaignId: string): Promise<unknown> {
    return this.request(`/campaigns/${campaignId}/`);
  }

  async getFlows(params: { "page[size]"?: number; "page[cursor]"?: string; filter?: string }): Promise<unknown> {
    return this.request(`/flows/${this.buildQs(params as Record<string, unknown>)}`);
  }

  async getMetrics(params: { "page[size]"?: number; "page[cursor]"?: string }): Promise<unknown> {
    return this.request(`/metrics/${this.buildQs(params as Record<string, unknown>)}`);
  }

  async createEvent(data: {
    event_name: string;
    profile_email?: string;
    profile_id?: string;
    properties?: Record<string, unknown>;
    time?: string;
  }): Promise<unknown> {
    const profileData: Record<string, unknown> = {};
    if (data.profile_email) profileData["email"] = data.profile_email;
    if (data.profile_id) profileData["$id"] = data.profile_id;

    return this.request("/events/", {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "event",
          attributes: {
            metric: { data: { type: "metric", attributes: { name: data.event_name } } },
            profile: { data: { type: "profile", attributes: profileData } },
            properties: data.properties ?? {},
            time: data.time,
          },
        },
      }),
    });
  }

  async getSegments(params: { "page[size]"?: number; "page[cursor]"?: string }): Promise<unknown> {
    return this.request(`/segments/${this.buildQs(params as Record<string, unknown>)}`);
  }

  async getTemplates(params: { "page[size]"?: number; "page[cursor]"?: string }): Promise<unknown> {
    return this.request(`/templates/${this.buildQs(params as Record<string, unknown>)}`);
  }
}
