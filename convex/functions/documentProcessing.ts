import { query, mutation, internalAction, internalQuery, internalMutation } from "../_generated/server";
import { requireCaseAccess } from "../auth_utils";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { rag } from "../rag/rag";
import { Id } from "../_generated/dataModel";
import { extractDocumentText, chunkDocumentContent } from "../rag/utils";

// ========================================
// RAG CHUNKER ACTION
// ========================================

/**
 * RAG chunker action that processes document content into chunks.
 * This is called by the RAG system to split documents into searchable chunks.
 */
export const chunkDocument = rag.defineChunkerAction(async (ctx, args) => {
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
  
  // This is a placeholder - replace with actual document text extraction
  const documentContent = await extractDocumentText(file);
  
  // TODO: IMPLEMENT CHUNKING STRATEGY
  // This is a placeholder - replace with actual chunking logic
  const chunks = await chunkDocumentContent(documentContent, {
    chunkSize: 1000,
    overlap: 200,
    strategy: "semantic"
  });

  // Return chunks in RAG format with proper metadata
  const ragChunks = chunks.map((chunk, index) => {
    const metadata: Record<string, any> = {
      chunkIndex: index,
      chunkType: chunk.type,
      wordCount: chunk.wordCount,
      charCount: chunk.charCount,
      // Add filters for search
      caseId,
      documentId,
      documentType: (documentType as string) || "other",
      createdBy,
    };

    // Only add optional fields if they have values
    if (chunk.pageNumber !== undefined) {
      metadata.pageNumber = chunk.pageNumber;
    }
    if (chunk.sectionTitle !== undefined) {
      metadata.sectionTitle = chunk.sectionTitle;
    }

    return {
      text: chunk.text,
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
        
        // Add document to RAG system with proper filters
        const { entryId } = await rag.addAsync(ctx, {
          namespace: `case-${document.caseId}`,
          key: `document-${args.documentId}`,
          metadata: { 
            documentId: args.documentId,
            caseId: document.caseId,
            documentType: document.documentType || 'other',
            createdBy: document.createdBy,
            fileId: document.fileId
          },
          filterValues: [
            { name: "caseId", value: document.caseId },
            { name: "documentId", value: args.documentId },
            { name: "documentType", value: document.documentType || "other" },
            { name: "createdBy", value: document.createdBy }
          ],
          chunkerAction: internal.functions.documentProcessing.chunkDocument,
          onComplete: internal.functions.documentProcessing.onDocumentProcessingComplete,
        });
        
        console.log("Document processing initiated for document:", args.documentId, "entryId:", entryId);
        
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
 */
export const onDocumentProcessingComplete = rag.defineOnComplete(
  async (ctx, args) => {
    // Extract documentId from the entry metadata
    const documentId = args.entry.metadata?.documentId;
    if (documentId) {
      // Update document status to completed
      await ctx.runMutation(internal.functions.documentProcessing.updateDocumentProcessingStatus, {
        documentId: documentId as Id<"documents">,
        status: "completed",
        processingCompletedAt: Date.now(),
      });
    }
  }
);