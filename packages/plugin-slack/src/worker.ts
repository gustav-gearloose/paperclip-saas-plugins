import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { SlackClient } from "./slack-client.js";

interface SlackPluginConfig {
  botTokenRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as SlackPluginConfig;
    const { botTokenRef } = config;

    if (!botTokenRef) {
      ctx.logger.error("Slack plugin: botTokenRef is required");
      return;
    }

    let botToken: string;
    try {
      botToken = await ctx.secrets.resolve(botTokenRef);
    } catch (err) {
      ctx.logger.error(`Slack plugin: failed to resolve secret: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    const client = new SlackClient(botToken);
    ctx.logger.info("Slack plugin: registering tools");

    ctx.tools.register(
      "slack_send_message",
      {
        displayName: "Send Message",
        description: "Send a message to a Slack channel or thread.",
        parametersSchema: {
          type: "object",
          required: ["channel", "text"],
          properties: {
            channel: { type: "string" },
            text: { type: "string" },
            thread_ts: { type: "string" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.sendMessage(
            p.channel as string,
            p.text as string,
            p.thread_ts as string | undefined,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "slack_list_channels",
      {
        displayName: "List Channels",
        description: "List Slack channels the bot has access to.",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "integer" },
            cursor: { type: "string" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listChannels(
            p.limit as number | undefined,
            p.cursor as string | undefined,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "slack_get_channel_history",
      {
        displayName: "Get Channel History",
        description: "Get recent messages from a Slack channel.",
        parametersSchema: {
          type: "object",
          required: ["channel"],
          properties: {
            channel: { type: "string" },
            limit: { type: "integer" },
            oldest: { type: "string" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.getChannelHistory(
            p.channel as string,
            p.limit as number | undefined,
            p.oldest as string | undefined,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "slack_get_thread_replies",
      {
        displayName: "Get Thread Replies",
        description: "Get all replies in a Slack thread.",
        parametersSchema: {
          type: "object",
          required: ["channel", "thread_ts"],
          properties: {
            channel: { type: "string" },
            thread_ts: { type: "string" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.getThreadReplies(
            p.channel as string,
            p.thread_ts as string,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "slack_search_messages",
      {
        displayName: "Search Messages",
        description: "Search Slack messages by keyword.",
        parametersSchema: {
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string" },
            count: { type: "integer" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.searchMessages(
            p.query as string,
            p.count as number | undefined,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "slack_list_users",
      {
        displayName: "List Users",
        description: "List all members of the Slack workspace.",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "integer" },
            cursor: { type: "string" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.listUsers(
            p.limit as number | undefined,
            p.cursor as string | undefined,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "slack_get_user",
      {
        displayName: "Get User",
        description: "Get profile information for a specific Slack user.",
        parametersSchema: {
          type: "object",
          required: ["user_id"],
          properties: { user_id: { type: "string" } },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.getUserInfo(p.user_id as string);
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "slack_upload_file",
      {
        displayName: "Upload File",
        description: "Upload a text file or snippet to a Slack channel.",
        parametersSchema: {
          type: "object",
          required: ["channel", "filename", "content"],
          properties: {
            channel: { type: "string" },
            filename: { type: "string" },
            content: { type: "string" },
            title: { type: "string" },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as Record<string, unknown>;
          const data = await client.uploadFile(
            p.channel as string,
            p.filename as string,
            p.content as string,
            p.title as string | undefined,
          );
          return { content: JSON.stringify(data, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Slack plugin ready — 8 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "Slack plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
