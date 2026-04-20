import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.stripe",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Stripe",
  description: "Access Stripe payments: look up customers, subscriptions, invoices, payment intents, and products.",
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
      secretKeyRef: {
        type: "string",
        format: "secret-ref",
        title: "Stripe Secret Key (secret ref)",
        description: "UUID of a Paperclip secret holding your Stripe secret key (sk_live_... or sk_test_...).",
        default: "",
      },
    },
    required: ["secretKeyRef"],
  },
  tools: [
    {
      name: "stripe_list_customers",
      displayName: "List Customers",
      description: "List Stripe customers, optionally filtered by email address.",
      parametersSchema: {
        type: "object",
        properties: {
          email: { type: "string", description: "Filter by exact email address." },
          limit: { type: "integer", description: "Max results (default 20).", default: 20 },
          starting_after: { type: "string", description: "Cursor for pagination — ID of last customer from previous page." },
        },
      },
    },
    {
      name: "stripe_get_customer",
      displayName: "Get Customer",
      description: "Get full details for a specific Stripe customer by ID.",
      parametersSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Stripe customer ID (cus_...)." },
        },
        required: ["id"],
      },
    },
    {
      name: "stripe_create_customer",
      displayName: "Create Customer",
      description: "Create a new Stripe customer.",
      parametersSchema: {
        type: "object",
        properties: {
          email: { type: "string", description: "Customer email address." },
          name: { type: "string", description: "Customer full name." },
          phone: { type: "string", description: "Customer phone number." },
          description: { type: "string", description: "Internal description or notes." },
        },
      },
    },
    {
      name: "stripe_list_subscriptions",
      displayName: "List Subscriptions",
      description: "List Stripe subscriptions, optionally filtered by customer or status.",
      parametersSchema: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Filter by customer ID (cus_...)." },
          status: { type: "string", description: "Filter by status: active, past_due, unpaid, canceled, incomplete, trialing, all.", default: "all" },
          limit: { type: "integer", description: "Max results (default 20).", default: 20 },
        },
      },
    },
    {
      name: "stripe_get_subscription",
      displayName: "Get Subscription",
      description: "Get full details for a specific Stripe subscription by ID.",
      parametersSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Stripe subscription ID (sub_...)." },
        },
        required: ["id"],
      },
    },
    {
      name: "stripe_list_invoices",
      displayName: "List Invoices",
      description: "List Stripe invoices, optionally filtered by customer, subscription, or status.",
      parametersSchema: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Filter by customer ID (cus_...)." },
          subscription: { type: "string", description: "Filter by subscription ID (sub_...)." },
          status: { type: "string", description: "Filter by status: draft, open, paid, uncollectible, void." },
          limit: { type: "integer", description: "Max results (default 20).", default: 20 },
        },
      },
    },
    {
      name: "stripe_get_invoice",
      displayName: "Get Invoice",
      description: "Get full details for a specific Stripe invoice by ID.",
      parametersSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Stripe invoice ID (in_...)." },
        },
        required: ["id"],
      },
    },
    {
      name: "stripe_list_payment_intents",
      displayName: "List Payment Intents",
      description: "List Stripe payment intents, optionally filtered by customer.",
      parametersSchema: {
        type: "object",
        properties: {
          customer: { type: "string", description: "Filter by customer ID (cus_...)." },
          limit: { type: "integer", description: "Max results (default 20).", default: 20 },
        },
      },
    },
    {
      name: "stripe_get_payment_intent",
      displayName: "Get Payment Intent",
      description: "Get full details for a specific Stripe payment intent by ID.",
      parametersSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Stripe payment intent ID (pi_...)." },
        },
        required: ["id"],
      },
    },
    {
      name: "stripe_list_products",
      displayName: "List Products",
      description: "List Stripe products (your offerings/plans).",
      parametersSchema: {
        type: "object",
        properties: {
          active: { type: "boolean", description: "Filter by active status (true=active only, false=archived only)." },
          limit: { type: "integer", description: "Max results (default 20).", default: 20 },
        },
      },
    },
  ],
};

export default manifest;
