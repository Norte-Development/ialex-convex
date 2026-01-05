import { v } from "convex/values";
import { mutation, internalMutation } from "../../_generated/server";
import { getCurrentUserFromAuth, requireNewCaseAccess } from "../../auth_utils";
import { internal } from "../../_generated/api";
import { _checkLimit, _getBillingEntity } from "../../billing/features";

/**
 * Creates a new document record associated with a case.
 *
 * Supports two storage backends:
 * - Convex storage via `fileId`
 * - Google Cloud Storage via `gcsBucket` and `gcsObject`
 *
 * @param {Object} args - The function arguments
 * @param {string} args.title - The document title or name
 * @param {string} [args.description] - Optional description of the document
 * @param {string} args.caseId - The ID of the case this document belongs to
 * @param {"contract" | "evidence" | "correspondence" | "legal_brief" | "court_filing" | "other"} [args.documentType] - The type/category of document
 * @param {string} [args.fileId] - Convex storage file ID (legacy backend)
 * @param {string} [args.gcsBucket] - GCS bucket name when using the GCS backend
 * @param {string} [args.gcsObject] - GCS object path when using the GCS backend
 * @param {string} args.originalFileName - The original name of the uploaded file
 * @param {string} args.mimeType - The MIME type of the file (e.g., "application/pdf")
 * @param {number} args.fileSize - The size of the file in bytes
 * @param {string[]} [args.tags] - Optional tags for categorizing the document
 * @returns {Promise<string>} The created document's ID
 * @throws {Error} When not authenticated or lacking full case access
 *
 * @example
 * ```javascript
 * // Using Convex storage
 * const documentId = await createDocument({
 *   title: "Settlement Agreement Draft",
 *   caseId: "case_123",
 *   documentType: "contract",
 *   fileId: "storage_file_456",
 *   originalFileName: "settlement_draft_v1.pdf",
 *   mimeType: "application/pdf",
 *   fileSize: 245760
 * });
 *
 * // Using GCS
 * const documentId = await createDocument({
 *   title: "Settlement Agreement Draft",
 *   caseId: "case_123",
 *   documentType: "contract",
 *   gcsBucket: "my-bucket",
 *   gcsObject: "cases/case_123/documents/abc/file.pdf",
 *   originalFileName: "file.pdf",
 *   mimeType: "application/pdf",
 *   fileSize: 245760
 * });
 * ```
 */
export const createDocument = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    caseId: v.id("cases"),
    folderId: v.optional(v.id("folders")),
    documentType: v.optional(
      v.union(
        v.literal("contract"),
        v.literal("evidence"),
        v.literal("correspondence"),
        v.literal("legal_brief"),
        v.literal("court_filing"),
        v.literal("other"),
      ),
    ),
    // Either legacy Convex storage or new GCS metadata
    fileId: v.optional(v.id("_storage")),
    gcsBucket: v.optional(v.string()),
    gcsObject: v.optional(v.string()),
    originalFileName: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Verify user has document write permission using NEW system
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "advanced");

    // Get team context from case
    const teamContext = await ctx.runQuery(
      internal.functions.cases.getCaseTeamContext,
      {
        caseId: args.caseId,
      },
    );

    // Check document limit
    const existingDocuments = await ctx.db
      .query("documents")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect();

    await _checkLimit(ctx, {
      userId: currentUser._id,
      teamId: teamContext ?? undefined,
      limitType: "documentsPerCase",
      currentCount: existingDocuments.length,
    });

    // Check storage limit
    await _checkLimit(ctx, {
      userId: currentUser._id,
      teamId: teamContext ?? undefined,
      limitType: "storageGB",
      additionalBytes: args.fileSize,
    });

    // If a folderId is provided, validate it exists and belongs to the same case
    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder) {
        throw new Error("Folder not found");
      }
      if (folder.caseId !== args.caseId) {
        throw new Error("Folder doesn't belong to the specified case");
      }
    }

    // Idempotency: avoid duplicate records for the same backing object
    if (args.fileId) {
      const existing = await ctx.db
        .query("documents")
        .withIndex("by_file_id", (q) => q.eq("fileId", args.fileId!))
        .first();
      if (existing) return existing._id;
    }
    if (args.gcsObject) {
      const existingGcs = await ctx.db
        .query("documents")
        .withIndex("by_gcs_object", (q) => q.eq("gcsObject", args.gcsObject!))
        .first();
      if (existingGcs) return existingGcs._id;
    }

    const documentId = await ctx.db.insert("documents", {
      title: args.title,
      description: args.description,
      caseId: args.caseId,
      folderId: args.folderId ?? undefined,
      documentType: args.documentType,
      fileId: args.fileId ?? undefined,
      storageBackend: args.gcsBucket && args.gcsObject ? "gcs" : "convex",
      gcsBucket: args.gcsBucket,
      gcsObject: args.gcsObject,
      originalFileName: args.originalFileName,
      mimeType: args.mimeType,
      fileSize: args.fileSize,
      createdBy: currentUser._id,
      tags: args.tags,
      // Set initial processing status
      processingStatus: "pending",
    });

    // Increment usage with correct entity
    const billing = await _getBillingEntity(ctx, {
      userId: currentUser._id,
      teamId: teamContext ?? undefined,
    });

    await ctx.scheduler.runAfter(0, internal.billing.features.incrementUsage, {
      entityId: billing.entityId,
      entityType: billing.entityType,
      counter: "documentsCount",
      amount: 1,
    });

    await ctx.scheduler.runAfter(0, internal.billing.features.incrementUsage, {
      entityId: billing.entityId,
      entityType: billing.entityType,
      counter: "storageUsedBytes",
      amount: args.fileSize,
    });

    // Schedule the RAG processing to run asynchronously
    await ctx.scheduler.runAfter(
      0,
      internal.functions.documentProcessing.processDocument,
      {
        documentId,
      },
    );

    console.log("Created document with id:", documentId);
    return documentId;
  },
});

/**
 * Internal version of createDocument for migrations.
 * Skips permission checks and billing limits since it's for internal use.
 */
export const internalCreateDocument = internalMutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    caseId: v.id("cases"),
    folderId: v.optional(v.id("folders")),
    documentType: v.optional(
      v.union(
        v.literal("contract"),
        v.literal("evidence"),
        v.literal("correspondence"),
        v.literal("legal_brief"),
        v.literal("court_filing"),
        v.literal("other"),
      ),
    ),
    // Either legacy Convex storage or new GCS metadata
    fileId: v.optional(v.id("_storage")),
    gcsBucket: v.optional(v.string()),
    gcsObject: v.optional(v.string()),
    originalFileName: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
    tags: v.optional(v.array(v.string())),
    createdBy: v.id("users"), // Required for internal use
  },
  returns: v.object({
    documentId: v.id("documents"),
  }),
  handler: async (ctx, args) => {
    // If a folderId is provided, validate it exists and belongs to the same case
    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder) {
        throw new Error("Folder not found");
      }
      if (folder.caseId !== args.caseId) {
        throw new Error("Folder doesn't belong to the specified case");
      }
    }

    // Idempotency: avoid duplicate records for the same backing object
    if (args.fileId) {
      const existing = await ctx.db
        .query("documents")
        .withIndex("by_file_id", (q) => q.eq("fileId", args.fileId!))
        .first();
      if (existing) return { documentId: existing._id };
    }
    if (args.gcsObject) {
      const existingGcs = await ctx.db
        .query("documents")
        .withIndex("by_gcs_object", (q) => q.eq("gcsObject", args.gcsObject!))
        .first();
      if (existingGcs) return { documentId: existingGcs._id };
    }

    const documentId = await ctx.db.insert("documents", {
      title: args.title,
      description: args.description,
      caseId: args.caseId,
      folderId: args.folderId ?? undefined,
      documentType: args.documentType,
      fileId: args.fileId ?? undefined,
      storageBackend: args.gcsBucket && args.gcsObject ? "gcs" : "convex",
      gcsBucket: args.gcsBucket,
      gcsObject: args.gcsObject,
      originalFileName: args.originalFileName,
      mimeType: args.mimeType,
      fileSize: args.fileSize,
      createdBy: args.createdBy,
      tags: args.tags,
      // Set initial processing status
      processingStatus: "pending",
    });

    // Schedule the RAG processing to run asynchronously
    await ctx.scheduler.runAfter(
      0,
      internal.functions.documentProcessing.processDocument,
      {
        documentId,
      },
    );

    console.log("Created document with id:", documentId);
    return { documentId };
  },
});

/**
 * Deletes a document and all associated data (file, RAG chunks, and database entry).
 *
 * @param {Object} args - The function arguments
 * @param {string} args.documentId - The ID of the document to delete
 * @throws {Error} When not authenticated, document not found, or lacking full case access
 *
 * @description This function completely removes a document from the system:
 * 1. Verifies user has full access to the case
 * 2. Deletes the file from Convex storage
 * 3. Removes all RAG chunks associated with the document
 * 4. Deletes the document record from the database
 *
 * This operation is irreversible and permanently removes all document data.
 *
 * @example
 * ```javascript
 * await deleteDocument({ documentId: "document_123" });
 * ```
 */
export const deleteDocument = mutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    // Verify user has document delete permission using NEW system
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, document.caseId, "admin");

    // Delete document chunks from Qdrant
    try {
      await ctx.scheduler.runAfter(
        0,
        internal.rag.qdrantUtils.caseDocuments.deleteDocumentChunks,
        {
          documentId: args.documentId,
          caseId: document.caseId,
        },
      );
    } catch {
      // Ignore Qdrant deletion failure; continue deleting storage and DB record
    }

    // Get team context from case to decrement usage from correct entity
    const teamContext = await ctx.runQuery(
      internal.functions.cases.getCaseTeamContext,
      {
        caseId: document.caseId,
      },
    );

    const billing = await _getBillingEntity(ctx, {
      userId: currentUser._id,
      teamId: teamContext ?? undefined,
    });

    // Decrement usage counters for document count and storage
    await ctx.scheduler.runAfter(0, internal.billing.features.incrementUsage, {
      entityId: billing.entityId,
      entityType: billing.entityType,
      counter: "documentsCount",
      amount: -1, // Negative to decrement
    });

    await ctx.scheduler.runAfter(0, internal.billing.features.incrementUsage, {
      entityId: billing.entityId,
      entityType: billing.entityType,
      counter: "storageUsedBytes",
      amount: -document.fileSize, // Negative to decrement
    });

    // Delete the document record
    await ctx.db.delete(args.documentId);

    return { success: true };
  },
});

/**
 * Moves a document to a different folder within the same case.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.documentId - The ID of the document to move
 * @param {string} [args.newFolderId] - The ID of the target folder (undefined for root)
 * @returns {Promise<void>}
 * @throws {Error} When not authenticated, lacking permissions, or validation fails
 *
 * @example
 * ```javascript
 * // Move document to a specific folder
 * await moveDocument({
 *   documentId: "document_123",
 *   newFolderId: "folder_456"
 * });
 *
 * // Move document to root (no folder)
 * await moveDocument({
 *   documentId: "document_123",
 *   newFolderId: undefined
 * });
 * ```
 */
export const moveDocument = mutation({
  args: {
    documentId: v.id("documents"),
    newFolderId: v.optional(v.id("folders")),
  },
  handler: async (ctx, args) => {
    // Get the document to verify it exists and get its case ID
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    // Verify user has document write permission using NEW system
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(
      ctx,
      currentUser._id,
      document.caseId,
      "advanced",
    );

    // If a newFolderId is provided, validate it exists and belongs to the same case
    if (args.newFolderId) {
      const targetFolder = await ctx.db.get(args.newFolderId);
      if (!targetFolder) {
        throw new Error("Target folder not found");
      }
      if (targetFolder.caseId !== document.caseId) {
        throw new Error("Target folder doesn't belong to the same case");
      }
    }

    // Update the document's folderId
    await ctx.db.patch(args.documentId, {
      folderId: args.newFolderId,
    });
  },
});

