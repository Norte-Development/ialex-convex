import { createTool, ToolCtx, getThreadMetadata } from "@convex-dev/agent";
import { components } from "../../_generated/api";
import { api, internal } from "../../_generated/api";
import { z } from "zod";

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
    // Validate inputs in handler
    if (!args.documentId || typeof args.documentId !== 'string' || args.documentId.trim().length === 0) {
      throw new Error("Invalid documentId: must be a non-empty string");
    }

    if (!args.query || typeof args.query !== 'string' || args.query.trim().length === 0) {
      throw new Error("Invalid query: must be a non-empty string");
    }

    const limit = args.limit !== undefined ? args.limit : 5;
    if (typeof limit !== 'number' || limit < 1 || limit > 20) {
      throw new Error("Invalid limit: must be a number between 1 and 20");
    }

    const documentId = args.documentId.trim();
    const query = args.query.trim();
    // Verify authentication using agent context
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

    // Get document metadata using internal helper (bypasses permission checks)
    const document = await ctx.runQuery(internal.functions.documents.getDocumentForAgent, {
      documentId: documentId as any
    });

    if (!document) {
      throw new Error("Document not found");
    }

    // Verify document belongs to the current case
    if (document.caseId !== caseId) {
      throw new Error("Document does not belong to the current case");
    }

    // Check if document is processed
    if (document.processingStatus !== "completed") {
      throw new Error(`Document is not ready for querying. Status: ${document.processingStatus}`);
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
  }
} as any);
