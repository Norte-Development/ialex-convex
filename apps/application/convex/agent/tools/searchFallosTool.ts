import { createTool } from "@convex-dev/agent";
import { z } from "zod";

/**
 * Tool for searching court decisions and legal precedents (fallos) using dense embeddings.
 * Useful for finding relevant case law and judicial decisions.
 *
 * @description Searches court decisions and legal precedents (fallos) using dense embeddings. Useful for finding relevant case law and judicial decisions.
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
  description: "Search court decisions and legal precedents (fallos) using dense embeddings. Useful for finding relevant case law and judicial decisions.",
  args: z.object({
    query: z.any().describe("The search query text to find relevant court decisions"),
    limit: z.any().optional().describe("Maximum number of results to return (default: 10)")
  }).required({query: true}),
  handler: async (ctx: any, args: any) => {
    // Validate inputs in handler
    if (!args.query || typeof args.query !== 'string' || args.query.trim().length === 0) {
      throw new Error("Invalid query: must be a non-empty string");
    }

    const limit = args.limit !== undefined ? args.limit : 10;

    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      throw new Error("Invalid limit: must be a number between 1 and 100");
    }

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
      throw new Error(`Fallos search failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  },
} as any);
