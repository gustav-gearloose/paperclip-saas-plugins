import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { TwilioClient } from "./twilio-client.js";

interface TwilioPluginConfig {
  authTokenRef?: string;
  accountSid?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as TwilioPluginConfig;

    if (!config.authTokenRef) {
      ctx.logger.error("Twilio plugin: authTokenRef is required");
      return;
    }
    if (!config.accountSid) {
      ctx.logger.error("Twilio plugin: accountSid is required");
      return;
    }

    let authToken: string;
    try {
      authToken = await ctx.secrets.resolve(config.authTokenRef);
    } catch (err) {
      ctx.logger.error(`Twilio plugin: failed to resolve authTokenRef: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    const client = new TwilioClient(config.accountSid, authToken);
    ctx.logger.info("Twilio plugin: client initialized, registering tools");

    ctx.tools.register(
      "twilio_get_account_info",
      {
        displayName: "Get Account Info",
        description: "Get Twilio account details and status.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const result = await client.getAccountInfo();
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "twilio_send_sms",
      {
        displayName: "Send SMS",
        description: "Send an SMS message via Twilio.",
        parametersSchema: {
          type: "object",
          properties: {
            from: { type: "string", description: "Twilio phone number to send from (E.164 format, e.g. +4512345678)." },
            to: { type: "string", description: "Recipient phone number (E.164 format)." },
            body: { type: "string", description: "SMS message body text." },
          },
          required: ["from", "to", "body"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { from, to, body } = params as { from: string; to: string; body: string };
        try {
          const result = await client.sendSms(from, to, body);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "twilio_list_messages",
      {
        displayName: "List Messages",
        description: "List sent/received SMS messages, optionally filtered by number or date.",
        parametersSchema: {
          type: "object",
          properties: {
            PageSize: { type: "integer", description: "Number of results per page (default 20, max 1000).", default: 20 },
            To: { type: "string", description: "Filter by recipient phone number." },
            From: { type: "string", description: "Filter by sender phone number." },
            DateSent: { type: "string", description: "Filter by exact date sent (YYYY-MM-DD)." },
            DateSentAfter: { type: "string", description: "Filter messages sent after this date (YYYY-MM-DD)." },
            DateSentBefore: { type: "string", description: "Filter messages sent before this date (YYYY-MM-DD)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { PageSize, To, From, DateSent, DateSentAfter, DateSentBefore } = params as {
          PageSize?: number; To?: string; From?: string;
          DateSent?: string; DateSentAfter?: string; DateSentBefore?: string;
        };
        try {
          const result = await client.listMessages({ PageSize, To, From, DateSent, DateSentAfter, DateSentBefore });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "twilio_get_message",
      {
        displayName: "Get Message",
        description: "Get details of a specific Twilio message by SID.",
        parametersSchema: {
          type: "object",
          properties: {
            message_sid: { type: "string", description: "The Twilio message SID." },
          },
          required: ["message_sid"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { message_sid } = params as { message_sid: string };
        try {
          const result = await client.getMessage(message_sid);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "twilio_list_phone_numbers",
      {
        displayName: "List Phone Numbers",
        description: "List all Twilio phone numbers on the account.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const result = await client.listPhoneNumbers();
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "twilio_list_calls",
      {
        displayName: "List Calls",
        description: "List voice calls, optionally filtered by number, status, or date.",
        parametersSchema: {
          type: "object",
          properties: {
            PageSize: { type: "integer", description: "Number of results per page (default 20, max 1000).", default: 20 },
            To: { type: "string", description: "Filter by recipient phone number." },
            From: { type: "string", description: "Filter by caller phone number." },
            Status: { type: "string", description: "Filter by call status: queued, ringing, in-progress, completed, failed, busy, no-answer." },
            StartTimeAfter: { type: "string", description: "Filter calls starting after this date (YYYY-MM-DD)." },
            StartTimeBefore: { type: "string", description: "Filter calls starting before this date (YYYY-MM-DD)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        const { PageSize, To, From, Status, StartTimeAfter, StartTimeBefore } = params as {
          PageSize?: number; To?: string; From?: string;
          Status?: string; StartTimeAfter?: string; StartTimeBefore?: string;
        };
        try {
          const result = await client.listCalls({ PageSize, To, From, Status, StartTimeAfter, StartTimeBefore });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "twilio_get_call",
      {
        displayName: "Get Call",
        description: "Get details of a specific Twilio voice call by SID.",
        parametersSchema: {
          type: "object",
          properties: {
            call_sid: { type: "string", description: "The Twilio call SID." },
          },
          required: ["call_sid"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { call_sid } = params as { call_sid: string };
        try {
          const result = await client.getCall(call_sid);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "twilio_make_call",
      {
        displayName: "Make Call",
        description: "Initiate an outbound voice call via Twilio using a TwiML URL for instructions.",
        parametersSchema: {
          type: "object",
          properties: {
            from: { type: "string", description: "Twilio phone number to call from (E.164 format)." },
            to: { type: "string", description: "Recipient phone number (E.164 format)." },
            url: { type: "string", description: "URL that returns TwiML instructions for the call." },
          },
          required: ["from", "to", "url"],
        },
      },
      async (params): Promise<ToolResult> => {
        const { from, to, url } = params as { from: string; to: string; url: string };
        try {
          const result = await client.makeCall(from, to, url);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.logger.info("Twilio plugin: all tools registered");
  },
});

runWorker(plugin, import.meta.url);
