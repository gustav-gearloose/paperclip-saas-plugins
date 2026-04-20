import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { WorkableClient } from "./workable-client.js";

interface WorkableConfig {
  subdomain?: string;
  accessTokenRef?: string;
}

function errResult(e: unknown): ToolResult {
  return { error: e instanceof Error ? e.message : String(e) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const cfg = await ctx.config.get() as WorkableConfig;
    const accessToken = await ctx.secrets.resolve(cfg.accessTokenRef ?? "");
    const client = new WorkableClient(cfg.subdomain ?? "", accessToken);

    ctx.tools.register(
      "workable_list_jobs",
      { displayName: "List Jobs", description: "List job postings in the Workable account, optionally filtered by state.", parametersSchema: { type: "object", properties: { state: { type: "string", description: "Filter by job state: 'published', 'draft', 'closed', or 'archived' (optional)." }, limit: { type: "number", description: "Max results to return." }, offset: { type: "number", description: "Pagination offset." } } } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = (params ?? {}) as { state?: string; limit?: number; offset?: number };
          return { content: JSON.stringify(await client.listJobs(p)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "workable_get_job",
      { displayName: "Get Job", description: "Get details of a single job posting by its shortcode.", parametersSchema: { type: "object", properties: { shortcode: { type: "string", description: "Workable job shortcode (e.g. 'ACME123')." } }, required: ["shortcode"] } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const { shortcode } = params as { shortcode: string };
          return { content: JSON.stringify(await client.getJob(shortcode)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "workable_list_candidates",
      { displayName: "List Candidates", description: "List candidates, optionally scoped to a specific job by shortcode.", parametersSchema: { type: "object", properties: { jobShortcode: { type: "string", description: "Scope results to this job's shortcode (optional)." }, limit: { type: "number", description: "Max results to return." }, since_id: { type: "string", description: "Return candidates with ID greater than this value (cursor pagination)." }, max_id: { type: "string", description: "Return candidates with ID less than this value (cursor pagination)." } } } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = (params ?? {}) as { jobShortcode?: string; limit?: number; since_id?: string; max_id?: string };
          return { content: JSON.stringify(await client.listCandidates(p)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "workable_get_candidate",
      { displayName: "Get Candidate", description: "Get full profile for a single candidate by ID.", parametersSchema: { type: "object", properties: { candidateId: { type: "string", description: "Workable candidate ID." } }, required: ["candidateId"] } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const { candidateId } = params as { candidateId: string };
          return { content: JSON.stringify(await client.getCandidate(candidateId)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "workable_create_candidate",
      { displayName: "Create Candidate", description: "Create a new candidate application for a specific job.", parametersSchema: { type: "object", properties: { jobShortcode: { type: "string", description: "Shortcode of the job to apply the candidate to." }, name: { type: "string", description: "Candidate full name." }, email: { type: "string", description: "Candidate email address." }, phone: { type: "string", description: "Candidate phone number (optional)." }, summary: { type: "string", description: "Short candidate summary or cover note (optional)." } }, required: ["jobShortcode", "name", "email"] } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const { jobShortcode, ...rest } = params as { jobShortcode: string; [k: string]: unknown };
          return { content: JSON.stringify(await client.createCandidate(jobShortcode, rest)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "workable_list_members",
      { displayName: "List Members", description: "List all team members (recruiters, hiring managers) in the account.", parametersSchema: { type: "object", properties: { limit: { type: "number", description: "Max results to return." }, offset: { type: "number", description: "Pagination offset." } } } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = (params ?? {}) as { limit?: number; offset?: number };
          return { content: JSON.stringify(await client.listMembers(p)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "workable_list_departments",
      { displayName: "List Departments", description: "List all departments configured in the Workable account.", parametersSchema: { type: "object", properties: {} } },
      async (): Promise<ToolResult> => {
        try {
          return { content: JSON.stringify(await client.listDepartments()) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "workable_list_locations",
      { displayName: "List Locations", description: "List all office locations configured in the Workable account.", parametersSchema: { type: "object", properties: {} } },
      async (): Promise<ToolResult> => {
        try {
          return { content: JSON.stringify(await client.listLocations()) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "workable_list_stages",
      { displayName: "List Stages", description: "List all pipeline stages available in the Workable account.", parametersSchema: { type: "object", properties: {} } },
      async (): Promise<ToolResult> => {
        try {
          return { content: JSON.stringify(await client.listStages()) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "workable_list_requisitions",
      { displayName: "List Requisitions", description: "List job requisitions (hiring requests) in the Workable account.", parametersSchema: { type: "object", properties: { limit: { type: "number", description: "Max results to return." }, offset: { type: "number", description: "Pagination offset." } } } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = (params ?? {}) as { limit?: number; offset?: number };
          return { content: JSON.stringify(await client.listRequisitions(p)) };
        } catch (e) { return errResult(e); }
      },
    );
  },
});

runWorker(plugin, import.meta.url);
