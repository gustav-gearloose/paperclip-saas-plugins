import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.dinero",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Dinero",
  description: "Access Dinero accounting: invoices, contacts, journal entries, VAT, bank statements.",
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
      dineroOrgId: {
        type: "string",
        title: "Dinero Organisation ID",
        description: "Your Dinero organisation ID (found in Dinero → Indstillinger → API).",
        default: "",
      },
      dineroClientIdRef: {
        type: "string",
        format: "secret-ref",
        title: "Dinero Client ID (secret ref)",
        description: "UUID of a Paperclip secret holding your Dinero OAuth2 client_id.",
        default: "",
      },
      dineroClientSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "Dinero Client Secret (secret ref)",
        description: "UUID of a Paperclip secret holding your Dinero OAuth2 client_secret.",
        default: "",
      },
      dineroApiKeyRef: {
        type: "string",
        format: "secret-ref",
        title: "Dinero API Key (secret ref)",
        description: "UUID of a Paperclip secret holding your Dinero organisation API key.",
        default: "",
      },
    },
    required: ["dineroOrgId", "dineroClientIdRef", "dineroClientSecretRef", "dineroApiKeyRef"],
  },
};

export default manifest;
