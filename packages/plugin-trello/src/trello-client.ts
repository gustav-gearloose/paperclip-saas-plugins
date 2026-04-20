const BASE = "https://api.trello.com/1";

export class TrelloClient {
  private apiKey: string;
  private apiToken: string;

  constructor(params: { apiKey: string; apiToken: string }) {
    this.apiKey = params.apiKey;
    this.apiToken = params.apiToken;
  }

  private auth(): string {
    return `key=${encodeURIComponent(this.apiKey)}&token=${encodeURIComponent(this.apiToken)}`;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${BASE}${path}${sep}${this.auth()}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Trello API error ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async listBoards(filter = "open"): Promise<unknown> {
    return this.request(`/members/me/boards?filter=${encodeURIComponent(filter)}&fields=id,name,desc,url,closed,starred`);
  }

  async getBoard(boardId: string): Promise<unknown> {
    return this.request(`/boards/${boardId}?fields=id,name,desc,url,closed,starred,prefs`);
  }

  async listLists(boardId: string): Promise<unknown> {
    return this.request(`/boards/${boardId}/lists?fields=id,name,closed,pos`);
  }

  async listCards(boardId: string, listId?: string): Promise<unknown> {
    if (listId) {
      return this.request(`/lists/${listId}/cards?fields=id,name,desc,due,dueComplete,closed,url,idList,idBoard`);
    }
    return this.request(`/boards/${boardId}/cards?fields=id,name,desc,due,dueComplete,closed,url,idList`);
  }

  async getCard(cardId: string): Promise<unknown> {
    return this.request(`/cards/${cardId}?fields=id,name,desc,due,dueComplete,closed,url,idList,idBoard,idMembers&checklists=all&members=true`);
  }

  async createCard(params: {
    listId: string;
    name: string;
    desc?: string;
    due?: string;
    pos?: string;
  }): Promise<unknown> {
    const body: Record<string, string> = {
      idList: params.listId,
      name: params.name,
      pos: params.pos ?? "bottom",
    };
    if (params.desc) body.desc = params.desc;
    if (params.due) body.due = params.due;
    return this.request("/cards", { method: "POST", body: JSON.stringify(body) });
  }

  async updateCard(cardId: string, data: Record<string, unknown>): Promise<unknown> {
    const mapped: Record<string, unknown> = {};
    if (data.name !== undefined) mapped.name = data.name;
    if (data.desc !== undefined) mapped.desc = data.desc;
    if (data.list_id !== undefined) mapped.idList = data.list_id;
    if (data.due !== undefined) mapped.due = data.due;
    if (data.closed !== undefined) mapped.closed = data.closed;
    return this.request(`/cards/${cardId}`, { method: "PUT", body: JSON.stringify(mapped) });
  }

  async addComment(cardId: string, text: string): Promise<unknown> {
    return this.request(`/cards/${cardId}/actions/comments`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  }

  async listMembers(boardId: string): Promise<unknown> {
    return this.request(`/boards/${boardId}/members?fields=id,username,fullName,avatarUrl`);
  }

  async search(query: string, modelTypes = "cards,boards", cardsLimit = 10): Promise<unknown> {
    const params = new URLSearchParams({
      query,
      modelTypes,
      cards_limit: String(cardsLimit),
      card_fields: "id,name,desc,due,url,idList,idBoard",
      board_fields: "id,name,url",
    });
    return this.request(`/search?${params.toString()}`);
  }
}
