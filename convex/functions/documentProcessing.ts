import { query, mutation, internalAction, internalQuery, internalMutation } from "../_generated/server";
import { requireCaseAccess } from "../auth_utils";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { rag } from "../rag/rag";
import { Id } from "../_generated/dataModel";

// ========================================
// RAG CHUNKER ACTION
// ========================================

/**
 * RAG chunker action that processes document content into chunks.
 * This is called by the RAG system to split documents into searchable chunks.
 */
export const chunkDocument = rag.defineChunkerAction(async (ctx, args): Promise<{ chunks: Array<{ text: string; metadata: Record<string, any> }> }> => {
  const { namespace, entry } = args;
  
  // Extract document information from entry metadata
  const { documentId, caseId, documentType, createdBy, fileId } = entry.metadata || {};
  
  if (!documentId || !caseId) {
    throw new Error("Missing required document metadata");
  }
  if (!fileId) {
    throw new Error("Missing required fileId");
  }

  const file = await ctx.storage.get(fileId as Id<"_storage">);

  if (!file) {
    throw new Error("File not found");
  }
  
  // Extract text from the document
  const documentContent: string = await ctx.runAction(internal.rag.utils.extractDocumentText, {
    file: fileId as Id<"_storage">,
    fileName: entry.metadata?.fileName as string,
  });
  
  // Chunk the document content
  const chunks: string[] = await ctx.runAction(internal.rag.utils.chunkDocumentContent, {
    content: documentContent,
  });

  // Return chunks in RAG format with proper metadata
  const ragChunks: Array<{ text: string; metadata: Record<string, any> }> = chunks.map((chunk: string, index: number) => {
    const metadata: Record<string, any> = {
      chunkIndex: index,
      caseId,
      documentId,
      documentType: (documentType as string) || "other",
      createdBy,
    };

    return {
      text: chunk,
      metadata,
    };
  });

  return { chunks: ragChunks };
});

// ========================================
// DOCUMENT PROCESSING FUNCTIONS
// ========================================

/**
 * Retrieves documents by processing status for a specific case.
 * Useful for showing real-time processing status in the UI.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.caseId - The ID of the case to get documents for
 * @param {"pending" | "processing" | "completed" | "failed"} [args.processingStatus] - Optional filter by processing status
 * @returns {Promise<Object[]>} Array of document records with processing status
 * @throws {Error} When not authenticated or lacking case access
 */
export const getDocumentsByProcessingStatus = query({
    args: {
      caseId: v.id("cases"),
      processingStatus: v.optional(v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed")
      )),
    },
    handler: async (ctx, args) => {
      // Verify user has access to the case
      await requireCaseAccess(ctx, args.caseId, "read");
  
      let documentsQuery = ctx.db
        .query("documents")
        .withIndex("by_case", (q) => q.eq("caseId", args.caseId));
  
      if (args.processingStatus) {
        documentsQuery = documentsQuery.filter((q) => 
          q.eq(q.field("processingStatus"), args.processingStatus)
        );
      }
  
      const documents = await documentsQuery.order("desc").collect();
      return documents;
    },
  });

// ========================================
// ASYNCHRONOUS DOCUMENT PROCESSING
// ========================================

/**
 * Internal action to process a document (chunking and embedding).
 * This runs asynchronously after document upload to avoid blocking the UI.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.documentId - The ID of the document to process
 * @throws {Error} When document not found or processing fails
 * 
 * @description This action handles the complete document processing pipeline:
 * 1. Downloads the document from storage
 * 2. Extracts text content (with OCR if needed)
 * 3. Chunks the text based on configuration
 * 4. Generates embeddings for each chunk
 * 5. Stores chunks in the RAG system
 * 6. Updates document status
 */
export const processDocument = internalAction({
    args: {
      documentId: v.id("documents"),
    },
    handler: async (ctx, args) => {
      console.log("Starting document processing for document:", args.documentId);
      
      try {
        // Get the document details
        const document = await ctx.runQuery(internal.functions.documentProcessing.getDocumentForProcessing, {
          documentId: args.documentId,
        });
        
        if (!document) {
          throw new Error(`Document not found: ${args.documentId}`);
        }
        
        // Update document status to processing
        await ctx.runMutation(internal.functions.documentProcessing.updateDocumentProcessingStatus, {
          documentId: args.documentId,
          status: "processing",
          processingStartedAt: Date.now(),
        });
        
        // Offload to external microservice instead of internal RAG processing
        const signedUrl = await ctx.storage.getUrl(document.fileId);
        const callbackUrl = `${process.env.CONVEX_SITE_URL || ''}/webhooks/document-processed`;
        const body = {
          signedUrl,
          contentType: document.mimeType,
          tenantId: String(document.createdBy),
          caseId: String(document.caseId),
          documentId: String(args.documentId),
          originalFileName: document.originalFileName,
          callbackUrl,
          hmacSecret: process.env.HMAC_SECRET,
          chunking: { maxTokens: 400, overlapRatio: 0.15, pageWindow: 50 },
        };
        const resp = await fetch(`${process.env.DOC_PROCESSOR_URL}/process-document`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!resp.ok) {
          const t = await resp.text();
          throw new Error(`Processor enqueue failed ${resp.status}: ${t}`);
        }
        const { jobId } = await resp.json();
        console.log("Enqueued external processing job", { jobId, documentId: args.documentId });
        
      } catch (error) {
        console.error("Document processing failed for document:", args.documentId, error);
        
        // Update document status to failed
        await ctx.runMutation(internal.functions.documentProcessing.updateDocumentProcessingStatus, {
          documentId: args.documentId,
          status: "failed",
          processingError: error instanceof Error ? error.message : "Unknown error",
          processingCompletedAt: Date.now(),
        });
      }
    },
  });

  /**
   * Internal query to get document details for processing.
   */
  export const getDocumentForProcessing = internalQuery({
    args: {
      documentId: v.id("documents"),
    },
    handler: async (ctx, args) => {
      return await ctx.db.get(args.documentId);
    },
  });
  
  /**
   * Internal mutation to update document processing status.
   */
  export const updateDocumentProcessingStatus = internalMutation({
    args: {
      documentId: v.id("documents"),
      status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed")
      ),
      processingStartedAt: v.optional(v.number()),
      processingCompletedAt: v.optional(v.number()),
      processingError: v.optional(v.string()),
      totalChunks: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
      const updates: any = {
        processingStatus: args.status,
      };
      
      if (args.processingStartedAt !== undefined) {
        updates.processingStartedAt = args.processingStartedAt;
      }
      
      if (args.processingCompletedAt !== undefined) {
        updates.processingCompletedAt = args.processingCompletedAt;
      }
      
      if (args.processingError !== undefined) {
        updates.processingError = args.processingError;
      }
      
      if (args.totalChunks !== undefined) {
        updates.totalChunks = args.totalChunks;
      }
      
      await ctx.db.patch(args.documentId, updates);
    },
  });

// ========================================
// RAG COMPLETION HANDLER
// ========================================

/**
 * RAG onComplete handler that updates document processing status when RAG processing finishes.
 * This handler is called regardless of success or failure, so we need to check args.error.
 */
export const onDocumentProcessingComplete = rag.defineOnComplete(
  async (ctx, args) => {
    // Extract documentId from the entry metadata
    const documentId = args.entry.metadata?.documentId;
    
    if (!documentId) {
      console.error("No documentId found in entry metadata");
      return;
    }

    // Check if the processing was successful (args.error is undefined on success)
    if (!args.error) {
      // Update document status to completed
      await ctx.runMutation(internal.functions.documentProcessing.updateDocumentProcessingStatus, {
        documentId: documentId as Id<"documents">,
        status: "completed",
        processingCompletedAt: Date.now(),
      });
      console.log(`Document processing completed successfully for document: ${documentId}`);
    } else {
      // Processing failed - update status to failed
      const errorMessage = args.error || "Unknown processing error";
      await ctx.runMutation(internal.functions.documentProcessing.updateDocumentProcessingStatus, {
        documentId: documentId as Id<"documents">,
        status: "failed",
        processingError: errorMessage,
        processingCompletedAt: Date.now(),
      });
      console.error(`Document processing failed for document: ${documentId}`, args.error);
    }
  }
);