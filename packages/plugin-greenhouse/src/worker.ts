import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { GreenhouseClient } from "./greenhouse-client.js";

interface GreenhouseConfig {
  onBehalfOfUserId?: string;
  apiKeyRef?: string;
}

function errResult(e: unknown): ToolResult {
  return { error: e instanceof Error ? e.message : String(e) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const cfg = await ctx.config.get() as GreenhouseConfig;
    const apiKey = await ctx.secrets.resolve(cfg.apiKeyRef ?? "");
    const client = new GreenhouseClient(apiKey, cfg.onBehalfOfUserId ?? "");

    ctx.tools.register(
      "greenhouse_list_jobs",
      { displayName: "List Jobs", description: "List job postings in the Greenhouse account, optionally filtered by status, department, or office.", parametersSchema: { type: "object", properties: { status: { type: "string", description: "Filter by job status: 'open', 'closed', or 'draft' (optional)." }, department_id: { type: "number", description: "Filter by department ID (optional)." }, office_id: { type: "number", description: "Filter by office ID (optional)." }, per_page: { type: "number", description: "Number of results per page (max 500)." }, page: { type: "number", description: "Page number for pagination." } } } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = (params ?? {}) as { status?: string; department_id?: number; office_id?: number; per_page?: number; page?: number };
          return { content: JSON.stringify(await client.listJobs(p)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "greenhouse_get_job",
      { displayName: "Get Job", description: "Get full details of a single job posting by its Greenhouse job ID.", parametersSchema: { type: "object", properties: { jobId: { type: "number", description: "Greenhouse job ID." } }, required: ["jobId"] } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const { jobId } = params as { jobId: number };
          return { content: JSON.stringify(await client.getJob(jobId)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "greenhouse_list_candidates",
      { displayName: "List Candidates", description: "List candidates in the Greenhouse account, optionally filtered by job.", parametersSchema: { type: "object", properties: { job_id: { type: "number", description: "Filter candidates by job ID (optional)." }, per_page: { type: "number", description: "Number of results per page (max 500)." }, page: { type: "number", description: "Page number for pagination." } } } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = (params ?? {}) as { job_id?: number; per_page?: number; page?: number };
          return { content: JSON.stringify(await client.listCandidates(p)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "greenhouse_get_candidate",
      { displayName: "Get Candidate", description: "Get full profile for a single candidate by their Greenhouse candidate ID.", parametersSchema: { type: "object", properties: { candidateId: { type: "number", description: "Greenhouse candidate ID." } }, required: ["candidateId"] } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const { candidateId } = params as { candidateId: number };
          return { content: JSON.stringify(await client.getCandidate(candidateId)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "greenhouse_create_candidate",
      { displayName: "Create Candidate", description: "Create a new candidate in Greenhouse. Requires onBehalfOfUserId to be configured.", parametersSchema: { type: "object", properties: { first_name: { type: "string", description: "Candidate first name." }, last_name: { type: "string", description: "Candidate last name." }, email: { type: "string", description: "Candidate email address." }, phone: { type: "string", description: "Candidate phone number (optional)." }, title: { type: "string", description: "Candidate current job title (optional)." }, company: { type: "string", description: "Candidate current company (optional)." } }, required: ["first_name", "last_name"] } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          return { content: JSON.stringify(await client.createCandidate(params as Record<string, unknown>)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "greenhouse_list_applications",
      { displayName: "List Applications", description: "List job applications, optionally filtered by job or candidate.", parametersSchema: { type: "object", properties: { job_id: { type: "number", description: "Filter by job ID (optional)." }, candidate_id: { type: "number", description: "Filter by candidate ID (optional)." }, per_page: { type: "number", description: "Number of results per page (max 500)." }, page: { type: "number", description: "Page number for pagination." } } } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = (params ?? {}) as { job_id?: number; candidate_id?: number; per_page?: number; page?: number };
          return { content: JSON.stringify(await client.listApplications(p)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "greenhouse_list_departments",
      { displayName: "List Departments", description: "List all departments configured in the Greenhouse account.", parametersSchema: { type: "object", properties: {} } },
      async (): Promise<ToolResult> => {
        try {
          return { content: JSON.stringify(await client.listDepartments()) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "greenhouse_list_offices",
      { displayName: "List Offices", description: "List all office locations configured in the Greenhouse account.", parametersSchema: { type: "object", properties: {} } },
      async (): Promise<ToolResult> => {
        try {
          return { content: JSON.stringify(await client.listOffices()) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "greenhouse_list_users",
      { displayName: "List Users", description: "List all users (recruiters, hiring managers) in the Greenhouse account.", parametersSchema: { type: "object", properties: { per_page: { type: "number", description: "Number of results per page (max 500)." }, page: { type: "number", description: "Page number for pagination." } } } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = (params ?? {}) as { per_page?: number; page?: number };
          return { content: JSON.stringify(await client.listUsers(p)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "greenhouse_list_job_stages",
      { displayName: "List Job Stages", description: "List all pipeline stages for a specific job.", parametersSchema: { type: "object", properties: { jobId: { type: "number", description: "Greenhouse job ID." } }, required: ["jobId"] } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const { jobId } = params as { jobId: number };
          return { content: JSON.stringify(await client.listJobStages(jobId)) };
        } catch (e) { return errResult(e); }
      },
    );
  },
});

runWorker(plugin, import.meta.url);
