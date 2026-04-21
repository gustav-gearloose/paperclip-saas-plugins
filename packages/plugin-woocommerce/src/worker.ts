import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { WooCommerceClient } from "./woocommerce-client.js";

interface WooPluginConfig {
  siteUrl?: string;
  consumerKeyRef?: string;
  consumerSecretRef?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    let cachedClient: WooCommerceClient | null = null;
    let configError: string | null = null;

    async function getClient(): Promise<WooCommerceClient | null> {
      if (cachedClient) return cachedClient;
      if (configError) return null;

const config = await ctx.config.get() as WooPluginConfig;

      if (!config.siteUrl) {
        configError = "WooCommerce plugin: siteUrl is required";
        ctx.logger.warn("config missing");
        return null;
      }
      if (!config.consumerKeyRef) {
        configError = "WooCommerce plugin: consumerKeyRef is required";
        ctx.logger.warn("config missing");
        return null;
      }
      if (!config.consumerSecretRef) {
        configError = "WooCommerce plugin: consumerSecretRef is required";
        ctx.logger.warn("config missing");
        return null;
      }

      let consumerKey: string;
      let consumerSecret: string;
      try {
        consumerKey = await ctx.secrets.resolve(config.consumerKeyRef);
        consumerSecret = await ctx.secrets.resolve(config.consumerSecretRef);
      } catch (err) {
        configError = `WooCommerce plugin: failed to resolve secrets: ${err instanceof Error ? err.message : String(err)}`;
        ctx.logger.warn("config missing");
        return null;
      }

      ctx.logger.info("WooCommerce plugin: secrets resolved, registering tools");
      cachedClient = new WooCommerceClient(config.siteUrl, consumerKey, consumerSecret);
      return cachedClient;
    }

    ctx.tools.register(
      "woocommerce_list_orders",
      {
        displayName: "List Orders",
        description: "List WooCommerce orders, optionally filtered by status or customer.",
        parametersSchema: {
          type: "object",
          properties: {
            status: { type: "string", description: "Filter by order status: pending, processing, on-hold, completed, cancelled, refunded, failed, trash, any." },
            customer: { type: "integer", description: "Filter by customer ID." },
            per_page: { type: "integer", description: "Results per page (default 20).", default: 20 },
            page: { type: "integer", description: "Page number (default 1).", default: 1 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { status?: string; customer?: number; per_page?: number; page?: number };
          const result = await client.listOrders(p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "woocommerce_get_order",
      {
        displayName: "Get Order",
        description: "Get full details for a specific WooCommerce order by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "integer", description: "Order ID." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { id: number };
          const result = await client.getOrder(p.id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "woocommerce_update_order_status",
      {
        displayName: "Update Order Status",
        description: "Update the status of a WooCommerce order.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "integer", description: "Order ID." },
            status: { type: "string", description: "New status: pending, processing, on-hold, completed, cancelled, refunded, failed." },
          },
          required: ["id", "status"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { id: number; status: string };
          const result = await client.updateOrderStatus(p.id, p.status);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "woocommerce_list_products",
      {
        displayName: "List Products",
        description: "List WooCommerce products, optionally filtered by status, category, or search term.",
        parametersSchema: {
          type: "object",
          properties: {
            status: { type: "string", description: "Filter by status: draft, pending, private, publish, any." },
            search: { type: "string", description: "Search term to filter products." },
            category: { type: "string", description: "Filter by category ID." },
            per_page: { type: "integer", description: "Results per page (default 20).", default: 20 },
            page: { type: "integer", description: "Page number (default 1).", default: 1 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { status?: string; search?: string; category?: string; per_page?: number; page?: number };
          const result = await client.listProducts(p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "woocommerce_get_product",
      {
        displayName: "Get Product",
        description: "Get full details for a specific WooCommerce product by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "integer", description: "Product ID." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { id: number };
          const result = await client.getProduct(p.id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "woocommerce_update_product",
      {
        displayName: "Update Product",
        description: "Update a WooCommerce product (price, stock, description, etc.).",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "integer", description: "Product ID." },
            name: { type: "string", description: "Product name." },
            regular_price: { type: "string", description: "Regular price as a string, e.g. '29.99'." },
            sale_price: { type: "string", description: "Sale price as a string." },
            description: { type: "string", description: "Full product description (HTML allowed)." },
            short_description: { type: "string", description: "Short product description." },
            stock_quantity: { type: "integer", description: "Stock quantity." },
            manage_stock: { type: "boolean", description: "Whether to manage stock." },
            status: { type: "string", description: "Product status: draft, pending, private, publish." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const { id, ...data } = params as { id: number } & Record<string, unknown>;
          const result = await client.updateProduct(id, data);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "woocommerce_list_customers",
      {
        displayName: "List Customers",
        description: "List WooCommerce customers, optionally filtered by search or email.",
        parametersSchema: {
          type: "object",
          properties: {
            search: { type: "string", description: "Search by name or email." },
            email: { type: "string", description: "Filter by exact email address." },
            per_page: { type: "integer", description: "Results per page (default 20).", default: 20 },
            page: { type: "integer", description: "Page number (default 1).", default: 1 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { search?: string; email?: string; per_page?: number; page?: number };
          const result = await client.listCustomers(p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "woocommerce_get_customer",
      {
        displayName: "Get Customer",
        description: "Get full details for a specific WooCommerce customer by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            id: { type: "integer", description: "Customer ID." },
          },
          required: ["id"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { id: number };
          const result = await client.getCustomer(p.id);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "woocommerce_list_coupons",
      {
        displayName: "List Coupons",
        description: "List WooCommerce discount coupons.",
        parametersSchema: {
          type: "object",
          properties: {
            search: { type: "string", description: "Search coupon codes." },
            per_page: { type: "integer", description: "Results per page (default 20).", default: 20 },
            page: { type: "integer", description: "Page number (default 1).", default: 1 },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { search?: string; per_page?: number; page?: number };
          const result = await client.listCoupons(p);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );

    ctx.tools.register(
      "woocommerce_get_report",
      {
        displayName: "Get Report",
        description: "Get a WooCommerce sales or totals report.",
        parametersSchema: {
          type: "object",
          properties: {
            report: {
              type: "string",
              description: "Report type: sales, top_sellers, orders/totals, products/totals, customers/totals.",
              enum: ["sales", "top_sellers", "orders/totals", "products/totals", "customers/totals"],
            },
          },
          required: ["report"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as { report: "sales" | "top_sellers" | "orders/totals" | "products/totals" | "customers/totals" };
          const result = await client.getReports(p.report);
          return { content: JSON.stringify(result, null, 2) };
        } catch (err) { return errResult(err); }
      }
    );
  },
});

runWorker(plugin, import.meta.url);
