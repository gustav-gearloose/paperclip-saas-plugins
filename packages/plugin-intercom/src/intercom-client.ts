const BASE_URL = "https://api.intercom.io";
const INTERCOM_VERSION = "2.10";

export class IntercomClient {
  private headers: Record<string, string>;

  constructor(accessToken: string) {
    this.headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "Intercom-Version": INTERCOM_VERSION,
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: this.headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Intercom ${method} ${path} → ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async searchContacts(params: {
    email?: string;
    query?: string;
    limit?: number;
  }): Promise<unknown> {
    if (params.email) {
      return this.request("POST", "/contacts/search", {
        query: {
          field: "email",
          operator: "=",
          value: params.email,
        },
        pagination: { per_page: params.limit ?? 20 },
      });
    }
    return this.request("POST", "/contacts/search", {
      query: {
        operator: "OR",
        value: [
          { field: "name", operator: "~", value: params.query ?? "" },
          { field: "email", operator: "~", value: params.query ?? "" },
        ],
      },
      pagination: { per_page: params.limit ?? 20 },
    });
  }

  async getContact(contactId: string): Promise<unknown> {
    return this.request("GET", `/contacts/${contactId}`);
  }

  async createContact(params: {
    email: string;
    name?: string;
    phone?: string;
    role?: string;
    custom_attributes?: Record<string, unknown>;
  }): Promise<unknown> {
    return this.request("POST", "/contacts", {
      email: params.email,
      name: params.name,
      phone: params.phone,
      role: params.role ?? "lead",
      custom_attributes: params.custom_attributes,
    });
  }

  async listConversations(params: {
    status?: string;
    assignee_id?: string;
    limit?: number;
  }): Promise<unknown> {
    const qs = new URLSearchParams();
    if (params.status && params.status !== "all") {
      qs.set("state", params.status);
    }
    if (params.assignee_id) qs.set("assignee_id", params.assignee_id);
    qs.set("per_page", String(params.limit ?? 20));
    const query = qs.toString() ? `?${qs}` : "";
    return this.request("GET", `/conversations${query}`);
  }

  async getConversation(conversationId: string): Promise<unknown> {
    return this.request("GET", `/conversations/${conversationId}`);
  }

  async replyToConversation(params: {
    conversation_id: string;
    message: string;
    admin_id: string;
  }): Promise<unknown> {
    return this.request(
      "POST",
      `/conversations/${params.conversation_id}/reply`,
      {
        message_type: "comment",
        type: "admin",
        admin_id: params.admin_id,
        body: params.message,
      }
    );
  }

  async closeConversation(params: {
    conversation_id: string;
    admin_id: string;
  }): Promise<unknown> {
    return this.request(
      "POST",
      `/conversations/${params.conversation_id}/parts`,
      {
        message_type: "close",
        type: "admin",
        admin_id: params.admin_id,
      }
    );
  }

  async createNote(params: {
    conversation_id: string;
    note: string;
    admin_id: string;
  }): Promise<unknown> {
    return this.request(
      "POST",
      `/conversations/${params.conversation_id}/reply`,
      {
        message_type: "note",
        type: "admin",
        admin_id: params.admin_id,
        body: params.note,
      }
    );
  }

  async listAdmins(): Promise<unknown> {
    return this.request("GET", "/admins");
  }

  async createConversation(params: {
    from_admin_id: string;
    to_contact_id: string;
    message: string;
    subject?: string;
  }): Promise<unknown> {
    return this.request("POST", "/conversations", {
      from: { type: "admin", id: params.from_admin_id },
      to: { type: "contact", id: params.to_contact_id },
      subject: params.subject,
      body: params.message,
    });
  }
}
