const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

interface NotionResponse {
  object: string;
  [key: string]: unknown;
}

export class NotionClient {
  private token: string;

  constructor(integrationToken: string) {
    this.token = integrationToken;
  }

  private async get(path: string, params?: Record<string, string>): Promise<NotionResponse> {
    const url = new URL(`${NOTION_API}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    }
    const resp = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Notion-Version": NOTION_VERSION,
      },
    });
    const data = (await resp.json()) as NotionResponse;
    if (!resp.ok) throw new Error(`Notion API error: ${JSON.stringify(data)}`);
    return data;
  }

  private async post(path: string, body: unknown): Promise<NotionResponse> {
    const resp = await fetch(`${NOTION_API}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = (await resp.json()) as NotionResponse;
    if (!resp.ok) throw new Error(`Notion API error: ${JSON.stringify(data)}`);
    return data;
  }

  private async patch(path: string, body: unknown): Promise<NotionResponse> {
    const resp = await fetch(`${NOTION_API}${path}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = (await resp.json()) as NotionResponse;
    if (!resp.ok) throw new Error(`Notion API error: ${JSON.stringify(data)}`);
    return data;
  }

  async search(query: string, filterType?: "page" | "database", pageSize = 20): Promise<NotionResponse> {
    const body: Record<string, unknown> = { query, page_size: pageSize };
    if (filterType) body.filter = { value: filterType, property: "object" };
    return this.post("/search", body);
  }

  async getPage(pageId: string): Promise<NotionResponse> {
    return this.get(`/pages/${pageId}`);
  }

  async getPageBlocks(pageId: string, pageSize = 50): Promise<NotionResponse> {
    return this.get(`/blocks/${pageId}/children`, { page_size: String(pageSize) });
  }

  async createPage(parentId: string, title: string, content?: string): Promise<NotionResponse> {
    const body: Record<string, unknown> = {
      parent: { page_id: parentId },
      properties: {
        title: {
          title: [{ type: "text", text: { content: title } }],
        },
      },
    };
    if (content) {
      body.children = [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content } }],
          },
        },
      ];
    }
    return this.post("/pages", body);
  }

  async updatePageTitle(pageId: string, title: string): Promise<NotionResponse> {
    return this.patch(`/pages/${pageId}`, {
      properties: {
        title: {
          title: [{ type: "text", text: { content: title } }],
        },
      },
    });
  }

  async appendBlocks(blockId: string, text: string): Promise<NotionResponse> {
    return this.patch(`/blocks/${blockId}/children`, {
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: text } }],
          },
        },
      ],
    });
  }

  async queryDatabase(databaseId: string, filter?: unknown, sorts?: unknown[], pageSize = 20): Promise<NotionResponse> {
    const body: Record<string, unknown> = { page_size: pageSize };
    if (filter) body.filter = filter;
    if (sorts) body.sorts = sorts;
    return this.post(`/databases/${databaseId}/query`, body);
  }

  async getDatabase(databaseId: string): Promise<NotionResponse> {
    return this.get(`/databases/${databaseId}`);
  }

  async createDatabasePage(databaseId: string, properties: unknown): Promise<NotionResponse> {
    return this.post("/pages", {
      parent: { database_id: databaseId },
      properties,
    });
  }
}
