import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { TeamsClient } from "./teams-client.js";

interface TeamsPluginConfig {
  tenantId?: string;
  clientIdRef?: string;
  clientSecretRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as TeamsPluginConfig;
    const { tenantId, clientIdRef, clientSecretRef } = config;

    if (!tenantId || !clientIdRef || !clientSecretRef) {
      ctx.logger.error("Teams plugin: tenantId, clientIdRef and clientSecretRef are required");
      return;
    }

    let clientId: string;
    let clientSecret: string;
    try {
      [clientId, clientSecret] = await Promise.all([
        ctx.secrets.resolve(clientIdRef),
        ctx.secrets.resolve(clientSecretRef),
      ]);
    } catch (err) {
      ctx.logger.error(`Teams plugin: failed to resolve secrets: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    const client = new TeamsClient(tenantId, clientId, clientSecret);
    ctx.logger.info("Teams plugin: registering tools");

    ctx.tools.register(
      "teams_list_teams",
      {
        displayName: "List Teams",
        description: "List all Microsoft Teams the app has access to.",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "integer" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listTeams(p.limit as number | undefined);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "teams_list_channels",
      {
        displayName: "List Channels",
        description: "List all channels in a Teams team.",
        parametersSchema: {
          type: "object",
          required: ["team_id"],
          properties: {
            team_id: { type: "string" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listChannels(p.team_id as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "teams_get_channel_messages",
      {
        displayName: "Get Channel Messages",
        description: "Get recent messages from a Teams channel.",
        parametersSchema: {
          type: "object",
          required: ["team_id", "channel_id"],
          properties: {
            team_id: { type: "string" },
            channel_id: { type: "string" },
            limit: { type: "integer" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.getChannelMessages(
            p.team_id as string,
            p.channel_id as string,
            p.limit as number | undefined,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "teams_send_channel_message",
      {
        displayName: "Send Channel Message",
        description: "Send a message to a Teams channel.",
        parametersSchema: {
          type: "object",
          required: ["team_id", "channel_id", "message"],
          properties: {
            team_id: { type: "string" },
            channel_id: { type: "string" },
            message: { type: "string" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.sendChannelMessage(
            p.team_id as string,
            p.channel_id as string,
            p.message as string,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "teams_reply_to_message",
      {
        displayName: "Reply to Message",
        description: "Reply to an existing message in a Teams channel thread.",
        parametersSchema: {
          type: "object",
          required: ["team_id", "channel_id", "message_id", "reply"],
          properties: {
            team_id: { type: "string" },
            channel_id: { type: "string" },
            message_id: { type: "string" },
            reply: { type: "string" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.replyToMessage(
            p.team_id as string,
            p.channel_id as string,
            p.message_id as string,
            p.reply as string,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "teams_list_chats",
      {
        displayName: "List Chats",
        description: "List recent direct message and group chat conversations.",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "integer" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listChats(p.limit as number | undefined);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "teams_get_chat_messages",
      {
        displayName: "Get Chat Messages",
        description: "Get messages from a Teams chat.",
        parametersSchema: {
          type: "object",
          required: ["chat_id"],
          properties: {
            chat_id: { type: "string" },
            limit: { type: "integer" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.getChatMessages(
            p.chat_id as string,
            p.limit as number | undefined,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "teams_list_members",
      {
        displayName: "List Team Members",
        description: "List all members of a Teams team.",
        parametersSchema: {
          type: "object",
          required: ["team_id"],
          properties: {
            team_id: { type: "string" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listTeamMembers(p.team_id as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Teams plugin ready — 8 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "Teams plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
