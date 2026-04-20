import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { ShopifyClient } from "./shopify-client.js";

interface ShopifyPluginConfig {
  shopDomain?: string;
  accessTokenRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = await ctx.config.get() as ShopifyPluginConfig;

    if (!config.shopDomain) {
      ctx.logger.error("Shopify plugin: shopDomain is required");
      return;
    }
    if (!config.accessTokenRef) {
      ctx.logger.error("Shopify plugin: accessTokenRef is required");
      return;
    }

    let accessToken: string;
    try {
      accessToken = await ctx.secrets.resolve(config.accessTokenRef);
    } catch (err) {
      ctx.logger.error(`Shopify plugin: failed to resolve accessTokenRef: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    ctx.logger.info("Shopify plugin: secret resolved, registering tools");
    const client = new ShopifyClient(config.shopDomain, accessToken);

    ctx.tools.register(
      "shopify_list_orders",
      {
        displayName: "List Orders",
        description: "List Shopify orders, optionally filtered by status, financial status, or fulfillment status.",
        parametersSchema: {
          type: "object",
          properties: {
            status: { type: "string", description: "Order status: open, closed, cancelled, any (default: any).", default: "any" },
            financial_status: { type: "string", description: "Financial status: pending, authorized, partially_paid, paid, partially_refunded, refunded, voided." },
            fulfillment_status: { type: "string", description: "Fulfillment status: shipped, partial, unshipped, unfulfilled." },
            limit: { type: "integer", description: "Max results (default 50, max 250).", default: 50 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { status?: string; financial_status?: string; fulfillment_status?: string; limit?: number };
          const result = await client.listOrders(p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "shopify_get_order",
      {
        displayName: "Get Order",
        description: "Get full details for a specific Shopify order by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "integer", description: "Shopify order ID." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { id: number };
          const result = await client.getOrder(p.id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "shopify_list_products",
      {
        displayName: "List Products",
        description: "List Shopify products, optionally filtered by status or title.",
        parametersSchema: {
          type: "object",
          properties: {
            status: { type: "string", description: "Product status: active, archived, draft." },
            title: { type: "string", description: "Filter by title (substring match)." },
            limit: { type: "integer", description: "Max results (default 50, max 250).", default: 50 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { status?: string; title?: string; limit?: number };
          const result = await client.listProducts(p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "shopify_get_product",
      {
        displayName: "Get Product",
        description: "Get full details for a specific Shopify product by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "integer", description: "Shopify product ID." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { id: number };
          const result = await client.getProduct(p.id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "shopify_update_product",
      {
        displayName: "Update Product",
        description: "Update a Shopify product (title, body_html, status, tags, etc.).",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "integer", description: "Shopify product ID." },
            title: { type: "string", description: "Product title." },
            body_html: { type: "string", description: "Product description (HTML)." },
            status: { type: "string", description: "Product status: active, archived, draft." },
            tags: { type: "string", description: "Comma-separated tags." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const { id, ...data } = params as { id: number } & Record<string, unknown>;
          const result = await client.updateProduct(id, data);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "shopify_list_customers",
      {
        displayName: "List Customers",
        description: "Search Shopify customers by name, email, or phone.",
        parametersSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query (name, email, phone)." },
            limit: { type: "integer", description: "Max results (default 50).", default: 50 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { query?: string; limit?: number };
          const result = await client.listCustomers(p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "shopify_get_customer",
      {
        displayName: "Get Customer",
        description: "Get full details for a specific Shopify customer by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "integer", description: "Shopify customer ID." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { id: number };
          const result = await client.getCustomer(p.id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "shopify_get_shop",
      {
        displayName: "Get Shop Info",
        description: "Get general information about the Shopify store (name, email, currency, plan, etc.).",
        parametersSchema: {
          type: "object",
          properties: {},
        },
      },
      async (): Promise<ToolResult> => {
        try {
          const result = await client.getShop();
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "shopify_list_locations",
      {
        displayName: "List Locations",
        description: "List all locations (warehouses, retail stores) for the Shopify store.",
        parametersSchema: {
          type: "object",
          properties: {},
        },
      },
      async (): Promise<ToolResult> => {
        try {
          const result = await client.listLocations();
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "shopify_list_price_rules",
      {
        displayName: "List Price Rules",
        description: "List Shopify price rules (discount rule definitions).",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Max results (default 50).", default: 50 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const p = params as { limit?: number };
          const result = await client.listPriceRules(p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );
  },
});

runWorker(plugin, import.meta.url);
