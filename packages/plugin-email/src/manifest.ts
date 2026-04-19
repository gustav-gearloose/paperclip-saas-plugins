import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.email",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Email",
  description: "Read and send email via IMAP/SMTP. Search inbox, fetch messages, reply, and compose.",
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
    required: ["imapHost", "imapPort", "smtpHost", "smtpPort", "emailUser", "emailPasswordRef"],
    properties: {
      emailUser: {
        type: "string",
        title: "Email Address",
        description: "The email address / IMAP login.",
        default: "",
      },
      emailPasswordRef: {
        type: "string",
        format: "secret-ref",
        title: "Email Password (secret ref)",
        description: "UUID of a Paperclip secret holding the email account password.",
        default: "",
      },
      imapHost: {
        type: "string",
        title: "IMAP Host",
        description: "IMAP server hostname (e.g. mail.your-server.de).",
        default: "",
      },
      imapPort: {
        type: "integer",
        title: "IMAP Port",
        description: "IMAP port — 993 for TLS.",
        default: 993,
      },
      smtpHost: {
        type: "string",
        title: "SMTP Host",
        description: "SMTP server hostname (e.g. mail.your-server.de).",
        default: "",
      },
      smtpPort: {
        type: "integer",
        title: "SMTP Port",
        description: "SMTP port — 465 for TLS, 587 for STARTTLS.",
        default: 465,
      },
      displayName: {
        type: "string",
        title: "Display Name",
        description: "Sender display name shown in outgoing emails.",
        default: "",
      },
    },
  },
  tools: [
    {
      name: "email_list_folders",
      displayName: "List Email Folders",
      description: "List all IMAP folders/mailboxes in the email account.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "email_search",
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
    {
      name: "email_get",
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
    {
      name: "email_send",
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
    {
      name: "email_mark_seen",
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
    {
      name: "email_move",
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
    {
      name: "email_delete",
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
  ],
};

export default manifest;
