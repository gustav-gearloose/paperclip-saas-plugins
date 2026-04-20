import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.woocommerce",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "WooCommerce",
  description: "Access WooCommerce store data: orders, products, customers, coupons, and sales reports.",
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
      siteUrl: {
        type: "string",
        title: "Store URL",
        description: "Your WooCommerce store URL, e.g. https://myshop.com",
        default: "",
      },
      consumerKeyRef: {
        type: "string",
        format: "secret-ref",
        title: "Consumer Key (secret ref)",
        description: "UUID of a Paperclip secret holding your WooCommerce REST API Consumer Key.",
        default: "",
      },
      consumerSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "Consumer Secret (secret ref)",
        description: "UUID of a Paperclip secret holding your WooCommerce REST API Consumer Secret.",
        default: "",
      },
    },
    required: ["siteUrl", "consumerKeyRef", "consumerSecretRef"],
  },
  tools: [
    {
      name: "woocommerce_list_orders",
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
    {
      name: "woocommerce_get_order",
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
    {
      name: "woocommerce_update_order_status",
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
    {
      name: "woocommerce_list_products",
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
    {
      name: "woocommerce_get_product",
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
    {
      name: "woocommerce_update_product",
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
    {
      name: "woocommerce_list_customers",
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
    {
      name: "woocommerce_get_customer",
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
    {
      name: "woocommerce_list_coupons",
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
    {
      name: "woocommerce_get_report",
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
  ],
};

export default manifest;
