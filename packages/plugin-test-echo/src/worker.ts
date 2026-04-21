import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info("test-echo plugin: registering tools");

    ctx.tools.register(
      "echo",
      {
        displayName: "Echo",
        description: "Returns whatever text you pass in.",
        parametersSchema: {
          type: "object",
          required: ["message"],
          properties: {
            message: { type: "string", description: "Text to echo back." },
          },
        },
      },
      async (params: unknown): Promise<ToolResult> => {
        const { message } = params as { message: string };
        return { content: message };
      },
    );

    ctx.tools.register(
      "ping",
      {
        displayName: "Ping",
        description: "Returns a pong with the current server timestamp.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        return { content: `pong — ${new Date().toISOString()}` };
      },
    );

    ctx.logger.info("test-echo plugin: ready");
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
