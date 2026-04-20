const MONDAY_API_URL = "https://api.monday.com/v2";

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

export class MondayClient {
  private headers: Record<string, string>;

  constructor(apiToken: string) {
    this.headers = {
      Authorization: apiToken,
      "Content-Type": "application/json",
      "API-Version": "2024-01",
    };
  }

  private async query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const res = await fetch(MONDAY_API_URL, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`monday.com API error: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as GraphQLResponse<T>;
    if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
    return json.data as T;
  }

  async listBoards(params: { limit?: number; page?: number; workspace_ids?: number[] }): Promise<unknown> {
    const { limit = 25, page = 1, workspace_ids } = params;
    const wsFilter = workspace_ids?.length ? `workspace_ids: [${workspace_ids.join(",")}],` : "";
    return this.query(`
      query {
        boards(limit: ${limit}, page: ${page}, ${wsFilter} order_by: created_at) {
          id name description state board_kind type
          workspace { id name }
          owner { id name email }
        }
      }
    `);
  }

  async getBoard(id: number): Promise<unknown> {
    return this.query(`
      query {
        boards(ids: [${id}]) {
          id name description state board_kind type
          workspace { id name }
          owner { id name email }
          groups { id title color }
          columns { id title type settings_str }
        }
      }
    `);
  }

  async listItems(boardId: number, params: { limit?: number; page?: number }): Promise<unknown> {
    const { limit = 25, page = 1 } = params;
    return this.query(`
      query {
        boards(ids: [${boardId}]) {
          items_page(limit: ${limit}, cursor: null) {
            cursor
            items {
              id name state
              group { id title }
              created_at updated_at
              column_values { id text value }
            }
          }
        }
      }
    `);
  }

  async getItem(id: number): Promise<unknown> {
    return this.query(`
      query {
        items(ids: [${id}]) {
          id name state
          board { id name }
          group { id title }
          created_at updated_at
          column_values { id title text value type }
          subitems { id name state }
          updates(limit: 5) { id body created_at creator { id name } }
        }
      }
    `);
  }

  async searchItems(boardId: number, query: string): Promise<unknown> {
    return this.query(`
      query {
        items_by_multiple_column_values(
          board_id: ${boardId},
          column_id: "name",
          column_values: ["${query.replace(/"/g, '\\"')}"]
          limit: 25
        ) {
          id name state
          group { id title }
          column_values { id text value }
        }
      }
    `);
  }

  async createItem(params: { boardId: number; groupId?: string; name: string; columnValues?: Record<string, unknown> }): Promise<unknown> {
    const { boardId, groupId, name, columnValues } = params;
    const groupArg = groupId ? `, group_id: "${groupId}"` : "";
    const colArg = columnValues ? `, column_values: "${JSON.stringify(columnValues).replace(/"/g, '\\"')}"` : "";
    return this.query(`
      mutation {
        create_item(board_id: ${boardId}, item_name: "${name.replace(/"/g, '\\"')}"${groupArg}${colArg}) {
          id name state
          group { id title }
        }
      }
    `);
  }

  async updateItemName(itemId: number, name: string): Promise<unknown> {
    return this.query(`
      mutation {
        change_simple_column_value(
          item_id: ${itemId},
          board_id: 0,
          column_id: "name",
          value: "${name.replace(/"/g, '\\"')}"
        ) { id name }
      }
    `);
  }

  async changeColumnValue(params: { itemId: number; boardId: number; columnId: string; value: string }): Promise<unknown> {
    const { itemId, boardId, columnId, value } = params;
    return this.query(`
      mutation {
        change_simple_column_value(
          item_id: ${itemId},
          board_id: ${boardId},
          column_id: "${columnId}",
          value: "${value.replace(/"/g, '\\"')}"
        ) { id name }
      }
    `);
  }

  async addUpdate(itemId: number, body: string): Promise<unknown> {
    return this.query(`
      mutation {
        create_update(item_id: ${itemId}, body: "${body.replace(/"/g, '\\"')}") {
          id body created_at
          creator { id name }
        }
      }
    `);
  }

  async listWorkspaces(): Promise<unknown> {
    return this.query(`
      query {
        workspaces {
          id name kind description
        }
      }
    `);
  }

  async getUsers(params: { limit?: number }): Promise<unknown> {
    const { limit = 50 } = params;
    return this.query(`
      query {
        users(limit: ${limit}) {
          id name email title
          enabled is_admin is_guest
          teams { id name }
        }
      }
    `);
  }
}
