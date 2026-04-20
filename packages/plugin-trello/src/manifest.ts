import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.trello",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Trello",
  description: "Trello project boards — boards, lists, cards, checklists, and members.",
  author: "Gearloose",
  categories: ["connector"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "instance.settings.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      apiKeyRef: {
        type: "string",
        format: "secret-ref",
        title: "API Key (secret ref)",
        description: "UUID of a Paperclip secret holding your Trello API key.",
        default: "",
      },
      apiTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "API Token (secret ref)",
        description: "UUID of a Paperclip secret holding your Trello API token.",
        default: "",
      },
    },
    required: ["apiKeyRef", "apiTokenRef"],
  },
  tools: [
    {
      name: "trello_list_boards",
      displayName: "List Boards",
      description: "List all Trello boards the authenticated user has access to.",
      parametersSchema: {
        type: "object",
        properties: {
          filter: { type: "string", description: "Filter by membership type: all, open, closed, starred (default: open).", default: "open" },
        },
      },
    },
    {
      name: "trello_get_board",
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
    {
      name: "trello_list_lists",
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
    {
      name: "trello_list_cards",
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
    {
      name: "trello_get_card",
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
    {
      name: "trello_create_card",
      displayName: "Create Card",
      description: "Create a new card in a Trello list.",
      parametersSchema: {
        type: "object",
        properties: {
          list_id: { type: "string", description: "ID of the list to add the card to." },
          name: { type: "string", description: "Card title." },
          desc: { type: "string", description: "Card description." },
          due: { type: "string", description: "Due date in ISO 8601 format (e.g. 2025-12-31T00:00:00.000Z)." },
          pos: { type: "string", description: "Position: top, bottom, or a positive number.", default: "bottom" },
        },
        required: ["list_id", "name"],
      },
    },
    {
      name: "trello_update_card",
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
    {
      name: "trello_add_comment",
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
    {
      name: "trello_list_members",
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
    {
      name: "trello_search",
      displayName: "Search Trello",
      description: "Search for cards, boards, or members across Trello.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query string." },
          model_types: { type: "string", description: "Comma-separated types to search: cards, boards, members (default: cards,boards).", default: "cards,boards" },
          cards_limit: { type: "integer", description: "Max card results (default 10).", default: 10 },
        },
        required: ["query"],
      },
    },
  ],
};

export default manifest;
