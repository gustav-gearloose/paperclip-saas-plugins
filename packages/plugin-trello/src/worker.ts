import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { TrelloClient } from "./trello-client.js";

interface TrelloPluginConfig {
  apiKeyRef?: string;
  apiTokenRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as TrelloPluginConfig;

    if (!config.apiKeyRef || !config.apiTokenRef) {
      ctx.logger.error("Trello plugin: apiKeyRef and apiTokenRef are required");
      return;
    }

    let apiKey: string;
    let apiToken: string;
    try {
      [apiKey, apiToken] = await Promise.all([
        ctx.secrets.resolve(config.apiKeyRef),
        ctx.secrets.resolve(config.apiTokenRef),
      ]);
    } catch (err) {
      ctx.logger.error(`Trello plugin: failed to resolve secrets: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    ctx.logger.info("Trello plugin: secrets resolved, registering tools");
    const client = new TrelloClient({ apiKey, apiToken });

    ctx.tools.register(
      "trello_list_boards",
      {
        displayName: "List Boards",
        description: "List all Trello boards the authenticated user has access to.",
        parametersSchema: {
          type: "object",
          properties: {
            filter: { type: "string", description: "Filter: all, open, closed, starred (default: open).", default: "open" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { filter } = params as { filter?: string };
        try {
          const result = await client.listBoards(filter ?? "open");
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "trello_get_board",
      {
        displayName: "Get Board",
        description: "Get details for a specific Trello board by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            board_id: { type: "string", description: "Trello board ID." },
          },
          required: ["board_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { board_id } = params as { board_id: string };
        try {
          const result = await client.getBoard(board_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "trello_list_lists",
      {
        displayName: "List Lists",
        description: "List all lists (columns) on a Trello board.",
        parametersSchema: {
          type: "object",
          properties: {
            board_id: { type: "string", description: "Trello board ID." },
          },
          required: ["board_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { board_id } = params as { board_id: string };
        try {
          const result = await client.listLists(board_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "trello_list_cards",
      {
        displayName: "List Cards",
        description: "List cards on a Trello board, optionally filtered by list.",
        parametersSchema: {
          type: "object",
          properties: {
            board_id: { type: "string", description: "Trello board ID." },
            list_id: { type: "string", description: "Optional: filter to only cards in this list." },
          },
          required: ["board_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { board_id, list_id } = params as { board_id: string; list_id?: string };
        try {
          const result = await client.listCards(board_id, list_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "trello_get_card",
      {
        displayName: "Get Card",
        description: "Get full details for a specific Trello card by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            card_id: { type: "string", description: "Trello card ID." },
          },
          required: ["card_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { card_id } = params as { card_id: string };
        try {
          const result = await client.getCard(card_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "trello_create_card",
      {
        displayName: "Create Card",
        description: "Create a new card in a Trello list.",
        parametersSchema: {
          type: "object",
          properties: {
            list_id: { type: "string", description: "ID of the list to add the card to." },
            name: { type: "string", description: "Card title." },
            desc: { type: "string", description: "Card description." },
            due: { type: "string", description: "Due date in ISO 8601 format." },
            pos: { type: "string", description: "Position: top, bottom, or a positive number.", default: "bottom" },
          },
          required: ["list_id", "name"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { list_id, name, desc, due, pos } = params as { list_id: string; name: string; desc?: string; due?: string; pos?: string };
        try {
          const result = await client.createCard({ listId: list_id, name, desc, due, pos });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "trello_update_card",
      {
        displayName: "Update Card",
        description: "Update a Trello card — move it, rename it, change due date, or archive it.",
        parametersSchema: {
          type: "object",
          properties: {
            card_id: { type: "string", description: "Trello card ID." },
            name: { type: "string", description: "New card title." },
            desc: { type: "string", description: "New card description." },
            list_id: { type: "string", description: "Move card to this list ID." },
            due: { type: "string", description: "New due date in ISO 8601 format." },
            closed: { type: "boolean", description: "Set true to archive the card." },
          },
          required: ["card_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { card_id, ...rest } = params as { card_id: string; name?: string; desc?: string; list_id?: string; due?: string; closed?: boolean };
        try {
          const result = await client.updateCard(card_id, rest);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "trello_add_comment",
      {
        displayName: "Add Comment",
        description: "Add a comment to a Trello card.",
        parametersSchema: {
          type: "object",
          properties: {
            card_id: { type: "string", description: "Trello card ID." },
            text: { type: "string", description: "Comment text." },
          },
          required: ["card_id", "text"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { card_id, text } = params as { card_id: string; text: string };
        try {
          const result = await client.addComment(card_id, text);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "trello_list_members",
      {
        displayName: "List Board Members",
        description: "List all members of a Trello board.",
        parametersSchema: {
          type: "object",
          properties: {
            board_id: { type: "string", description: "Trello board ID." },
          },
          required: ["board_id"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { board_id } = params as { board_id: string };
        try {
          const result = await client.listMembers(board_id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "trello_search",
      {
        displayName: "Search Trello",
        description: "Search for cards, boards, or members across Trello.",
        parametersSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query string." },
            model_types: { type: "string", description: "Comma-separated types: cards, boards, members (default: cards,boards).", default: "cards,boards" },
            cards_limit: { type: "integer", description: "Max card results (default 10).", default: 10 },
          },
          required: ["query"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { query, model_types, cards_limit } = params as { query: string; model_types?: string; cards_limit?: number };
        try {
          const result = await client.search(query, model_types ?? "cards,boards", cards_limit ?? 10);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Trello plugin: all tools registered");
  },
});

runWorker(plugin, import.meta.url);
