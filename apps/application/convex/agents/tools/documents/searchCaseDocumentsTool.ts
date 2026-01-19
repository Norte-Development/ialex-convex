import { createTool, ToolCtx, getThreadMetadata } from "@convex-dev/agent";
import { components } from "../../../_generated/api";
import { api, internal } from "../../../_generated/api";
import { z } from "zod";
import { getUserAndCaseIds, createErrorResponse } from "../shared/utils";
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
/**
 * Schema for searchCaseDocumentsTool arguments.
 * All fields have defaults to satisfy OpenAI's JSON schema requirements.
 */
const searchCaseDocumentsToolArgs = z.object({
  query: z.string().describe("The search query text to find relevant case documents"),
  limit: z.number().int().min(1).max(50).default(10).describe("Maximum number of initial results to return (default: 10)"),
  contextWindow: z.number().int().min(1).max(20).default(4).describe("Number of adjacent chunks to include for context expansion (default: 4)"),
  caseId: z.string().default("").describe("Optional case ID. If provided, will use this case instead of extracting from context. Used for WhatsApp agent. Empty string to omit.")
});

type SearchCaseDocumentsToolArgs = z.infer<typeof searchCaseDocumentsToolArgs>;

export const searchCaseDocumentsTool = createTool({
  description: "Search case documents using dense embeddings with semantic chunk clustering. Provides coherent context by grouping related chunks and expanding context windows.",
  args: searchCaseDocumentsToolArgs,
  handler: async (ctx: ToolCtx, args: SearchCaseDocumentsToolArgs) => {
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

      // If no caseId from context, use the one from args (for WhatsApp agent) - empty string means not provided
      if (!caseId && args.caseId && args.caseId.trim() !== "") {
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

      // Validate query is not empty
      if (!args.query || args.query.trim() === "") {
        return createErrorResponse("Se requiere un término de búsqueda (query)");
      }

      const limit = args.limit;
      const contextWindow = args.contextWindow;

      // Call the action to perform the search with clustering
      const searchResult = await ctx.runAction(api.rag.qdrantUtils.caseDocuments.searchCaseDocumentsWithClustering, {
        query: args.query.trim(),
        caseId,
        limit: Math.min(limit, 50), // Cap at 50 to prevent abuse
        contextWindow: Math.min(contextWindow, 20) // Cap at 20 to prevent abuse
      });

      // Handle both old (string) and new (object) return formats for backward compatibility
      const resultsText = typeof searchResult === 'string' ? searchResult : searchResult.text;
      const documentIds = typeof searchResult === 'string' ? [] : (searchResult.documentIds || []);

      if (!resultsText || resultsText.trim().length === 0) {
        return createCaseDocumentsNoResultsTemplate(args.query.trim(), Math.min(limit, 50), Math.min(contextWindow, 20));
      }

      // Get document metadata for citations
      const citations = [];
      if (documentIds.length > 0) {
        const documents = await ctx.runQuery(internal.functions.documents.getDocumentsForAgent, {
          caseId: caseId as Id<"cases">,
        });

        // Create citations for documents found in search results
        for (const docId of documentIds) {
          const doc = documents.find((d: any) => d._id === docId);
          if (doc) {
            citations.push({
              id: doc._id,
              type: 'case-doc' as const,
              title: doc.title || doc.description || 'Documento sin título',
            });
          }
        }
      }

      const markdown = createCaseDocumentsSearchTemplate(args.query.trim(), Math.min(limit, 50), Math.min(contextWindow, 20), resultsText);
      
      // Return structured JSON with markdown and citations (matching legislation/fallos pattern)
      if (citations.length > 0) {
        console.log(`📚 [Citations] Creating citations from ${citations.length} document search results`);
        citations.forEach(cit => console.log(`  📖 Citation created:`, cit));
        console.log(`✅ [Citations] Total citations created: ${citations.length}`);
        console.log(`📤 [Citations] Returning tool output with ${citations.length} citations`);
        return { markdown, citations };
      }
      
      return markdown;
    } catch (error) {
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }
} as any);
