import { createTool, ToolCtx, getThreadMetadata } from "@convex-dev/agent";
import { components } from "../../_generated/api";
import { api } from "../../_generated/api";
import { z } from "zod";

/**
 * Tool for searching case documents using dense embeddings with semantic chunk clustering.
 * Provides coherent context by grouping related chunks and expanding context windows.
 *
 * @description Searches case documents using dense embeddings with semantic chunk clustering. Provides coherent context by grouping related chunks and expanding context windows.
 * @param {Object} args - Search parameters
 * @param {string} args.query - The search query text to find relevant case documents
 * @param {number} [args.limit=10] - Maximum number of initial results to return (default: 10)
 * @param {number} [args.contextWindow=4] - Number of adjacent chunks to include for context expansion (default: 4)
 * @returns {Promise<Object>} Search results with clustered document chunks and context
 * @throws {Error} When user is not authenticated or not in a case context
 *
 * @example
 * // Search for contract-related documents in current case
 * await searchCaseDocumentsTool.handler(ctx, {
 *   query: "contract terms and conditions",
 *   limit: 15,
 *   contextWindow: 6
 * });
 */
export const searchCaseDocumentsTool = createTool({
  description: "Search case documents using dense embeddings with semantic chunk clustering. Provides coherent context by grouping related chunks and expanding context windows.",
  args: z.object({
    query: z.any().describe("The search query text to find relevant case documents"),
    limit: z.any().optional().describe("Maximum number of initial results to return (default: 10)"),
    contextWindow: z.any().optional().describe("Number of adjacent chunks to include for context expansion (default: 4)")
  }).required({query: true}),
  handler: async (ctx: ToolCtx, args: any) => {
    // Validate inputs in handler
    if (!args.query || typeof args.query !== 'string' || args.query.trim().length === 0) {
      throw new Error("Invalid query: must be a non-empty string");
    }

    const limit = args.limit !== undefined ? args.limit : 10;
    if (typeof limit !== 'number' || limit < 1 || limit > 50) {
      throw new Error("Invalid limit: must be a number between 1 and 50");
    }

    const contextWindow = args.contextWindow !== undefined ? args.contextWindow : 4;
    if (typeof contextWindow !== 'number' || contextWindow < 1 || contextWindow > 20) {
      throw new Error("Invalid contextWindow: must be a number between 1 and 20");
    }

    // Use userId directly from ctx instead of getCurrentUserFromAuth
    if (!ctx.userId) {
      throw new Error("Not authenticated");
    }

    // Extract caseId from thread metadata
    if (!ctx.threadId) {
      throw new Error("No thread context available");
    }

    const { userId: threadUserId } = await getThreadMetadata(ctx, components.agent, { threadId: ctx.threadId });

    // Extract caseId from threadUserId format: "case:${caseId}_${userId}"
    if (!threadUserId?.startsWith("case:")) {
      throw new Error("This tool can only be used within a case context");
    }

    const caseId = threadUserId.substring(5).split("_")[0]; // Remove "case:" prefix and get caseId part

    // Call the action to perform the search with clustering
    return await ctx.runAction(api.rag.qdrantUtils.caseDocuments.searchCaseDocumentsWithClustering, {
      query: args.query.trim(),
      caseId,
      limit: Math.min(limit, 50), // Cap at 50 to prevent abuse
      contextWindow: Math.min(contextWindow, 20) // Cap at 20 to prevent abuse
    });
  }
} as any);
