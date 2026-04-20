import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { StripeClient } from "./stripe-client.js";

interface StripePluginConfig {
  secretKeyRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as StripePluginConfig;

    if (!config.secretKeyRef) {
      ctx.logger.error("Stripe plugin: secretKeyRef is required");
      return;
    }

    let secretKey: string;
    try {
      secretKey = await ctx.secrets.resolve(config.secretKeyRef);
    } catch (err) {
      ctx.logger.error(`Stripe plugin: failed to resolve secretKeyRef: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    ctx.logger.info("Stripe plugin: secret resolved, registering tools");
    const client = new StripeClient(secretKey);

    ctx.tools.register(
      "stripe_list_customers",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { email?: string; limit?: number; starting_after?: string };
          const result = await client.listCustomers(p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "stripe_get_customer",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { id: string };
          const result = await client.getCustomer(p.id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "stripe_create_customer",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const result = await client.createCustomer(params as { email?: string; name?: string; phone?: string; description?: string });
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "stripe_list_subscriptions",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { customer?: string; status?: string; limit?: number };
          const result = await client.listSubscriptions(p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "stripe_get_subscription",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { id: string };
          const result = await client.getSubscription(p.id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "stripe_list_invoices",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { customer?: string; status?: string; limit?: number; subscription?: string };
          const result = await client.listInvoices(p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "stripe_get_invoice",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { id: string };
          const result = await client.getInvoice(p.id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "stripe_list_payment_intents",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { customer?: string; limit?: number };
          const result = await client.listPaymentIntents(p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "stripe_get_payment_intent",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { id: string };
          const result = await client.getPaymentIntent(p.id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "stripe_list_products",
      {
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
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { active?: boolean; limit?: number };
          const result = await client.listProducts(p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );
  },
});

runWorker(plugin, import.meta.url);
