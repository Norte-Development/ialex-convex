import { createTool, ToolCtx, getThreadMetadata } from "@convex-dev/agent";
import { components } from "../../_generated/api";
import { api, internal } from "../../_generated/api";
import { z } from "zod";
import { getUserAndCaseIds, createErrorResponse, validateStringParam, validateNumberParam } from "./utils";
import { Id } from "../../_generated/dataModel";

/**
 * Tool for querying a specific document using semantic search.
 * Searches within a single document to find the most relevant chunks based on a query.
 * Perfect for finding specific information within a large document.
 *
 * @description Queries a specific document using semantic search. Searches within a single document to find the most relevant chunks based on a query. Perfect for finding specific information within a large document.
 * @param {Object} args - Query parameters
 * @param {string} args.documentId - The ID of the document to search within
 * @param {string} args.query - The search query to find relevant content within the document
 * @param {number} [args.limit=5] - Maximum number of relevant chunks to return (default: 5)
 * @returns {Promise<Object>} Search results with relevant document chunks and metadata
 * @throws {Error} When user is not authenticated, not in case context, document not found, or search fails
 *
 * @example
 * // Search for contract terms in a specific document
 * await queryDocumentTool.handler(ctx, {
 *   documentId: "doc_123",
 *   query: "payment terms and conditions",
 *   limit: 3
 * });
 */
export const queryDocumentTool = createTool({
  description: "Query a specific document using semantic search. Searches within a single document to find the most relevant chunks based on a query. Perfect for finding specific information within a large document.",
  args: z.object({
    documentId: z.any().describe("The ID of the document to search within"),
    query: z.any().describe("The search query to find relevant content within the document"),
    limit: z.any().optional().describe("Maximum number of relevant chunks to return (default: 5)")
  }).required({documentId: true, query: true}),
  handler: async (ctx: ToolCtx, args: any) => {
    try {
      const {caseId, userId} = getUserAndCaseIds(ctx.userId as string);
      
      await ctx.runQuery(internal.auth_utils.internalCheckNewCaseAccess,{
        userId: userId as Id<"users">,
        caseId: caseId as Id<"cases">,
        requiredLevel: "basic"
      } )

      // Validate inputs in handler
      const documentIdError = validateStringParam(args.documentId, "documentId");
      if (documentIdError) return documentIdError;

      const queryError = validateStringParam(args.query, "query");
      if (queryError) return queryError;

      const limitError = validateNumberParam(args.limit, "limit", 1, 20, 5);
      if (limitError) return limitError;

      const documentId = args.documentId.trim();
      const query = args.query.trim();
      const limit = args.limit !== undefined ? args.limit : 5;

      // Verify authentication using agent context
      if (!ctx.userId) {
        return createErrorResponse("Not authenticated");
      }

      // Extract caseId from thread metadata
      if (!ctx.threadId) {
        return createErrorResponse("No thread context available");
      }

      const { userId: threadUserId } = await getThreadMetadata(ctx, components.agent, { threadId: ctx.threadId });

      // Extract caseId from threadUserId format: "case:${caseId}_${userId}"
      if (!threadUserId?.startsWith("case:")) {
        return createErrorResponse("This tool can only be used within a case context");
      }

      // Get document metadata using internal helper (bypasses permission checks)
      const document = await ctx.runQuery(internal.functions.documents.getDocumentForAgent, {
        documentId: documentId as any
      });

      if (!document) {
        return createErrorResponse("Document not found");
      }

      // Verify document belongs to the current case
      if (document.caseId !== caseId) {
        return createErrorResponse("Document does not belong to the current case");
      }

      // Check if document is processed
      if (document.processingStatus !== "completed") {
        return createErrorResponse(`Document is not ready for querying. Status: ${document.processingStatus}`);
      }

      // Perform semantic search within the specific document
      const searchResults = await ctx.runAction(api.rag.qdrantUtils.caseDocuments.searchDocumentChunks, {
        documentId,
        caseId,
        query,
        limit
      });

      if (!searchResults || searchResults.length === 0) {
        return {
          documentId,
          documentTitle: document.title,
          query,
          results: [],
          message: "No relevant content found for the given query in this document."
        };
      }

      return {
        documentId,
        documentTitle: document.title,
        query,
        results: searchResults,
        totalResults: searchResults.length,
        message: `Found ${searchResults.length} relevant chunk(s) in the document.`
      };
    } catch (error) {
      return createErrorResponse(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} as any);
