import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.superoffice",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "SuperOffice CRM",
  description: "Connect to SuperOffice Online — contacts, persons, sales, appointments, and projects.",
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
    required: ["clientIdRef", "clientSecretRef", "refreshTokenRef"],
    properties: {
      clientIdRef: {
        type: "string",
        format: "secret-ref",
        title: "SuperOffice Client ID (secret ref)",
        description: "UUID of a Paperclip secret holding your SuperOffice OAuth2 client ID.",
        default: "",
      },
      clientSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "SuperOffice Client Secret (secret ref)",
        description: "UUID of a Paperclip secret holding your SuperOffice OAuth2 client secret.",
        default: "",
      },
      refreshTokenRef: {
        type: "string",
        format: "secret-ref",
        title: "SuperOffice Refresh Token (secret ref)",
        description: "UUID of a Paperclip secret holding your SuperOffice OAuth2 refresh token.",
        default: "",
      },
      tenantId: {
        type: "string",
        title: "SuperOffice Tenant ID",
        description: "Your SuperOffice Online customer context ID, e.g. Cust12345.",
        default: "",
      },
    },
  },
  tools: [
    {
      name: "superoffice_list_contacts",
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
    {
      name: "superoffice_get_contact",
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
    {
      name: "superoffice_create_contact",
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
    {
      name: "superoffice_list_persons",
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
    {
      name: "superoffice_get_person",
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
    {
      name: "superoffice_create_person",
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
    {
      name: "superoffice_list_sales",
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
    {
      name: "superoffice_get_sale",
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
    {
      name: "superoffice_create_sale",
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
    {
      name: "superoffice_list_appointments",
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
    {
      name: "superoffice_get_appointment",
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
    {
      name: "superoffice_create_appointment",
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
    {
      name: "superoffice_list_projects",
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
    {
      name: "superoffice_get_project",
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
    {
      name: "superoffice_get_current_user",
      displayName: "Get Current User",
      description: "Get the currently authenticated SuperOffice user (identity check).",
      parametersSchema: { type: "object", properties: {} },
    },
  ],
};

export default manifest;
