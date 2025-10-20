import {
  internalAction,
  internalQuery,
  internalMutation,
} from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

// ========================================
// LIBRARY DOCUMENT PROCESSING
// ========================================

/**
 * Internal query to get library document for processing.
 * Used by the processing action to retrieve document metadata.
 */
export const getLibraryDocumentForProcessing = internalQuery({
  args: {
    libraryDocumentId: v.id("libraryDocuments"),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.libraryDocumentId);
    if (!document) {
      throw new Error(`Library document not found: ${args.libraryDocumentId}`);
    }
    return document;
  },
});

/**
 * Internal mutation to update library document processing status.
 * Called by the webhook handler after processing completes or fails.
 */
export const updateLibraryDocumentProcessingStatus = internalMutation({
  args: {
    libraryDocumentId: v.id("libraryDocuments"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    processingStartedAt: v.optional(v.number()),
    processingCompletedAt: v.optional(v.number()),
    processingError: v.optional(v.string()),
    totalChunks: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { libraryDocumentId, status, ...updateFields } = args;

    const updateData: any = {
      processingStatus: status,
    };

    if (updateFields.processingStartedAt !== undefined) {
      updateData.processingStartedAt = updateFields.processingStartedAt;
    }
    if (updateFields.processingCompletedAt !== undefined) {
      updateData.processingCompletedAt = updateFields.processingCompletedAt;
    }
    if (updateFields.processingError !== undefined) {
      updateData.processingError = updateFields.processingError;
    }
    if (updateFields.totalChunks !== undefined) {
      updateData.totalChunks = updateFields.totalChunks;
    }

    await ctx.db.patch(libraryDocumentId, updateData);

    console.log(
      `Updated library document ${libraryDocumentId} processing status to ${status}`,
    );
  },
});

/**
 * Internal action that processes a library document.
 * This offloads processing to the external document-processor microservice.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.libraryDocumentId - The library document ID to process
 */
export const processLibraryDocument = internalAction({
  args: {
    libraryDocumentId: v.id("libraryDocuments"),
  },
  handler: async (ctx, args) => {
    console.log(
      "Starting library document processing for document:",
      args.libraryDocumentId,
    );

    try {
      // Get the document details
      const document = await ctx.runQuery(
        internal.functions.libraryDocumentProcessing.getLibraryDocumentForProcessing,
        {
          libraryDocumentId: args.libraryDocumentId,
        },
      );

      if (!document) {
        throw new Error(`Library document not found: ${args.libraryDocumentId}`);
      }

      // Update status to processing
      await ctx.runMutation(
        internal.functions.libraryDocumentProcessing.updateLibraryDocumentProcessingStatus,
        {
          libraryDocumentId: args.libraryDocumentId,
          status: "processing",
          processingStartedAt: Date.now(),
        },
      );

      // Generate signed URL for document processor to download the file
      const { url } = await ctx.runAction(
        internal.utils.gcs.generateGcsV4SignedUrlAction,
        {
          bucket: document.gcsBucket as string,
          object: document.gcsObject as string,
          expiresSeconds: 300, // 5 minutes
          method: "GET",
        },
      );

      // Prepare callback URL for processing completion
      const callbackUrl = `${process.env.CONVEX_SITE_URL || ""}/webhooks/library-document-processed`;

      // Prepare request body for document processor
      const body = {
        jobType: "library-document", // Explicit discriminator for routing
        signedUrl: url,
        contentType: document.mimeType,
        createdBy: String(document.createdBy),
        libraryDocumentId: String(args.libraryDocumentId),
        userId: document.userId ? String(document.userId) : undefined,
        teamId: document.teamId ? String(document.teamId) : undefined,
        folderId: document.folderId ? String(document.folderId) : undefined,
        originalFileName: document.title,
        callbackUrl,
        hmacSecret: process.env.HMAC_SECRET,
        chunking: { maxTokens: 400, overlapRatio: 0.15, pageWindow: 50 },
      };

      // Call external document processor
      const resp = await fetch(
        `${process.env.DOC_PROCESSOR_URL}/process-library-document`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(
          `Document processor returned ${resp.status}: ${errorText}`,
        );
      }

      const result = await resp.json();
      console.log(
        `Library document ${args.libraryDocumentId} queued for processing. Job ID:`,
        result.jobId,
      );
    } catch (error: any) {
      console.error(
        `Failed to process library document ${args.libraryDocumentId}:`,
        error,
      );

      // Update status to failed
      await ctx.runMutation(
        internal.functions.libraryDocumentProcessing.updateLibraryDocumentProcessingStatus,
        {
          libraryDocumentId: args.libraryDocumentId,
          status: "failed",
          processingCompletedAt: Date.now(),
          processingError: error.message || String(error),
        },
      );

      throw error;
    }
  },
});

/**
 * Internal action to delete library document chunks from Qdrant.
 * Called when a library document is deleted.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.libraryDocumentId - The library document ID
 */
export const deleteLibraryDocumentChunks = internalAction({
  args: {
    libraryDocumentId: v.id("libraryDocuments"),
  },
  handler: async (ctx, args) => {
    console.log(
      "Deleting library document chunks for:",
      args.libraryDocumentId,
    );

    try {
      // Call the Qdrant utility to delete chunks
      await ctx.runAction(
        internal.rag.qdrantUtils.libraryDocuments.deleteLibraryDocumentChunksFromQdrant,
        {
          libraryDocumentId: args.libraryDocumentId,
        },
      );

      console.log(
        "Successfully deleted chunks for library document:",
        args.libraryDocumentId,
      );
    } catch (error: any) {
      console.error(
        `Failed to delete chunks for library document ${args.libraryDocumentId}:`,
        error.message || error,
      );
      // Don't throw - we don't want to fail the document deletion if chunk cleanup fails
    }
  },
});

