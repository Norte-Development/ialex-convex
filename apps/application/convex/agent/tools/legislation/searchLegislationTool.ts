import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../../_generated/api";
import { createErrorResponse, validateStringParam } from "../utils";
import { LegislationSearchResult } from "../../../rag/qdrantUtils/types";
import { createLegislationSearchTemplate, createLegislationSearchErrorTemplate } from "./templates";

/**
 * Tool for searching legislation and normative documents using Qdrant hybrid search.
 * Searches both dense embeddings and sparse keywords for comprehensive legal document retrieval.
 *
 * @description Searches legislation and normative documents using hybrid search (dense + sparse embeddings). Returns comprehensive metadata including titles, jurisdictions, publication dates, and full text content. Use this tool when users ask about specific laws, articles, regulations, or legal norms. Always follow up with readLegislation to get the complete text of relevant documents.
 * @param {Object} args - Search parameters
 * @param {string} args.query - The search query text to find relevant legislation
 * @returns {Promise<Array>} Array of legislation search results with full metadata
 * @throws {Error} When the legislation search fails
 *
 * @example
 * // Search for labor law legislation
 * await searchLegislationTool.handler(ctx, {
 *   query: "labor law regulations"
 * });
 */
export const searchLegislationTool = createTool({
  description: "Search legislation and normative documents using hybrid search (dense + sparse embeddings). Returns comprehensive metadata including titles, jurisdictions, publication dates, and full text content. Use this tool when users ask about specific laws, articles, regulations, or legal norms. Always follow up with readLegislation to get the complete text of relevant documents.",
  args: z.object({
    query: z.string().min(1).describe("The search query text to find relevant legislation and normative documents")
  }).required({query: true}),
  handler: async (ctx: any, args: any) => {
    try {
      // Validate inputs in handler
      const queryError = validateStringParam(args.query, "query");
      if (queryError) return queryError;

      const validatedArgs = {
        query: args.query.trim()
      };

      // Call the internal searchNormatives action
      const results: LegislationSearchResult[] = await ctx.runAction(internal.rag.qdrantUtils.legislation.searchNormatives, validatedArgs);

      console.log("Results:", results[0].text);

      // Format and return results with enhanced information
      return createLegislationSearchTemplate(validatedArgs.query, results);

    } catch (error) {
      console.error("Legislation search failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      return createErrorResponse(createLegislationSearchErrorTemplate(errorMessage));
    }
  },
} as any);
