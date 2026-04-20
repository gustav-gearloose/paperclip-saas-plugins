import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.shopify",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Shopify",
  description: "Access Shopify store data: orders, products, customers, inventory, locations, and discount codes.",
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
      shopDomain: {
        type: "string",
        title: "Shop Domain",
        description: "Your Shopify store domain, e.g. mystore.myshopify.com",
        default: "",
      },
      accessTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "Access Token (secret ref)",
        description: "UUID of a Paperclip secret holding your Shopify Admin API access token.",
        default: "",
      },
    },
    required: ["shopDomain", "accessTokenRef"],
  },
  tools: [
    {
      name: "shopify_list_orders",
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
    {
      name: "shopify_get_order",
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
    {
      name: "shopify_list_products",
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
    {
      name: "shopify_get_product",
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
    {
      name: "shopify_update_product",
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
    {
      name: "shopify_list_customers",
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
    {
      name: "shopify_get_customer",
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
    {
      name: "shopify_get_shop",
      displayName: "Get Shop Info",
      description: "Get general information about the Shopify store (name, email, currency, plan, etc.).",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "shopify_list_locations",
      displayName: "List Locations",
      description: "List all locations (warehouses, retail stores) for the Shopify store.",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "shopify_list_price_rules",
      displayName: "List Price Rules",
      description: "List Shopify price rules (discount rule definitions).",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Max results (default 50).", default: 50 },
        },
      },
    },
  ],
};

export default manifest;
