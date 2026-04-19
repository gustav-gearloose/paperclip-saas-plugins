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
};

export default manifest;
