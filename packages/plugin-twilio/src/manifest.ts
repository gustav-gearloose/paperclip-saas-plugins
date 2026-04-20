import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.twilio",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Twilio",
  description: "Twilio SMS & voice — send messages, read message history, manage calls and phone numbers.",
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
      authTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "Auth Token (secret ref)",
        description: "UUID of a Paperclip secret holding your Twilio Auth Token.",
        default: "",
      },
      accountSid: {
        type: "string",
        title: "Account SID",
        description: "Your Twilio Account SID (starts with AC...).",
        default: "",
      },
    },
    required: ["authTokenRef", "accountSid"],
  },
  tools: [
    {
      name: "twilio_get_account_info",
      displayName: "Get Account Info",
      description: "Get Twilio account details and status.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "twilio_send_sms",
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
    {
      name: "twilio_list_messages",
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
    {
      name: "twilio_get_message",
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
    {
      name: "twilio_list_phone_numbers",
      displayName: "List Phone Numbers",
      description: "List all Twilio phone numbers on the account.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "twilio_list_calls",
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
    {
      name: "twilio_get_call",
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
    {
      name: "twilio_make_call",
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
  ],
};

export default manifest;
