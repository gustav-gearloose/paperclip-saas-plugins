import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.workable",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Workable",
  description: "ATS/recruitment platform — jobs, candidates, members, stages, departments, locations, and requisitions.",
  author: "Gearloose",
  categories: ["connector"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "instance.settings.register",
  ],
  instanceConfigSchema: {
    subdomain: {
      type: "string",
      description: "Your Workable subdomain (e.g. 'acmecorp' from acmecorp.workable.com).",
    },
    accessTokenRef: {
      type: "string",
      format: "secret-ref",
      description: "Workable API access token (Settings → Integrations → API Access Tokens).",
    },
  },
  entrypoints: {
    worker: "./worker.js",
  },
  tools: [
    {
      name: "workable_list_jobs",
      displayName: "List Jobs",
      description: "List job postings in the Workable account, optionally filtered by state.",
      parametersSchema: {
        type: "object",
        properties: {
          state: { type: "string", description: "Filter by job state: 'published', 'draft', 'closed', or 'archived' (optional)." },
          limit: { type: "number", description: "Max results to return." },
          offset: { type: "number", description: "Pagination offset." },
        },
      },
    },
    {
      name: "workable_get_job",
      displayName: "Get Job",
      description: "Get details of a single job posting by its shortcode.",
      parametersSchema: {
        type: "object",
        properties: {
          shortcode: { type: "string", description: "Workable job shortcode (e.g. 'ACME123')." },
        },
        required: ["shortcode"],
      },
    },
    {
      name: "workable_list_candidates",
      displayName: "List Candidates",
      description: "List candidates, optionally scoped to a specific job by shortcode.",
      parametersSchema: {
        type: "object",
        properties: {
          jobShortcode: { type: "string", description: "Scope results to this job's shortcode (optional)." },
          limit: { type: "number", description: "Max results to return." },
          since_id: { type: "string", description: "Return candidates with ID greater than this value (cursor pagination)." },
          max_id: { type: "string", description: "Return candidates with ID less than this value (cursor pagination)." },
        },
      },
    },
    {
      name: "workable_get_candidate",
      displayName: "Get Candidate",
      description: "Get full profile for a single candidate by ID.",
      parametersSchema: {
        type: "object",
        properties: {
          candidateId: { type: "string", description: "Workable candidate ID." },
        },
        required: ["candidateId"],
      },
    },
    {
      name: "workable_create_candidate",
      displayName: "Create Candidate",
      description: "Create a new candidate application for a specific job.",
      parametersSchema: {
        type: "object",
        properties: {
          jobShortcode: { type: "string", description: "Shortcode of the job to apply the candidate to." },
          name: { type: "string", description: "Candidate full name." },
          email: { type: "string", description: "Candidate email address." },
          phone: { type: "string", description: "Candidate phone number (optional)." },
          summary: { type: "string", description: "Short candidate summary or cover note (optional)." },
        },
        required: ["jobShortcode", "name", "email"],
      },
    },
    {
      name: "workable_list_members",
      displayName: "List Members",
      description: "List all team members (recruiters, hiring managers) in the account.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max results to return." },
          offset: { type: "number", description: "Pagination offset." },
        },
      },
    },
    {
      name: "workable_list_departments",
      displayName: "List Departments",
      description: "List all departments configured in the Workable account.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "workable_list_locations",
      displayName: "List Locations",
      description: "List all office locations configured in the Workable account.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "workable_list_stages",
      displayName: "List Stages",
      description: "List all pipeline stages available in the Workable account.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "workable_list_requisitions",
      displayName: "List Requisitions",
      description: "List job requisitions (hiring requests) in the Workable account.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max results to return." },
          offset: { type: "number", description: "Pagination offset." },
        },
      },
    },
  ],
};

export default manifest;
