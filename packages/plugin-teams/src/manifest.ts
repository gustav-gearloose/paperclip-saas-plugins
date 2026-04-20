import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.teams",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Microsoft Teams",
  description: "Read and send messages in Microsoft Teams channels and chats via Microsoft Graph API.",
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
      tenantId: {
        type: "string",
        title: "Azure Tenant ID",
        description: "Your Azure AD tenant ID (found in Azure Portal → Azure Active Directory → Overview).",
        default: "",
      },
      clientIdRef: {
        type: "string",
        format: "secret-ref",
        title: "App Client ID (secret ref)",
        description: "UUID of a Paperclip secret holding your Azure AD app registration Client ID.",
        default: "",
      },
      clientSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "App Client Secret (secret ref)",
        description: "UUID of a Paperclip secret holding your Azure AD app registration Client Secret.",
        default: "",
      },
    },
    required: ["tenantId", "clientIdRef", "clientSecretRef"],
  },
  tools: [
    {
      name: "teams_list_teams",
      displayName: "List Teams",
      description: "List all Microsoft Teams the app has access to in the organization.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Max teams to return (default 50)." },
        },
      },
    },
    {
      name: "teams_list_channels",
      displayName: "List Channels",
      description: "List all channels in a Microsoft Teams team.",
      parametersSchema: {
        type: "object",
        required: ["team_id"],
        properties: {
          team_id: { type: "string", description: "Teams team ID (from teams_list_teams)." },
        },
      },
    },
    {
      name: "teams_get_channel_messages",
      displayName: "Get Channel Messages",
      description: "Get recent messages from a Teams channel.",
      parametersSchema: {
        type: "object",
        required: ["team_id", "channel_id"],
        properties: {
          team_id: { type: "string", description: "Teams team ID." },
          channel_id: { type: "string", description: "Channel ID (from teams_list_channels)." },
          limit: { type: "integer", description: "Max messages to return (default 20, max 50)." },
        },
      },
    },
    {
      name: "teams_send_channel_message",
      displayName: "Send Channel Message",
      description: "Send a message to a Teams channel.",
      parametersSchema: {
        type: "object",
        required: ["team_id", "channel_id", "message"],
        properties: {
          team_id: { type: "string", description: "Teams team ID." },
          channel_id: { type: "string", description: "Channel ID." },
          message: { type: "string", description: "Message text. Supports basic HTML formatting." },
        },
      },
    },
    {
      name: "teams_reply_to_message",
      displayName: "Reply to Message",
      description: "Reply to an existing message in a Teams channel thread.",
      parametersSchema: {
        type: "object",
        required: ["team_id", "channel_id", "message_id", "reply"],
        properties: {
          team_id: { type: "string", description: "Teams team ID." },
          channel_id: { type: "string", description: "Channel ID." },
          message_id: { type: "string", description: "ID of the message to reply to." },
          reply: { type: "string", description: "Reply text. Supports basic HTML formatting." },
        },
      },
    },
    {
      name: "teams_list_chats",
      displayName: "List Chats",
      description: "List recent direct message and group chat conversations the app has access to.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Max chats to return (default 20)." },
        },
      },
    },
    {
      name: "teams_get_chat_messages",
      displayName: "Get Chat Messages",
      description: "Get messages from a Teams chat (direct message or group chat).",
      parametersSchema: {
        type: "object",
        required: ["chat_id"],
        properties: {
          chat_id: { type: "string", description: "Chat ID (from teams_list_chats)." },
          limit: { type: "integer", description: "Max messages to return (default 20)." },
        },
      },
    },
    {
      name: "teams_list_members",
      displayName: "List Team Members",
      description: "List all members of a Teams team.",
      parametersSchema: {
        type: "object",
        required: ["team_id"],
        properties: {
          team_id: { type: "string", description: "Teams team ID." },
        },
      },
    },
  ],
};

export default manifest;
