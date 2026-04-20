import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { TeamtailorClient } from "./teamtailor-client.js";

interface TeamtailorConfig {
  apiKeyRef?: string;
}

function errResult(e: unknown): ToolResult {
  return { error: e instanceof Error ? e.message : String(e) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const cfg = await ctx.config.get() as TeamtailorConfig;
    const apiKey = await ctx.secrets.resolve(cfg.apiKeyRef ?? "");
    const client = new TeamtailorClient(apiKey);

    ctx.tools.register(
      "teamtailor_list_jobs",
      { displayName: "List Jobs", description: "List all job postings in the Teamtailor account.", parametersSchema: { type: "object", properties: { limit: { type: "number", description: "Max results per page (page size)." }, page: { type: "number", description: "Page number for pagination." } } } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = (params ?? {}) as { limit?: number; page?: number };
          return { content: JSON.stringify(await client.listJobs(p)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "teamtailor_get_job",
      { displayName: "Get Job", description: "Get details of a single job posting by ID.", parametersSchema: { type: "object", properties: { jobId: { type: "number", description: "Teamtailor job ID." } }, required: ["jobId"] } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const { jobId } = params as { jobId: number };
          return { content: JSON.stringify(await client.getJob(jobId)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "teamtailor_list_candidates",
      { displayName: "List Candidates", description: "List all candidates in the account with optional pagination.", parametersSchema: { type: "object", properties: { limit: { type: "number", description: "Max results per page (page size)." }, page: { type: "number", description: "Page number for pagination." } } } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = (params ?? {}) as { limit?: number; page?: number };
          return { content: JSON.stringify(await client.listCandidates(p)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "teamtailor_get_candidate",
      { displayName: "Get Candidate", description: "Get full profile for a single candidate by ID.", parametersSchema: { type: "object", properties: { candidateId: { type: "number", description: "Teamtailor candidate ID." } }, required: ["candidateId"] } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const { candidateId } = params as { candidateId: number };
          return { content: JSON.stringify(await client.getCandidate(candidateId)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "teamtailor_create_candidate",
      { displayName: "Create Candidate", description: "Create a new candidate record in Teamtailor.", parametersSchema: { type: "object", properties: { firstName: { type: "string", description: "Candidate first name." }, lastName: { type: "string", description: "Candidate last name." }, email: { type: "string", description: "Candidate email address." }, phone: { type: "string", description: "Candidate phone number (optional)." }, pitch: { type: "string", description: "Short personal pitch or cover note (optional)." } }, required: ["firstName", "lastName", "email"] } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const { firstName, lastName, email, ...rest } = params as { firstName: string; lastName: string; email: string; [k: string]: unknown };
          return { content: JSON.stringify(await client.createCandidate({ firstName, lastName, email, ...rest })) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "teamtailor_list_job_applications",
      { displayName: "List Job Applications", description: "List job applications, optionally filtered by job ID.", parametersSchema: { type: "object", properties: { jobId: { type: "number", description: "Filter applications by this job ID (optional)." }, limit: { type: "number", description: "Max results per page (page size)." }, page: { type: "number", description: "Page number for pagination." } } } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = (params ?? {}) as { jobId?: number; limit?: number; page?: number };
          return { content: JSON.stringify(await client.listJobApplications(p)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "teamtailor_list_departments",
      { displayName: "List Departments", description: "List all departments in the Teamtailor account.", parametersSchema: { type: "object", properties: {} } },
      async (): Promise<ToolResult> => {
        try {
          return { content: JSON.stringify(await client.listDepartments()) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "teamtailor_list_locations",
      { displayName: "List Locations", description: "List all office locations configured in the Teamtailor account.", parametersSchema: { type: "object", properties: {} } },
      async (): Promise<ToolResult> => {
        try {
          return { content: JSON.stringify(await client.listLocations()) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "teamtailor_list_users",
      { displayName: "List Users", description: "List all users (recruiters and hiring managers) in the account.", parametersSchema: { type: "object", properties: { limit: { type: "number", description: "Max results per page (page size)." }, page: { type: "number", description: "Page number for pagination." } } } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = (params ?? {}) as { limit?: number; page?: number };
          return { content: JSON.stringify(await client.listUsers(p)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "teamtailor_list_stages",
      { displayName: "List Stages", description: "List all pipeline stages available in the Teamtailor account.", parametersSchema: { type: "object", properties: {} } },
      async (): Promise<ToolResult> => {
        try {
          return { content: JSON.stringify(await client.listStages()) };
        } catch (e) { return errResult(e); }
      },
    );
  },
});

runWorker(plugin, import.meta.url);
