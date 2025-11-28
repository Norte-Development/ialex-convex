import { createTool, ToolCtx, getThreadMetadata } from "@convex-dev/agent";
import { components } from "../../../_generated/api";
import { api, internal } from "../../../_generated/api";
import { z } from "zod";
import { getUserAndCaseIds, createErrorResponse, validateStringParam, validateNumberParam } from "../shared/utils";
import { Id } from "../../../_generated/dataModel";
import { createCaseDocumentsSearchTemplate, createCaseDocumentsNoResultsTemplate } from "./templates";

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
    contextWindow: z.any().optional().describe("Number of adjacent chunks to include for context expansion (default: 4)"),
    caseId: z.any().optional().describe("Optional case ID. If provided, will use this case instead of extracting from context. Used for WhatsApp agent.")
  }).required({query: true}),
  handler: async (ctx: ToolCtx, args: any) => {
    try {
      // Get userId first
      const userAndCase = getUserAndCaseIds(ctx.userId as string);
      let userId = userAndCase.userId;
      let caseId: string | null = null;

      // Use userId directly from ctx instead of getCurrentUserFromAuth
      if (!ctx.userId) {
        return createErrorResponse("No autenticado");
      }

      // First, try to extract caseId from thread metadata (takes precedence)
      if (ctx.threadId) {
        try {
          const { userId: threadUserId } = await getThreadMetadata(ctx, components.agent, { threadId: ctx.threadId });
          
          // Extract caseId from threadUserId format: "case:${caseId}_${userId}"
          if (threadUserId?.startsWith("case:")) {
            const threadUserAndCase = getUserAndCaseIds(threadUserId);
            caseId = threadUserAndCase.caseId;
          }
        } catch (error) {
          // If thread metadata extraction fails, continue to fallback
        }
      }

      // If no caseId from context, use the one from args (for WhatsApp agent)
      if (!caseId && args.caseId) {
        caseId = args.caseId;
      }

      // If still no caseId, try to get it from ctx.userId
      if (!caseId) {
        caseId = userAndCase.caseId;
      }

      if (!caseId || !userId){
        return createErrorResponse("Contexto de usuario inválido");
      }
      
      await ctx.runQuery(internal.auth_utils.internalCheckNewCaseAccess,{
        userId: userId as Id<"users">,
        caseId: caseId as Id<"cases">,
        requiredLevel: "basic"
      } )

      // Validate inputs in handler
      const queryError = validateStringParam(args.query, "query");
      if (queryError) return queryError;

      const limitError = validateNumberParam(args.limit, "limit", 1, 50, 10);
      if (limitError) return limitError;

      const contextWindowError = validateNumberParam(args.contextWindow, "contextWindow", 1, 20, 4);
      if (contextWindowError) return contextWindowError;

      const limit = args.limit !== undefined ? args.limit : 10;
      const contextWindow = args.contextWindow !== undefined ? args.contextWindow : 4;

      // Call the action to perform the search with clustering
      const results = await ctx.runAction(api.rag.qdrantUtils.caseDocuments.searchCaseDocumentsWithClustering, {
        query: args.query.trim(),
        caseId,
        limit: Math.min(limit, 50), // Cap at 50 to prevent abuse
        contextWindow: Math.min(contextWindow, 20) // Cap at 20 to prevent abuse
      });

      if (results.length === 0) {
        return createCaseDocumentsNoResultsTemplate(args.query.trim(), Math.min(limit, 50), Math.min(contextWindow, 20));
      }
      
      return createCaseDocumentsSearchTemplate(args.query.trim(), Math.min(limit, 50), Math.min(contextWindow, 20), results);
    } catch (error) {
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }
} as any);
