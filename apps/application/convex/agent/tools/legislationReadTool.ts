import { createTool, ToolCtx } from "@convex-dev/agent";
import { api, internal } from "../../_generated/api";
import { z } from "zod";

/**
 * Tool for reading legislation documents progressively, chunk by chunk.
 * Use this to read through entire legislation documents sequentially without overwhelming token limits.
 * Perfect for systematic legislation analysis.
 *
 * @description Reads a legislation document progressively, chunk by chunk. Use this to read through entire legislation documents sequentially without overwhelming token limits. Perfect for systematic legislation analysis.
 * @param {Object} args - Reading parameters
 * @param {string} args.documentId - The ID of the legislation document to read (this is the document_id field in the legislation collection)
 * @param {number} [args.chunkIndex=0] - Which chunk to read (0-based index). Start with 0 for the beginning.
 * @param {number} [args.chunkCount=1] - Number of consecutive chunks to read (default: 1). Use higher values to read multiple chunks at once.
 * @returns {Promise<Object>} Document chunk information including content, progress, and navigation details
 * @throws {Error} When user is not authenticated, document not found, or chunk index is invalid
 *
 * @example
 * // Read the first chunk of a legislation document
 * await legislationReadTool.handler(ctx, {
 *   documentId: "leg_123",
 *   chunkIndex: 0
 * });
 *
 * // Read multiple chunks starting from index 5
 * await legislationReadTool.handler(ctx, {
 *   documentId: "leg_123",
 *   chunkIndex: 5,
 *   chunkCount: 3
 * });
 */
export const legislationReadTool = createTool({
  description: "Read a legislation document progressively, chunk by chunk. Use this to read through entire legislation documents sequentially without overwhelming token limits. Perfect for systematic legislation analysis.",
  args: z.object({
    documentId: z.any().describe("The ID of the legislation document to read (this is the document_id field in the legislation collection)"),
    chunkIndex: z.any().optional().describe("Which chunk to read (0-based index). Start with 0 for the beginning."),
    chunkCount: z.any().optional().describe("Number of consecutive chunks to read (default: 1). Use higher values to read multiple chunks at once."),
    contextWindow: z.any().optional().describe("Optional number of adjacent chunks to include on both sides for additional context.")
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

    const contextWindow = args.contextWindow !== undefined ? args.contextWindow : 0;
    if (typeof contextWindow !== 'number' || contextWindow < 0 || contextWindow > 10) {
      throw new Error("Invalid contextWindow: must be a number between 0 and 10");
    }

    const documentId = args.documentId.trim();
    
    // Verify authentication
    if (!ctx.userId) {
      throw new Error("Not authenticated");
    }

    // Get document metadata to verify it exists and get title
    const normative = await ctx.runAction(api.functions.legislation.getNormativeById, {
      jurisdiction: "",
      id: documentId,
    });

    if (!normative) {
      throw new Error("Legislation document not found");
    }

    // Get total chunks from Qdrant
    const totalChunks = await ctx.runAction(api.rag.qdrantUtils.legislation.getDocumentChunkCount, {
      document_id: documentId,
    });

    // Validate chunk index
    if (chunkIndex < 0) {
      throw new Error("Chunk index cannot be negative");
    }

    if (chunkIndex >= totalChunks) {
      throw new Error(`Chunk index ${chunkIndex} is beyond document length (${totalChunks} chunks)`);
    }

    // Calculate the actual number of chunks to read
    const actualChunkCount = Math.min(chunkCount, totalChunks - chunkIndex);

    // Compute effective range with optional context window
    const effectiveStartIndex = Math.max(0, chunkIndex - contextWindow);
    const effectiveEndIndex = Math.min(totalChunks - 1, chunkIndex + actualChunkCount - 1 + contextWindow);

    // Fetch multiple chunks from Qdrant
    const chunksContent = await ctx.runAction(api.rag.qdrantUtils.legislation.getDocumentChunksByRange, {
      document_id: documentId,
      startIndex: effectiveStartIndex,
      endIndex: effectiveEndIndex
    });

    if (!chunksContent || chunksContent.length === 0) {
      throw new Error(`No chunks found in range ${chunkIndex} to ${chunkIndex + actualChunkCount - 1}`);
    }

    // Combine chunks content
    const combinedContent = chunksContent.join('\n\n');

    return {
      documentId,
      documentTitle: normative.title || "Legislation Document",
      chunkIndex,
      chunkCount: actualChunkCount,
      totalChunks,
      content: combinedContent,
      hasMoreChunks: chunkIndex + actualChunkCount < totalChunks,
      nextChunkIndex: chunkIndex + actualChunkCount,
      progress: `${chunkIndex + actualChunkCount}/${totalChunks}`,
      isLastChunk: chunkIndex + actualChunkCount >= totalChunks,
      chunksRead: actualChunkCount,
      contextWindowUsed: contextWindow,
      expandedRange: { startIndex: effectiveStartIndex, endIndex: effectiveEndIndex },
      // Citation metadata for agent
      citationId: documentId,
      citationType: 'leg',
      citationTitle: normative.title || "Legislation Document",
    };
  }
} as any);
