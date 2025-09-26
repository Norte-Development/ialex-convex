import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { createErrorResponse, validateStringParam, validateNumberParam } from "./utils";

/**
 * Tool for searching court decisions and legal precedents (fallos) using dense embeddings.
 * Useful for finding relevant case law and judicial decisions.
 *
 * @description Searches court decisions and legal precedents (fallos) using dense embeddings. Use this tool when users need to find relevant case law, judicial decisions, legal precedents, or jurisprudencia. The search uses semantic similarity to find the most relevant court decisions based on the query.
 * @param {Object} args - Search parameters
 * @param {string} args.query - The search query text to find relevant court decisions
 * @param {number} [args.limit=10] - Maximum number of results to return (default: 10)
 * @returns {Promise<Object>} Search results with court decisions data
 * @throws {Error} When the fallos search API request fails
 *
 * @example
 * // Search for contract dispute precedents
 * await searchFallosTool.handler(ctx, {
 *   query: "contract dispute resolution",
 *   limit: 5
 * });
 */
export const searchFallosTool = createTool({
  description: "Search court decisions and legal precedents (fallos) using dense embeddings. Use this tool when users need to find relevant case law, judicial decisions, legal precedents, or jurisprudencia. The search uses semantic similarity to find the most relevant court decisions based on the query.",
  args: z.object({
    query: z.any().describe("The search query text to find relevant court decisions"),
    limit: z.any().optional().describe("Maximum number of results to return (default: 10)")
  }).required({query: true}),
  handler: async (ctx: any, args: any) => {
    try {
      // Validate inputs in handler
      const queryError = validateStringParam(args.query, "query");
      if (queryError) return queryError;

      const limitError = validateNumberParam(args.limit, "limit", 1, 100, 10);
      if (limitError) return limitError;

      const limit = args.limit !== undefined ? args.limit : 10;

      const validatedArgs = {
        query: args.query.trim(),
        limit: Math.min(limit, 100) // Cap at 100 to prevent abuse
      };

      const response = await fetch(`${process.env.SEARCH_API_URL}/search_fallos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.SEARCH_API_KEY!
        },
        body: JSON.stringify(validatedArgs)
      });

      if (!response.ok) {
        return createErrorResponse(`Fallos search failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      return createErrorResponse(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
} as any);
