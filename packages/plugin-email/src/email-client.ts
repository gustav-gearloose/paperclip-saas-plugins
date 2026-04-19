import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

export interface EmailConfig {
  emailUser: string;
  password: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  displayName?: string;
}

export interface EmailMessage {
  uid: number;
  messageId?: string;
  subject?: string;
  from?: string;
  to?: string;
  date?: string;
  seen: boolean;
  body?: string;
}

export interface SearchOptions {
  folder?: string;
  query?: string;
  unseen?: boolean;
  from?: string;
  since?: string; // YYYY-MM-DD
  limit?: number;
}

export class EmailClient {
  constructor(private config: EmailConfig) {}

  private makeImapClient() {
    return new ImapFlow({
      host: this.config.imapHost,
      port: this.config.imapPort,
      secure: true,
      auth: { user: this.config.emailUser, pass: this.config.password },
      logger: false,
    });
  }

  async listFolders(): Promise<string[]> {
    const client = this.makeImapClient();
    await client.connect();
    try {
      const list = await client.list();
      return list.map((m) => m.path);
    } finally {
      await client.logout();
    }
  }

  async searchEmails(opts: SearchOptions = {}): Promise<EmailMessage[]> {
    const client = this.makeImapClient();
    await client.connect();
    try {
      const folder = opts.folder ?? "INBOX";
      await client.mailboxOpen(folder);

      const searchCriteria: Record<string, unknown> = {};
      if (opts.unseen) searchCriteria["seen"] = false;
      if (opts.from) searchCriteria["from"] = opts.from;
      if (opts.since) searchCriteria["since"] = new Date(opts.since);
      if (opts.query) searchCriteria["subject"] = opts.query;

      const uids = await client.search(
        Object.keys(searchCriteria).length ? searchCriteria : { all: true },
        { uid: true }
      );

      const limit = opts.limit ?? 20;
      const uidList = Array.isArray(uids) ? uids : [];
      const selected = uidList.slice(-limit).reverse();

      const messages: EmailMessage[] = [];
      for await (const msg of client.fetch(selected, {
        uid: true,
        flags: true,
        envelope: true,
        bodyStructure: true,
      }, { uid: true })) {
        messages.push({
          uid: msg.uid,
          messageId: msg.envelope?.messageId,
          subject: msg.envelope?.subject,
          from: msg.envelope?.from?.[0]
            ? `${msg.envelope.from[0].name ?? ""} <${msg.envelope.from[0].address}>`.trim()
            : undefined,
          to: msg.envelope?.to?.[0]?.address,
          date: msg.envelope?.date?.toISOString(),
          seen: msg.flags?.has("\\Seen") ?? false,
        });
      }
      return messages;
    } finally {
      await client.logout();
    }
  }

  async getEmail(uid: number, folder = "INBOX"): Promise<EmailMessage | null> {
    const client = this.makeImapClient();
    await client.connect();
    try {
      await client.mailboxOpen(folder);
      let result: EmailMessage | null = null;
      for await (const msg of client.fetch([uid], {
        uid: true,
        flags: true,
        envelope: true,
        source: true,
      }, { uid: true })) {
        const raw = msg.source?.toString() ?? "";
        // Extract plain text body (naive but sufficient for agent use)
        const bodyMatch = raw.match(/\r?\n\r?\n([\s\S]*)/);
        const body = bodyMatch ? bodyMatch[1].slice(0, 4000) : raw.slice(0, 4000);
        result = {
          uid: msg.uid,
          messageId: msg.envelope?.messageId,
          subject: msg.envelope?.subject,
          from: msg.envelope?.from?.[0]
            ? `${msg.envelope.from[0].name ?? ""} <${msg.envelope.from[0].address}>`.trim()
            : undefined,
          to: msg.envelope?.to?.[0]?.address,
          date: msg.envelope?.date?.toISOString(),
          seen: msg.flags?.has("\\Seen") ?? false,
          body,
        };
      }
      return result;
    } finally {
      await client.logout();
    }
  }

  async sendEmail(opts: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
  }): Promise<string> {
    const transport = nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: this.config.smtpPort === 465,
      auth: { user: this.config.emailUser, pass: this.config.password },
    });

    const info = await transport.sendMail({
      from: this.config.displayName
        ? `"${this.config.displayName}" <${this.config.emailUser}>`
        : this.config.emailUser,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      replyTo: opts.replyTo,
    });

    return info.messageId;
  }

  async markSeen(uid: number, folder = "INBOX"): Promise<void> {
    const client = this.makeImapClient();
    await client.connect();
    try {
      await client.mailboxOpen(folder, { readOnly: false });
      await client.messageFlagsAdd([uid], ["\\Seen"], { uid: true });
    } finally {
      await client.logout();
    }
  }
}
