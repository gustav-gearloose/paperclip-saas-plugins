import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.slack",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Slack",
  description: "Send messages, read channels, and search Slack via a bot token.",
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
      botTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "Slack Bot Token (secret ref)",
        description:
          "UUID of a Paperclip secret holding your Slack bot token (xoxb-...). Create one at api.slack.com/apps → OAuth & Permissions.",
        default: "",
      },
    },
    required: ["botTokenRef"],
  },
  tools: [
    {
      name: "slack_send_message",
      displayName: "Send Message",
      description: "Send a message to a Slack channel or thread. Use channel name (#general) or channel ID.",
      parametersSchema: {
        type: "object",
        required: ["channel", "text"],
        properties: {
          channel: { type: "string", description: "Channel name (e.g. #general) or channel ID." },
          text: { type: "string", description: "Message text. Supports Slack mrkdwn formatting." },
          thread_ts: { type: "string", description: "Reply in a thread: the timestamp of the parent message." },
        },
      },
    },
    {
      name: "slack_list_channels",
      displayName: "List Channels",
      description: "List public and private Slack channels the bot has access to.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Max channels to return (default 100)." },
          cursor: { type: "string", description: "Pagination cursor from a previous call." },
        },
      },
    },
    {
      name: "slack_get_channel_history",
      displayName: "Get Channel History",
      description: "Get recent messages from a Slack channel.",
      parametersSchema: {
        type: "object",
        required: ["channel"],
        properties: {
          channel: { type: "string", description: "Channel name or ID." },
          limit: { type: "integer", description: "Number of messages to return (default 20, max 100)." },
          oldest: { type: "string", description: "Only return messages after this Unix timestamp." },
        },
      },
    },
    {
      name: "slack_get_thread_replies",
      displayName: "Get Thread Replies",
      description: "Get all replies in a Slack thread.",
      parametersSchema: {
        type: "object",
        required: ["channel", "thread_ts"],
        properties: {
          channel: { type: "string", description: "Channel ID containing the thread." },
          thread_ts: { type: "string", description: "Timestamp of the parent message." },
        },
      },
    },
    {
      name: "slack_search_messages",
      displayName: "Search Messages",
      description: "Search Slack messages by keyword. Requires search:read scope on the bot.",
      parametersSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string", description: "Search query string." },
          count: { type: "integer", description: "Max results (default 10)." },
        },
      },
    },
    {
      name: "slack_list_users",
      displayName: "List Users",
      description: "List all members of the Slack workspace.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Max users to return (default 100)." },
          cursor: { type: "string", description: "Pagination cursor." },
        },
      },
    },
    {
      name: "slack_get_user",
      displayName: "Get User",
      description: "Get profile information for a specific Slack user.",
      parametersSchema: {
        type: "object",
        required: ["user_id"],
        properties: {
          user_id: { type: "string", description: "Slack user ID (e.g. U0123ABCDEF)." },
        },
      },
    },
    {
      name: "slack_upload_file",
      displayName: "Upload File",
      description: "Upload a text file or snippet to a Slack channel.",
      parametersSchema: {
        type: "object",
        required: ["channel", "filename", "content"],
        properties: {
          channel: { type: "string", description: "Channel ID to share the file in." },
          filename: { type: "string", description: "Filename including extension (e.g. report.txt)." },
          content: { type: "string", description: "File content as a string." },
          title: { type: "string", description: "Optional display title for the file." },
        },
      },
    },
    {
      name: "slack_add_reaction",
      displayName: "Add Reaction",
      description: "Add an emoji reaction to a Slack message.",
      parametersSchema: {
        type: "object",
        required: ["channel", "timestamp", "emoji"],
        properties: {
          channel: { type: "string", description: "Channel ID or name." },
          timestamp: { type: "string", description: "Message timestamp (ts field from message)." },
          emoji: { type: "string", description: "Emoji name without colons, e.g. 'white_check_mark', 'thumbsup'." },
        },
      },
    },
  ],
};

export default manifest;
