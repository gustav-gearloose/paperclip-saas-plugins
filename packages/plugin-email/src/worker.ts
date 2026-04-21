import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { EmailClient } from "./email-client.js";

interface EmailPluginConfig {
  emailUser?: string;
  emailPasswordRef?: string;
  imapHost?: string;
  imapPort?: number;
  smtpHost?: string;
  smtpPort?: number;
  displayName?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const NOT_CONFIGURED = { error: "Email plugin not configured — set emailUser, emailPasswordRef, imapHost, smtpHost in plugin settings." };

const plugin = definePlugin({
  async setup(ctx) {
    // Resolve client lazily so tools are always registered even without config.
    // Each handler calls getClient() and gets a clear error if config is missing.
    let cachedClient: EmailClient | null = null;
    let configError: string | null = null;

    async function getClient(): Promise<EmailClient | null> {
      if (cachedClient) return cachedClient;
      if (configError) return null;

      const config = await ctx.config.get() as EmailPluginConfig;
      const { emailUser, emailPasswordRef, imapHost, imapPort, smtpHost, smtpPort, displayName } = config;

      if (!emailUser || !emailPasswordRef || !imapHost || !smtpHost) {
        configError = "Email plugin not configured — set emailUser, emailPasswordRef, imapHost, smtpHost in plugin settings.";
        ctx.logger.warn("Email plugin: missing required config fields");
        return null;
      }

      let password: string;
      try {
        password = await ctx.secrets.resolve(emailPasswordRef);
      } catch (err) {
        configError = `Email plugin: failed to resolve emailPasswordRef — ${err instanceof Error ? err.message : String(err)}`;
        ctx.logger.error(configError);
        return null;
      }

      cachedClient = new EmailClient({
        emailUser,
        password,
        imapHost,
        imapPort: Number(imapPort ?? 993),
        smtpHost,
        smtpPort: Number(smtpPort ?? 465),
        displayName,
      });
      return cachedClient;
    }

    ctx.tools.register(
      "email_list_folders",
      {
        displayName: "List Email Folders",
        description: "List all IMAP folders/mailboxes in the email account.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        const client = await getClient();
        if (!client) return { error: configError ?? NOT_CONFIGURED.error };
        try {
          return { content: JSON.stringify(await client.listFolders(), null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "email_search",
      {
        displayName: "Search Emails",
        description: "Search emails in a folder. Returns subject, from, date, and read status. Use email_get to fetch the full body.",
        parametersSchema: {
          type: "object",
          properties: {
            folder: { type: "string", description: "Folder to search (default: INBOX)." },
            query: { type: "string", description: "Search by subject keyword." },
            from: { type: "string", description: "Filter by sender address." },
            unseen: { type: "boolean", description: "Only return unread emails." },
            since: { type: "string", description: "Only emails since this date (YYYY-MM-DD)." },
            limit: { type: "integer", description: "Max results (default 20, max 50)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const client = await getClient();
        if (!client) return { error: configError ?? NOT_CONFIGURED.error };
        try {
          const p = params as Record<string, unknown>;
          const messages = await client.searchEmails({
            folder: p.folder as string | undefined,
            query: p.query as string | undefined,
            from: p.from as string | undefined,
            unseen: p.unseen as boolean | undefined,
            since: p.since as string | undefined,
            limit: Math.min((p.limit as number | undefined) ?? 20, 50),
          });
          return { content: JSON.stringify(messages, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "email_get",
      {
        displayName: "Get Email",
        description: "Fetch the full content of a specific email by UID (from email_search results).",
        parametersSchema: {
          type: "object",
          required: ["uid"],
          properties: {
            uid: { type: "integer", description: "Email UID from search results." },
            folder: { type: "string", description: "Folder containing the email (default: INBOX)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const client = await getClient();
        if (!client) return { error: configError ?? NOT_CONFIGURED.error };
        try {
          const p = params as Record<string, unknown>;
          const msg = await client.getEmail(p.uid as number, p.folder as string | undefined);
          if (!msg) return { error: `No email found with UID ${p.uid}` };
          return { content: JSON.stringify(msg, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "email_send",
      {
        displayName: "Send Email",
        description: "Compose and send an email via SMTP.",
        parametersSchema: {
          type: "object",
          required: ["to", "subject", "text"],
          properties: {
            to: { type: "string", description: "Recipient email address." },
            subject: { type: "string", description: "Email subject line." },
            text: { type: "string", description: "Plain text body of the email." },
            html: { type: "string", description: "Optional HTML body (falls back to text if omitted)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const client = await getClient();
        if (!client) return { error: configError ?? NOT_CONFIGURED.error };
        try {
          const p = params as Record<string, unknown>;
          const messageId = await client.sendEmail({
            to: p.to as string,
            subject: p.subject as string,
            text: p.text as string,
            html: p.html as string | undefined,
          });
          return { content: `Email sent. Message-ID: ${messageId}` };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "email_mark_seen",
      {
        displayName: "Mark Email as Read",
        description: "Mark an email as read/seen by UID.",
        parametersSchema: {
          type: "object",
          required: ["uid"],
          properties: {
            uid: { type: "integer", description: "Email UID to mark as read." },
            folder: { type: "string", description: "Folder containing the email (default: INBOX)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const client = await getClient();
        if (!client) return { error: configError ?? NOT_CONFIGURED.error };
        try {
          const p = params as Record<string, unknown>;
          await client.markSeen(p.uid as number, p.folder as string | undefined);
          return { content: `Email ${p.uid} marked as read.` };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "email_move",
      {
        displayName: "Move Email",
        description: "Move an email to another IMAP folder (e.g. to archive or a project folder).",
        parametersSchema: {
          type: "object",
          required: ["uid", "from_folder", "to_folder"],
          properties: {
            uid: { type: "integer", description: "Email UID." },
            from_folder: { type: "string", description: "Source folder name (e.g. INBOX)." },
            to_folder: { type: "string", description: "Destination folder name." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const client = await getClient();
        if (!client) return { error: configError ?? NOT_CONFIGURED.error };
        try {
          const p = params as Record<string, unknown>;
          await client.moveEmail(p.uid as number, p.from_folder as string, p.to_folder as string);
          return { content: `Email ${p.uid} moved from ${p.from_folder} to ${p.to_folder}.` };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "email_delete",
      {
        displayName: "Delete Email",
        description: "Delete an email by marking it for deletion and closing the mailbox.",
        parametersSchema: {
          type: "object",
          required: ["uid"],
          properties: {
            uid: { type: "integer", description: "Email UID." },
            folder: { type: "string", description: "Folder name. Default: INBOX." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const client = await getClient();
        if (!client) return { error: configError ?? NOT_CONFIGURED.error };
        try {
          const p = params as Record<string, unknown>;
          await client.deleteEmail(p.uid as number, p.folder as string | undefined);
          return { content: `Email ${p.uid} deleted.` };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Email plugin ready — 7 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "Email plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
