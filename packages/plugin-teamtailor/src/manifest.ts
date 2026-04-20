import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.teamtailor",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Teamtailor",
  description: "ATS/recruitment platform — jobs, candidates, applications, stages, departments, locations, and users.",
  author: "Gearloose",
  categories: ["connector"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "instance.settings.register",
  ],
  instanceConfigSchema: {
    apiKeyRef: {
      type: "string",
      format: "secret-ref",
      description: "Teamtailor API key (Settings → Integrations → API keys — use Admin type for full access).",
    },
  },
  entrypoints: {
    worker: "./worker.js",
  },
  tools: [
    {
      name: "teamtailor_list_jobs",
      displayName: "List Jobs",
      description: "List all job postings in the Teamtailor account.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max results per page (page size)." },
          page: { type: "number", description: "Page number for pagination." },
        },
      },
    },
    {
      name: "teamtailor_get_job",
      displayName: "Get Job",
      description: "Get details of a single job posting by ID.",
      parametersSchema: {
        type: "object",
        properties: {
          jobId: { type: "number", description: "Teamtailor job ID." },
        },
        required: ["jobId"],
      },
    },
    {
      name: "teamtailor_list_candidates",
      displayName: "List Candidates",
      description: "List all candidates in the account with optional pagination.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max results per page (page size)." },
          page: { type: "number", description: "Page number for pagination." },
        },
      },
    },
    {
      name: "teamtailor_get_candidate",
      displayName: "Get Candidate",
      description: "Get full profile for a single candidate by ID.",
      parametersSchema: {
        type: "object",
        properties: {
          candidateId: { type: "number", description: "Teamtailor candidate ID." },
        },
        required: ["candidateId"],
      },
    },
    {
      name: "teamtailor_create_candidate",
      displayName: "Create Candidate",
      description: "Create a new candidate record in Teamtailor.",
      parametersSchema: {
        type: "object",
        properties: {
          firstName: { type: "string", description: "Candidate first name." },
          lastName: { type: "string", description: "Candidate last name." },
          email: { type: "string", description: "Candidate email address." },
          phone: { type: "string", description: "Candidate phone number (optional)." },
          pitch: { type: "string", description: "Short personal pitch or cover note (optional)." },
        },
        required: ["firstName", "lastName", "email"],
      },
    },
    {
      name: "teamtailor_list_job_applications",
      displayName: "List Job Applications",
      description: "List job applications, optionally filtered by job ID.",
      parametersSchema: {
        type: "object",
        properties: {
          jobId: { type: "number", description: "Filter applications by this job ID (optional)." },
          limit: { type: "number", description: "Max results per page (page size)." },
          page: { type: "number", description: "Page number for pagination." },
        },
      },
    },
    {
      name: "teamtailor_list_departments",
      displayName: "List Departments",
      description: "List all departments in the Teamtailor account.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "teamtailor_list_locations",
      displayName: "List Locations",
      description: "List all office locations configured in the Teamtailor account.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "teamtailor_list_users",
      displayName: "List Users",
      description: "List all users (recruiters and hiring managers) in the account.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max results per page (page size)." },
          page: { type: "number", description: "Page number for pagination." },
        },
      },
    },
    {
      name: "teamtailor_list_stages",
      displayName: "List Stages",
      description: "List all pipeline stages available in the Teamtailor account.",
      parametersSchema: { type: "object", properties: {} },
    },
  ],
};

export default manifest;
