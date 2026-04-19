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

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as EmailPluginConfig;
    const { emailUser, emailPasswordRef, imapHost, imapPort, smtpHost, smtpPort, displayName } = config;

    if (!emailUser || !emailPasswordRef || !imapHost || !smtpHost) {
      ctx.logger.error("Email plugin: emailUser, emailPasswordRef, imapHost, smtpHost are required");
      return;
    }

    let password: string;
    try {
      password = await ctx.secrets.resolve(emailPasswordRef);
    } catch (err) {
      ctx.logger.error(`Email plugin: failed to resolve emailPasswordRef: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    const client = new EmailClient({
      emailUser,
      password,
      imapHost,
      imapPort: imapPort ?? 993,
      smtpHost,
      smtpPort: smtpPort ?? 465,
      displayName,
    });

    ctx.logger.info("Email plugin: connected, registering tools");

    ctx.tools.register(
      "email_list_folders",
      {
        displayName: "List Email Folders",
        description: "List all IMAP folders/mailboxes in the email account.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const folders = await client.listFolders();
          return { content: JSON.stringify(folders, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "email_search",
      {
        displayName: "Search Emails",
        description: "Search emails in a folder. Returns subject, from, date, and read status. Use get_email to fetch the full body.",
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
        try {
          const p = params as Record<string, unknown>;
          await client.markSeen(p.uid as number, p.folder as string | undefined);
          return { content: `Email ${p.uid} marked as read.` };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Email plugin ready — 5 tools registered");
  },

  async onHealth() {
    return { status: "ok", message: "Email plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
