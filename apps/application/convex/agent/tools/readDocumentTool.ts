import { createTool, ToolCtx, getThreadMetadata } from "@convex-dev/agent";
import { components } from "../../_generated/api";
import { api, internal } from "../../_generated/api";
import { z } from "zod";
import { getUserAndCaseIds, createErrorResponse, validateStringParam, validateNumberParam } from "./utils";
import { Id } from "../../_generated/dataModel";

/**
 * Tool for reading a document progressively, chunk by chunk.
 * Use this to read through entire documents sequentially without overwhelming token limits.
 * Perfect for systematic document analysis.
 *
 * @description Reads a document progressively, chunk by chunk. Use this tool when you need to systematically read through case documents without overwhelming token limits. Perfect for comprehensive document analysis, reviewing evidence, or understanding complete document content. Start with chunkIndex 0 and increment to read sequentially through the document.
 * @param {Object} args - Reading parameters
 * @param {string} args.documentId - The ID of the document to read
 * @param {number} [args.chunkIndex=0] - Which chunk to read (0-based index). Start with 0 for the beginning.
 * @param {number} [args.chunkCount=1] - Number of consecutive chunks to read (default: 1). Use higher values to read multiple chunks at once.
 * @returns {Promise<Object>} Document chunk information including content, progress, and navigation details
 * @throws {Error} When user is not authenticated, not in case context, document not found, or chunk index is invalid
 *
 * @example
 * // Read the first chunk of a document
 * await readDocumentTool.handler(ctx, {
 *   documentId: "doc_123",
 *   chunkIndex: 0
 * });
 *
 * // Read multiple chunks starting from index 5
 * await readDocumentTool.handler(ctx, {
 *   documentId: "doc_123",
 *   chunkIndex: 5,
 *   chunkCount: 3
 * });
 */
export const readDocumentTool = createTool({
  description: "Read a document progressively, chunk by chunk. Use this tool when you need to systematically read through case documents without overwhelming token limits. Perfect for comprehensive document analysis, reviewing evidence, or understanding complete document content. Start with chunkIndex 0 and increment to read sequentially through the document.",
  args: z.object({
    documentId: z.any().describe("The ID of the document to read"),
    chunkIndex: z.any().optional().describe("Which chunk to read (0-based index). Start with 0 for the beginning."),
    chunkCount: z.any().optional().describe("Number of consecutive chunks to read (default: 1). Use higher values to read multiple chunks at once.")
  }).required({documentId: true}),
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

      const chunkIndexError = validateNumberParam(args.chunkIndex, "chunkIndex", 0, Infinity, 0);
      if (chunkIndexError) return chunkIndexError;

      const chunkCountError = validateNumberParam(args.chunkCount, "chunkCount", 1, 10, 1);
      if (chunkCountError) return chunkCountError;

      const documentId = args.documentId.trim();
      const chunkIndex = args.chunkIndex !== undefined ? args.chunkIndex : 0;
      const chunkCount = args.chunkCount !== undefined ? args.chunkCount : 1;

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
        return createErrorResponse(`Document is not ready for reading. Status: ${document.processingStatus}`);
      }

      // Get total chunks (prefer DB field, fallback to Qdrant count)
      let totalChunks = document.totalChunks || 0;
      if (totalChunks === 0) {
        totalChunks = await ctx.runAction(api.rag.qdrantUtils.caseDocuments.getDocumentChunkCount, {
          documentId,
          caseId
        });
      }

      // Validate chunk index
      if (chunkIndex >= totalChunks) {
        return createErrorResponse(`Chunk index ${chunkIndex} is beyond document length (${totalChunks} chunks)`);
      }

      // Calculate the actual number of chunks to read
      const actualChunkCount = Math.min(chunkCount, totalChunks - chunkIndex);

      // Fetch multiple chunks from Qdrant
      const chunksContent = await ctx.runAction(api.rag.qdrantUtils.caseDocuments.getDocumentChunksByRange, {
        documentId,
        caseId,
        startIndex: chunkIndex,
        endIndex: chunkIndex + actualChunkCount - 1
      });

      if (!chunksContent || chunksContent.length === 0) {
        return createErrorResponse(`No chunks found in range ${chunkIndex} to ${chunkIndex + actualChunkCount - 1}`);
      }

      // Combine chunks content
      const combinedContent = chunksContent.join('\n\n');

      return {
        documentId,
        documentTitle: document.title,
        chunkIndex,
        chunkCount: actualChunkCount,
        totalChunks,
        content: combinedContent,
        hasMoreChunks: chunkIndex + actualChunkCount < totalChunks,
        nextChunkIndex: chunkIndex + actualChunkCount,
        progress: `${chunkIndex + actualChunkCount}/${totalChunks}`,
        isLastChunk: chunkIndex + actualChunkCount >= totalChunks,
        chunksRead: actualChunkCount
      };
    } catch (error) {
      return createErrorResponse(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} as any);
