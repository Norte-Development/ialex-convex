import { createTool, ToolCtx, getThreadMetadata } from "@convex-dev/agent";
import { components } from "../../_generated/api";
import { api, internal } from "../../_generated/api";
import { z } from "zod";

/**
 * Tool for reading a document progressively, chunk by chunk.
 * Use this to read through entire documents sequentially without overwhelming token limits.
 * Perfect for systematic document analysis.
 *
 * @description Reads a document progressively, chunk by chunk. Use this to read through entire documents sequentially without overwhelming token limits. Perfect for systematic document analysis.
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
  description: "Read a document progressively, chunk by chunk. Use this to read through entire documents sequentially without overwhelming token limits. Perfect for systematic document analysis.",
  args: z.object({
    documentId: z.any().describe("The ID of the document to read"),
    chunkIndex: z.any().optional().describe("Which chunk to read (0-based index). Start with 0 for the beginning."),
    chunkCount: z.any().optional().describe("Number of consecutive chunks to read (default: 1). Use higher values to read multiple chunks at once.")
  }).required({documentId: true}),
  handler: async (ctx: ToolCtx, args: any) => {
    // Validate inputs in handler
    if (!args.documentId || typeof args.documentId !== 'string' || args.documentId.trim().length === 0) {
      throw new Error("Invalid documentId: must be a non-empty string");
    }

    const chunkIndex = args.chunkIndex !== undefined ? args.chunkIndex : 0;
    if (typeof chunkIndex !== 'number' || chunkIndex < 0) {
      throw new Error("Invalid chunkIndex: must be a non-negative number");
    }

    const chunkCount = args.chunkCount !== undefined ? args.chunkCount : 1;
    if (typeof chunkCount !== 'number' || chunkCount < 1 || chunkCount > 10) {
      throw new Error("Invalid chunkCount: must be a number between 1 and 10");
    }

    const documentId = args.documentId.trim();
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
      throw new Error(`Document is not ready for reading. Status: ${document.processingStatus}`);
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
    if (chunkIndex < 0) {
      throw new Error("Chunk index cannot be negative");
    }

    if (chunkIndex >= totalChunks) {
      throw new Error(`Chunk index ${chunkIndex} is beyond document length (${totalChunks} chunks)`);
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
      throw new Error(`No chunks found in range ${chunkIndex} to ${chunkIndex + actualChunkCount - 1}`);
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
  }
} as any);
