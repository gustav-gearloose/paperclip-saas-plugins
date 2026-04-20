import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "gearloose.recruitee",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Recruitee",
  description: "ATS/recruitment platform — jobs, candidates, pipelines, members, and tags.",
  author: "Gearloose",
  categories: ["connector"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "instance.settings.register",
  ],
  instanceConfigSchema: {
    companyId: {
      type: "string",
      description: "Recruitee company ID (found in your account URL or API settings).",
    },
    apiTokenRef: {
      type: "string",
      format: "secret-ref",
      description: "Recruitee Personal API Token (Settings → Apps and plugins → Personal API tokens).",
    },
  },
  entrypoints: {
    worker: "./worker.js",
  },
  tools: [
    {
      name: "recruitee_list_offers",
      displayName: "List Job Offers",
      description: "List all job offers/postings in the company.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max results to return." },
          offset: { type: "number", description: "Pagination offset." },
        },
      },
    },
    {
      name: "recruitee_get_offer",
      displayName: "Get Job Offer",
      description: "Get details of a single job offer by ID.",
      parametersSchema: {
        type: "object",
        properties: {
          offerId: { type: "number", description: "Recruitee offer/job ID." },
        },
        required: ["offerId"],
      },
    },
    {
      name: "recruitee_list_candidates",
      displayName: "List Candidates",
      description: "List all candidates with optional pagination.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max results to return." },
          offset: { type: "number", description: "Pagination offset." },
        },
      },
    },
    {
      name: "recruitee_get_candidate",
      displayName: "Get Candidate",
      description: "Get full profile for a single candidate by ID.",
      parametersSchema: {
        type: "object",
        properties: {
          candidateId: { type: "number", description: "Recruitee candidate ID." },
        },
        required: ["candidateId"],
      },
    },
    {
      name: "recruitee_search_candidates",
      displayName: "Search Candidates",
      description: "Search candidates by name, email, or keyword.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query (name, email, keyword)." },
          limit: { type: "number", description: "Max results to return." },
          offset: { type: "number", description: "Pagination offset." },
        },
        required: ["query"],
      },
    },
    {
      name: "recruitee_list_candidates_for_offer",
      displayName: "List Candidates for Job",
      description: "List all candidates who applied to a specific job offer.",
      parametersSchema: {
        type: "object",
        properties: {
          offerSlug: { type: "string", description: "Offer slug (from the offer URL or listing)." },
        },
        required: ["offerSlug"],
      },
    },
    {
      name: "recruitee_create_candidate",
      displayName: "Create Candidate",
      description: "Add a new candidate application to a job offer.",
      parametersSchema: {
        type: "object",
        properties: {
          offerSlug: { type: "string", description: "Offer slug to apply the candidate to." },
          name: { type: "string", description: "Candidate full name." },
          email: { type: "string", description: "Candidate email address." },
          phone: { type: "string", description: "Candidate phone number (optional)." },
        },
        required: ["offerSlug", "name", "email"],
      },
    },
    {
      name: "recruitee_list_pipelines",
      displayName: "List Pipelines",
      description: "List all hiring pipelines and their stages.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "recruitee_list_members",
      displayName: "List Team Members",
      description: "List all team members/recruiters in the company account.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "recruitee_list_tags",
      displayName: "List Tags",
      description: "List all tags used for candidate labelling.",
      parametersSchema: { type: "object", properties: {} },
    },
  ],
};

export default manifest;
