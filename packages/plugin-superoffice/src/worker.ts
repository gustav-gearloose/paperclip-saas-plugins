import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { SuperOfficeClient } from "./superoffice-client.js";

interface SuperOfficeConfig {
  clientIdRef?: string;
  clientSecretRef?: string;
  refreshTokenRef?: string;
  tenantId?: string;
}

function errResult(err: unknown): ToolResult {
  return { error: err instanceof Error ? err.message : String(err) };
}

const plugin = definePlugin({
  async setup(ctx) {
    let cachedClient: SuperOfficeClient | null = null;
    let configError: string | null = null;

    async function getClient(): Promise<SuperOfficeClient | null> {
      if (cachedClient) return cachedClient;
      if (configError) return null;

const config = await ctx.config.get() as SuperOfficeConfig;
      const { clientIdRef, clientSecretRef, refreshTokenRef, tenantId } = config;

      if (!clientIdRef || !clientSecretRef || !refreshTokenRef || !tenantId) {
        configError = "superoffice plugin: clientIdRef, clientSecretRef, refreshTokenRef, and tenantId are required";
        ctx.logger.warn("config missing");
        return null;
      }

      let clientId: string, clientSecret: string, refreshToken: string;
      try {
        [clientId, clientSecret, refreshToken] = await Promise.all([
          ctx.secrets.resolve(clientIdRef),
          ctx.secrets.resolve(clientSecretRef),
          ctx.secrets.resolve(refreshTokenRef),
        ]);
      } catch (err) {
        configError = `superoffice plugin: failed to resolve secrets: ${err instanceof Error ? err.message : String(err)}`;
        ctx.logger.warn("config missing");
        return null;
      }

      cachedClient = new SuperOfficeClient(clientId, clientSecret, refreshToken, tenantId);
      return cachedClient;

      ctx.logger.info("superoffice plugin: registering tools");
    }

    ctx.tools.register(
      "superoffice_list_contacts",
      {
        displayName: "List Contacts",
        description: "List SuperOffice company contacts.",
        parametersSchema: {
          type: "object",
          properties: {
            top: { type: "number", description: "Max results to return (default 25)." },
            skip: { type: "number", description: "Number of results to skip for pagination (default 0)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          return { content: JSON.stringify(await client.listContacts(p.top as number ?? 25, p.skip as number ?? 0), null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "superoffice_get_contact",
      {
        displayName: "Get Contact",
        description: "Get a single SuperOffice contact (company) by ID.",
        parametersSchema: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Contact ID." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          return { content: JSON.stringify(await client.getContact(p.id as string), null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "superoffice_create_contact",
      {
        displayName: "Create Contact",
        description: "Create a new SuperOffice company contact.",
        parametersSchema: {
          type: "object",
          required: ["Name"],
          properties: {
            Name: { type: "string", description: "Company name." },
            Department: { type: "string", description: "Department name." },
            Phone: { type: "string", description: "Main phone number." },
            Email: { type: "string", description: "Main email address." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          return { content: JSON.stringify(await client.createContact({ Name: p.Name as string, Department: p.Department as string | undefined, Phone: p.Phone as string | undefined, Email: p.Email as string | undefined }), null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "superoffice_list_persons",
      {
        displayName: "List Persons",
        description: "List SuperOffice persons (individual contacts).",
        parametersSchema: {
          type: "object",
          properties: {
            top: { type: "number", description: "Max results to return (default 25)." },
            skip: { type: "number", description: "Number of results to skip for pagination (default 0)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          return { content: JSON.stringify(await client.listPersons(p.top as number ?? 25, p.skip as number ?? 0), null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "superoffice_get_person",
      {
        displayName: "Get Person",
        description: "Get a single SuperOffice person by ID.",
        parametersSchema: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Person ID." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          return { content: JSON.stringify(await client.getPerson(p.id as string), null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "superoffice_create_person",
      {
        displayName: "Create Person",
        description: "Create a new SuperOffice person.",
        parametersSchema: {
          type: "object",
          required: ["Firstname", "Lastname"],
          properties: {
            Firstname: { type: "string", description: "First name." },
            Lastname: { type: "string", description: "Last name." },
            ContactId: { type: "number", description: "ID of the company contact to associate this person with." },
            Email: { type: "string", description: "Email address." },
            Phone: { type: "string", description: "Phone number." },
            Title: { type: "string", description: "Job title." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          return { content: JSON.stringify(await client.createPerson({ Firstname: p.Firstname as string, Lastname: p.Lastname as string, ContactId: p.ContactId as number | undefined, Email: p.Email as string | undefined, Phone: p.Phone as string | undefined, Title: p.Title as string | undefined }), null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "superoffice_list_sales",
      {
        displayName: "List Sales",
        description: "List SuperOffice sales opportunities.",
        parametersSchema: {
          type: "object",
          properties: {
            top: { type: "number", description: "Max results to return (default 25)." },
            skip: { type: "number", description: "Number of results to skip for pagination (default 0)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          return { content: JSON.stringify(await client.listSales(p.top as number ?? 25, p.skip as number ?? 0), null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "superoffice_get_sale",
      {
        displayName: "Get Sale",
        description: "Get a single SuperOffice sale by ID.",
        parametersSchema: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Sale ID." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          return { content: JSON.stringify(await client.getSale(p.id as string), null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "superoffice_create_sale",
      {
        displayName: "Create Sale",
        description: "Create a new SuperOffice sale opportunity.",
        parametersSchema: {
          type: "object",
          required: ["Heading"],
          properties: {
            Heading: { type: "string", description: "Sale title/heading." },
            ContactId: { type: "number", description: "Associated contact (company) ID." },
            Amount: { type: "number", description: "Sale amount." },
            SaleDate: { type: "string", description: "Expected close date YYYY-MM-DD." },
            Status: { type: "string", description: "Sale status (e.g. Open, Sold, Lost)." },
            Description: { type: "string", description: "Sale description." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          return { content: JSON.stringify(await client.createSale({ Heading: p.Heading as string, ContactId: p.ContactId as number | undefined, Amount: p.Amount as number | undefined, SaleDate: p.SaleDate as string | undefined, Status: p.Status as string | undefined, Description: p.Description as string | undefined }), null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "superoffice_list_appointments",
      {
        displayName: "List Appointments",
        description: "List SuperOffice appointments and activities.",
        parametersSchema: {
          type: "object",
          properties: {
            top: { type: "number", description: "Max results to return (default 25)." },
            skip: { type: "number", description: "Number of results to skip for pagination (default 0)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          return { content: JSON.stringify(await client.listAppointments(p.top as number ?? 25, p.skip as number ?? 0), null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "superoffice_get_appointment",
      {
        displayName: "Get Appointment",
        description: "Get a single SuperOffice appointment by ID.",
        parametersSchema: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Appointment ID." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          return { content: JSON.stringify(await client.getAppointment(p.id as string), null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "superoffice_create_appointment",
      {
        displayName: "Create Appointment",
        description: "Create a new SuperOffice appointment or activity.",
        parametersSchema: {
          type: "object",
          properties: {
            ContactId: { type: "number", description: "Associated contact (company) ID." },
            AppointmentText: { type: "string", description: "Appointment description or agenda." },
            StartDate: { type: "string", description: "Start date/time ISO 8601." },
            EndDate: { type: "string", description: "End date/time ISO 8601." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          return { content: JSON.stringify(await client.createAppointment({ ContactId: p.ContactId as number | undefined, AppointmentText: p.AppointmentText as string | undefined, StartDate: p.StartDate as string | undefined, EndDate: p.EndDate as string | undefined }), null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "superoffice_list_projects",
      {
        displayName: "List Projects",
        description: "List SuperOffice projects.",
        parametersSchema: {
          type: "object",
          properties: {
            top: { type: "number", description: "Max results to return (default 25)." },
            skip: { type: "number", description: "Number of results to skip for pagination (default 0)." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          return { content: JSON.stringify(await client.listProjects(p.top as number ?? 25, p.skip as number ?? 0), null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "superoffice_get_project",
      {
        displayName: "Get Project",
        description: "Get a single SuperOffice project by ID.",
        parametersSchema: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Project ID." },
          },
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          const p = params as Record<string, unknown>;
          return { content: JSON.stringify(await client.getProject(p.id as string), null, 2) };
        } catch (err) { return errResult(err); }
      },
    );

    ctx.tools.register(
      "superoffice_get_current_user",
      {
        displayName: "Get Current User",
        description: "Get the currently authenticated SuperOffice user (identity check).",
        parametersSchema: { type: "object", properties: {} },
      },
      async (): Promise<ToolResult> => {
        try {
          const client = await getClient();
          if (!client) return { error: configError ?? "Plugin not configured." };
          return { content: JSON.stringify(await client.getCurrentUser(), null, 2) };
        } catch (err) { return errResult(err); }
      },
    );
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
