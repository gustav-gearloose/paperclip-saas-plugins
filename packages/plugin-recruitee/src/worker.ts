import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import { RecruiteeClient } from "./recruitee-client.js";

interface RecruiteeConfig {
  companyId?: string;
  apiTokenRef?: string;
}

function errResult(e: unknown): ToolResult {
  return { error: e instanceof Error ? e.message : String(e) };
}

const plugin = definePlugin({
  async setup(ctx) {
    const cfg = await ctx.config.get() as RecruiteeConfig;
    const apiToken = await ctx.secrets.resolve(cfg.apiTokenRef ?? "");
    const client = new RecruiteeClient(cfg.companyId ?? "", apiToken);

    ctx.tools.register(
      "recruitee_list_offers",
      { displayName: "List Job Offers", description: "List all job offers/postings.", parametersSchema: { type: "object", properties: { limit: { type: "number", description: "Max results to return." }, offset: { type: "number", description: "Pagination offset." } } } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = (params ?? {}) as { limit?: number; offset?: number };
          return { content: JSON.stringify(await client.listOffers(p)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "recruitee_get_offer",
      { displayName: "Get Job Offer", description: "Get details of a single job offer by ID.", parametersSchema: { type: "object", properties: { offerId: { type: "number", description: "Recruitee offer/job ID." } }, required: ["offerId"] } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const { offerId } = params as { offerId: number };
          return { content: JSON.stringify(await client.getOffer(offerId)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "recruitee_list_candidates",
      { displayName: "List Candidates", description: "List all candidates with optional pagination.", parametersSchema: { type: "object", properties: { limit: { type: "number", description: "Max results to return." }, offset: { type: "number", description: "Pagination offset." } } } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const p = (params ?? {}) as { limit?: number; offset?: number };
          return { content: JSON.stringify(await client.listCandidates(p)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "recruitee_get_candidate",
      { displayName: "Get Candidate", description: "Get full profile for a single candidate by ID.", parametersSchema: { type: "object", properties: { candidateId: { type: "number", description: "Recruitee candidate ID." } }, required: ["candidateId"] } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const { candidateId } = params as { candidateId: number };
          return { content: JSON.stringify(await client.getCandidate(candidateId)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "recruitee_search_candidates",
      { displayName: "Search Candidates", description: "Search candidates by name, email, or keyword.", parametersSchema: { type: "object", properties: { query: { type: "string", description: "Search query (name, email, keyword)." }, limit: { type: "number", description: "Max results to return." }, offset: { type: "number", description: "Pagination offset." } }, required: ["query"] } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const { query, ...rest } = params as { query: string; limit?: number; offset?: number };
          return { content: JSON.stringify(await client.searchCandidates(query, rest)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "recruitee_list_candidates_for_offer",
      { displayName: "List Candidates for Job", description: "List all candidates who applied to a specific job offer.", parametersSchema: { type: "object", properties: { offerSlug: { type: "string", description: "Offer slug (from the offer URL or listing)." } }, required: ["offerSlug"] } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const { offerSlug } = params as { offerSlug: string };
          return { content: JSON.stringify(await client.listCandidatesForOffer(offerSlug)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "recruitee_create_candidate",
      { displayName: "Create Candidate", description: "Add a new candidate application to a job offer.", parametersSchema: { type: "object", properties: { offerSlug: { type: "string", description: "Offer slug to apply the candidate to." }, name: { type: "string", description: "Candidate full name." }, email: { type: "string", description: "Candidate email address." }, phone: { type: "string", description: "Candidate phone number (optional)." } }, required: ["offerSlug", "name", "email"] } },
      async (params: unknown): Promise<ToolResult> => {
        try {
          const { offerSlug, ...rest } = params as { offerSlug: string; [k: string]: unknown };
          return { content: JSON.stringify(await client.createCandidate(offerSlug, rest)) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "recruitee_list_pipelines",
      { displayName: "List Pipelines", description: "List all hiring pipelines and their stages.", parametersSchema: { type: "object", properties: {} } },
      async (): Promise<ToolResult> => {
        try {
          return { content: JSON.stringify(await client.listPipelines()) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "recruitee_list_members",
      { displayName: "List Team Members", description: "List all team members/recruiters in the company account.", parametersSchema: { type: "object", properties: {} } },
      async (): Promise<ToolResult> => {
        try {
          return { content: JSON.stringify(await client.listMembers()) };
        } catch (e) { return errResult(e); }
      },
    );

    ctx.tools.register(
      "recruitee_list_tags",
      { displayName: "List Tags", description: "List all tags used for candidate labelling.", parametersSchema: { type: "object", properties: {} } },
      async (): Promise<ToolResult> => {
        try {
          return { content: JSON.stringify(await client.listTags()) };
        } catch (e) { return errResult(e); }
      },
    );
  },
});

runWorker(plugin, import.meta.url);
