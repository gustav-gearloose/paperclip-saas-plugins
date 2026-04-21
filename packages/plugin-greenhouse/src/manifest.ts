import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.greenhouse",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Greenhouse",
  description: "ATS/recruitment platform — jobs, candidates, applications, departments, offices, users, and job stages.",
  author: "Gearloose",
  categories: ["connector"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "instance.settings.register",
  ],
  instanceConfigSchema: {
    onBehalfOfUserId: {
      type: "string",
      description: "Greenhouse user ID to act on behalf of for write operations (required for creating candidates).",
    },
    apiKeyRef: {
      type: "string",
      format: "secret-ref",
      description: "Greenhouse Harvest API key (Configure → Dev Center → API Credential Management).",
    },
  },
  entrypoints: {
    worker: "./worker.js",
  },
  tools: [
    {
      name: "greenhouse_list_jobs",
      displayName: "List Jobs",
      description: "List job postings in the Greenhouse account, optionally filtered by status, department, or office.",
      parametersSchema: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by job status: 'open', 'closed', or 'draft' (optional)." },
          department_id: { type: "number", description: "Filter by department ID (optional)." },
          office_id: { type: "number", description: "Filter by office ID (optional)." },
          per_page: { type: "number", description: "Number of results per page (max 500)." },
          page: { type: "number", description: "Page number for pagination." },
        },
      },
    },
    {
      name: "greenhouse_get_job",
      displayName: "Get Job",
      description: "Get full details of a single job posting by its Greenhouse job ID.",
      parametersSchema: {
        type: "object",
        properties: {
          jobId: { type: "number", description: "Greenhouse job ID." },
        },
        required: ["jobId"],
      },
    },
    {
      name: "greenhouse_list_candidates",
      displayName: "List Candidates",
      description: "List candidates in the Greenhouse account, optionally filtered by job.",
      parametersSchema: {
        type: "object",
        properties: {
          job_id: { type: "number", description: "Filter candidates by job ID (optional)." },
          per_page: { type: "number", description: "Number of results per page (max 500)." },
          page: { type: "number", description: "Page number for pagination." },
        },
      },
    },
    {
      name: "greenhouse_get_candidate",
      displayName: "Get Candidate",
      description: "Get full profile for a single candidate by their Greenhouse candidate ID.",
      parametersSchema: {
        type: "object",
        properties: {
          candidateId: { type: "number", description: "Greenhouse candidate ID." },
        },
        required: ["candidateId"],
      },
    },
    {
      name: "greenhouse_create_candidate",
      displayName: "Create Candidate",
      description: "Create a new candidate in Greenhouse. Requires onBehalfOfUserId to be configured.",
      parametersSchema: {
        type: "object",
        properties: {
          first_name: { type: "string", description: "Candidate first name." },
          last_name: { type: "string", description: "Candidate last name." },
          email: { type: "string", description: "Candidate email address." },
          phone: { type: "string", description: "Candidate phone number (optional)." },
          title: { type: "string", description: "Candidate current job title (optional)." },
          company: { type: "string", description: "Candidate current company (optional)." },
        },
        required: ["first_name", "last_name"],
      },
    },
    {
      name: "greenhouse_list_applications",
      displayName: "List Applications",
      description: "List job applications, optionally filtered by job or candidate.",
      parametersSchema: {
        type: "object",
        properties: {
          job_id: { type: "number", description: "Filter by job ID (optional)." },
          candidate_id: { type: "number", description: "Filter by candidate ID (optional)." },
          per_page: { type: "number", description: "Number of results per page (max 500)." },
          page: { type: "number", description: "Page number for pagination." },
        },
      },
    },
    {
      name: "greenhouse_list_departments",
      displayName: "List Departments",
      description: "List all departments configured in the Greenhouse account.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "greenhouse_list_offices",
      displayName: "List Offices",
      description: "List all office locations configured in the Greenhouse account.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "greenhouse_list_users",
      displayName: "List Users",
      description: "List all users (recruiters, hiring managers) in the Greenhouse account.",
      parametersSchema: {
        type: "object",
        properties: {
          per_page: { type: "number", description: "Number of results per page (max 500)." },
          page: { type: "number", description: "Page number for pagination." },
        },
      },
    },
    {
      name: "greenhouse_list_job_stages",
      displayName: "List Job Stages",
      description: "List all pipeline stages for a specific job.",
      parametersSchema: {
        type: "object",
        properties: {
          jobId: { type: "number", description: "Greenhouse job ID." },
        },
        required: ["jobId"],
      },
    },
  ],
};

export default manifest;
