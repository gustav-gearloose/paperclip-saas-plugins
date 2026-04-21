import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.test-echo",
  displayName: "Test Echo",
  description: "Minimal echo plugin for testing plugin tool execution. No credentials required.",
  author: "Gearloose",
  version: "0.1.0",
  apiVersion: 1,
  categories: ["connector"],
  capabilities: ["agent.tools.register"],
  entrypoints: { worker: "./worker.js" },
  tools: [
    {
      name: "echo",
      displayName: "Echo",
      description: "Returns whatever text you pass in. Useful for testing plugin tool execution.",
      parametersSchema: {
        type: "object",
        required: ["message"],
        properties: {
          message: { type: "string", description: "Text to echo back." },
        },
      },
    },
    {
      name: "ping",
      displayName: "Ping",
      description: "Returns a pong with the current server timestamp. No parameters needed.",
      parametersSchema: { type: "object", properties: {} },
    },
  ],
};

export default manifest;
