const SLACK_API = "https://slack.com/api";

interface SlackResponse {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

export class SlackClient {
  private token: string;

  constructor(botToken: string) {
    this.token = botToken;
  }

  private async call(method: string, body?: Record<string, unknown>): Promise<SlackResponse> {
    const resp = await fetch(`${SLACK_API}/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body ?? {}),
    });
    const data = (await resp.json()) as SlackResponse;
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }
    return data;
  }

  async sendMessage(channel: string, text: string, threadTs?: string): Promise<SlackResponse> {
    return this.call("chat.postMessage", {
      channel,
      text,
      ...(threadTs ? { thread_ts: threadTs } : {}),
    });
  }

  async listChannels(limit = 100, cursor?: string): Promise<SlackResponse> {
    return this.call("conversations.list", {
      limit,
      exclude_archived: true,
      types: "public_channel,private_channel",
      ...(cursor ? { cursor } : {}),
    });
  }

  async getChannelHistory(channel: string, limit = 20, oldest?: string): Promise<SlackResponse> {
    return this.call("conversations.history", {
      channel,
      limit,
      ...(oldest ? { oldest } : {}),
    });
  }

  async getThreadReplies(channel: string, threadTs: string): Promise<SlackResponse> {
    return this.call("conversations.replies", { channel, ts: threadTs });
  }

  async searchMessages(query: string, count = 10): Promise<SlackResponse> {
    return this.call("search.messages", { query, count, highlight: false });
  }

  async listUsers(limit = 100, cursor?: string): Promise<SlackResponse> {
    return this.call("users.list", {
      limit,
      ...(cursor ? { cursor } : {}),
    });
  }

  async getUserInfo(userId: string): Promise<SlackResponse> {
    return this.call("users.info", { user: userId });
  }

  async uploadFile(channels: string, filename: string, content: string, title?: string): Promise<SlackResponse> {
    const byteLength = new TextEncoder().encode(content).length;
    return this.call("files.getUploadURLExternal", { filename, length: byteLength }).then(async (urlResp) => {
      const uploadUrl = urlResp.upload_url as string;
      const fileId = urlResp.file_id as string;
      await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: content,
      });
      return this.call("files.completeUploadExternal", {
        files: [{ id: fileId, title: title ?? filename }],
        channel_id: channels,
      });
    });
  }
}
