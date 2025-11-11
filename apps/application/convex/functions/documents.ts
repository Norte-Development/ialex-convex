import { v } from "convex/values";
import {
  query,
  mutation,
  action,
  internalQuery,
  internalMutation,
} from "../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { getCurrentUserFromAuth, requireNewCaseAccess } from "../auth_utils";
import { prosemirrorSync } from "../prosemirror";
import { internal, api } from "../_generated/api";
import { _checkLimit, _getBillingEntity } from "../billing/features";
import { PLAN_LIMITS } from "../billing/planLimits";

/**
 * Generates a Google Cloud Storage V4 signed URL for client-side uploads.
 *
 * Auth: requires an authenticated user.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.caseId - The case ID the uploaded file will be associated with
 * @param {string} args.originalFileName - Original filename; used to construct the object path
 * @param {string} args.mimeType - MIME type to be enforced by the signed request
 * @param {number} args.fileSize - Size in bytes (informational for clients; not enforced server-side)
 * @returns {Promise<{url: string, bucket: string, object: string, contentType: string, expiresAt: number}>}
 * A payload containing the signed upload URL and target object metadata.
 * @throws {Error} If the user is unauthenticated or GCS configuration is missing
 */
export const generateUploadUrl = action({
  args: {
    caseId: v.id("cases"),
    originalFileName: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    url: string;
    bucket: string;
    object: string;
    contentType: string;
    expiresAt: number;
  }> => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Get current user from database
    const currentUser = await ctx.runQuery(
      api.functions.users.getCurrentUser,
      {},
    );

    if (!currentUser) {
      throw new Error("User not found");
    }

    // Check storage limits before generating upload URL
    const userPlan = await ctx.runQuery(api.billing.features.getUserPlan, {
      userId: currentUser._id,
    });

    const usage = await ctx.runQuery(api.billing.features.getUsageLimits, {
      entityId: currentUser._id,
    });

    // If no usage record exists yet, it will be created in createDocument
    // For now, assume 0 usage to allow first upload
    const storageUsedBytes = usage?.storageUsedBytes || 0;

    const limits = PLAN_LIMITS[
      userPlan
    ] as (typeof PLAN_LIMITS)[keyof typeof PLAN_LIMITS];

    // Check storage limit (convert GB to bytes)
    const storageLimitBytes = limits.storageGB * 1024 * 1024 * 1024;
    const newStorageTotal = storageUsedBytes + args.fileSize;

    if (newStorageTotal > storageLimitBytes) {
      const availableGB =
        (storageLimitBytes - storageUsedBytes) / (1024 * 1024 * 1024);
      throw new Error(
        `No tienes suficiente espacio de almacenamiento. Disponible: ${availableGB.toFixed(2)}GB. Actualiza a Premium para más almacenamiento.`,
      );
    }

    const bucket = process.env.GCS_BUCKET as string;
    const ttl = Number(process.env.GCS_UPLOAD_URL_TTL_SECONDS || 900);

    if (!bucket) {
      throw new Error("Missing GCS bucket configuration");
    }

    const timestamp = Date.now();
    const objectPath = `cases/${args.caseId}/documents/${crypto.randomUUID()}/${timestamp}-${args.originalFileName}`;

    const {
      url,
      bucket: returnedBucket,
      object,
      expiresSeconds,
    }: {
      url: string;
      bucket: string;
      object: string;
      expiresSeconds: number;
    } = await ctx.runAction(internal.utils.gcs.generateGcsV4SignedUrlAction, {
      bucket,
      object: objectPath,
      expiresSeconds: ttl,
      method: "PUT",
      contentType: args.mimeType,
    });

    return {
      url,
      bucket: returnedBucket,
      object,
      contentType: args.mimeType,
      expiresAt: Date.now() + expiresSeconds * 1000,
    };
  },
});

// ========================================
// DOCUMENT MANAGEMENT
// ========================================

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
 * Retrieves all documents associated with a specific case.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.caseId - The ID of the case to get documents for
 * @returns {Promise<Object[]>} Array of document records ordered by creation date (newest first)
 * @throws {Error} When not authenticated or lacking case access
 *
 * @description This function returns all documents belonging to a case, ordered by
 * creation date with the most recent first. The user must have read access to the
 * case to view its documents.
 *
 * @example
 * ```javascript
 * const documents = await getDocuments({ caseId: "case_123" });
 * // Returns: [{ title: "Contract", fileId: "...", createdBy: "..." }, ...]
 * ```
 */
export const getDocuments = query({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    // Verify user has document read permission using NEW system
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .order("desc")
      .collect();

    return documents;
  },
});

/**
 * Retrieves documents for a specific case filtered by folder.
 * If folderId is omitted, returns documents without any folder (root level).
 */
export const getDocumentsInFolder = query({
  args: {
    caseId: v.id("cases"),
    folderId: v.optional(v.id("folders")),
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
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
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  returns: v.object({
    page: v.array(v.any()),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
    totalCount: v.number(),
  }),
  handler: async (ctx, args) => {
    // Verify user has document read permission using NEW system
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");

    // Get all documents for the case and folder
    let documents = await ctx.db
      .query("documents")
      .withIndex("by_case_and_folder", (q) =>
        q.eq("caseId", args.caseId).eq("folderId", args.folderId ?? undefined),
      )
      .collect();

    // Apply search filter
    if (args.search && args.search.trim()) {
      const searchTerm = args.search.toLowerCase().trim();
      documents = documents.filter(
        (doc) =>
          doc.title.toLowerCase().includes(searchTerm) ||
          (doc.description &&
            doc.description.toLowerCase().includes(searchTerm)) ||
          (doc.originalFileName &&
            doc.originalFileName.toLowerCase().includes(searchTerm)),
      );
    }

    // Apply document type filter
    if (args.documentType) {
      documents = documents.filter(
        (doc) => doc.documentType === args.documentType,
      );
    }

    // Apply sorting
    if (args.sortBy && args.sortOrder) {
      documents.sort((a, b) => {
        let aValue, bValue;

        switch (args.sortBy) {
          case "title":
            aValue = a.title.toLowerCase();
            bValue = b.title.toLowerCase();
            break;
          case "documentType":
            aValue = a.documentType || "";
            bValue = b.documentType || "";
            break;
          case "fileSize":
            aValue = a.fileSize;
            bValue = b.fileSize;
            break;
          case "createdAt":
          default:
            aValue = a._creationTime;
            bValue = b._creationTime;
            break;
        }

        if (aValue < bValue) return args.sortOrder === "asc" ? -1 : 1;
        if (aValue > bValue) return args.sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    } else {
      // Default sort by creation time (newest first)
      documents.sort((a, b) => b._creationTime - a._creationTime);
    }

    // Apply pagination
    const offset = args.paginationOpts.cursor
      ? parseInt(args.paginationOpts.cursor)
      : 0;
    const startIndex = offset;
    const endIndex = offset + args.paginationOpts.numItems;

    const paginatedDocuments = documents.slice(startIndex, endIndex);
    const isDone = endIndex >= documents.length;
    const continueCursor = isDone ? null : endIndex.toString();

    return {
      page: paginatedDocuments,
      isDone,
      continueCursor,
      totalCount: documents.length,
    };
  },
});

/**
 * Retrieves a specific document by ID.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.documentId - The ID of the document to retrieve
 * @returns {Promise<Object|null>} The document record or null if not found
 * @throws {Error} When not authenticated or lacking case access
 *
 * @description This function returns a specific document by its ID. The user must
 * have read access to the case that the document belongs to.
 */
export const getDocument = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);

    if (!document) {
      return null;
    }

    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, document.caseId, "basic");

    return document;
  },
});

/**
 * Get transcription data for an audio/video document
 */
export const getDocumentTranscription = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);

    if (!document) {
      return null;
    }

    // Verify permissions
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, document.caseId, "basic");

    // Only return transcription for audio/video files
    if (
      !document.mimeType?.startsWith("audio/") &&
      !document.mimeType?.startsWith("video/")
    ) {
      return null;
    }

    return {
      extractedText: document.extractedText,
      extractedTextLength: document.extractedTextLength,
      transcriptionConfidence: document.transcriptionConfidence,
      transcriptionDuration: document.transcriptionDuration,
      transcriptionModel: document.transcriptionModel,
      hasExtractedText: !!document.extractedText,
    };
  },
});

/**
 * Internal helper for agent tools to get document without permission checks.
 * Agent tools have full read access by design.
 */
export const getDocumentForAgent = internalQuery({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    return document;
  },
});

/**
 * Internal helper for agent tools to get documents by case without permission checks.
 * Agent tools have full read access by design.
 */
export const getDocumentsForAgent = internalQuery({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .order("desc")
      .collect();

    return documents;
  },
});

/**
 * Gets a signed URL for downloading a document from Convex storage.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.documentId - The ID of the document to get URL for
 * @returns {Promise<string|null>} The signed URL or null if document not found
 * @throws {Error} When not authenticated or lacking case access
 *
 * @description This function generates a signed URL for downloading a document
 * from Convex storage. The user must have read access to the case that the
 * document belongs to.
 */
export const getDocumentUrl = action({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args): Promise<string | null> => {
    // Fetch document via query to leverage DB and permission checks
    const document = await ctx.runQuery(api.functions.documents.getDocument, {
      documentId: args.documentId,
    });
    if (!document) return null;

    if (
      document.storageBackend === "gcs" &&
      document.gcsBucket &&
      document.gcsObject
    ) {
      const bucket = document.gcsBucket as string;
      const object = document.gcsObject as string;
      const ttl = Number(process.env.GCS_DOWNLOAD_URL_TTL_SECONDS || 900);
      if (!bucket || !object)
        throw new Error("Missing GCS signing configuration");

      const { url: signedUrl }: { url: string } = await ctx.runAction(
        internal.utils.gcs.generateGcsV4SignedUrlAction,
        { bucket, object, expiresSeconds: ttl, method: "GET" },
      );
      return signedUrl;
    }

    if (document.fileId) {
      const legacyUrl = await ctx.storage.getUrl(document.fileId);
      return legacyUrl;
    }
    return null;
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

// ========================================
// ESCRITO MANAGEMENT (Simplified)
// ========================================

/**
 * Creates a new escrito (legal writing/brief) for a case.
 *
 * This mutation is idempotent: if an escrito with the given prosemirrorId already exists,
 * it returns the existing escrito instead of creating a duplicate. This prevents accidental
 * duplicate creation from multiple calls with the same prosemirrorId.
 *
 * The ProseMirror document will be created client-side when the editor loads,
 * following the empty document pattern for collaborative editing.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.title - The escrito title
 * @param {string} args.caseId - The ID of the case this escrito belongs to
 * @param {string} args.prosemirrorId - The UUID for the ProseMirror document (must be unique)
 * @param {number} [args.presentationDate] - Optional timestamp for when this will be presented
 * @param {string} [args.courtName] - Name of the court where this will be filed
 * @param {string} [args.expedientNumber] - Court expedient/case number
 * @returns {Promise<{escritoId: string, prosemirrorId: string, alreadyExists: boolean}>} IDs for the created (or existing) escrito, its ProseMirror document, and a flag indicating if it already existed
 * @throws {Error} When not authenticated or lacking full case access
 *
 * @example
 * ```javascript
 * const prosemirrorId = crypto.randomUUID();
 * const { escritoId } = await createEscrito({
 *   title: "Motion to Dismiss",
 *   caseId: "case_123",
 *   prosemirrorId: prosemirrorId,
 *   courtName: "Supreme Court",
 *   expedientNumber: "SC-2024-001"
 * });
 * ```
 */
export const createEscrito = mutation({
  args: {
    title: v.string(),
    caseId: v.id("cases"),
    prosemirrorId: v.string(), // Accept the prosemirror ID from client
    presentationDate: v.optional(v.number()),
    courtName: v.optional(v.string()),
    expedientNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify user has escrito write permission
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "advanced");

    // IDEMPOTENCY CHECK: Check if an escrito with this prosemirrorId already exists
    const existingEscrito = await ctx.db
      .query("escritos")
      .withIndex("by_prosemirror_id", (q) =>
        q.eq("prosemirrorId", args.prosemirrorId),
      )
      .first();

    if (existingEscrito) {
      console.log(
        "Escrito with prosemirrorId already exists:",
        existingEscrito._id,
      );
      // Return the existing escrito instead of creating a duplicate
      return {
        escritoId: existingEscrito._id,
        prosemirrorId: existingEscrito.prosemirrorId,
        alreadyExists: true,
      };
    }

    // Get team context
    const teamContext = await ctx.runQuery(
      internal.functions.cases.getCaseTeamContext,
      {
        caseId: args.caseId,
      },
    );

    // Check escritos limit
    const existingEscritos = await ctx.db
      .query("escritos")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    await _checkLimit(ctx, {
      userId: currentUser._id,
      teamId: teamContext ?? undefined,
      limitType: "escritosPerCase",
      currentCount: existingEscritos.length,
    });

    // Just store the escrito record with the provided prosemirrorId
    // The ProseMirror document will be created client-side when the editor loads
    const escritoId = await ctx.db.insert("escritos", {
      title: args.title,
      caseId: args.caseId,
      status: "borrador",
      presentationDate: args.presentationDate,
      courtName: args.courtName,
      expedientNumber: args.expedientNumber,
      prosemirrorId: args.prosemirrorId,
      lastEditedAt: Date.now(),
      createdBy: currentUser._id,
      lastModifiedBy: currentUser._id,
      isArchived: false,
    });

    // Increment with correct entity
    const billing = await _getBillingEntity(ctx, {
      userId: currentUser._id,
      teamId: teamContext ?? undefined,
    });

    await ctx.scheduler.runAfter(0, internal.billing.features.incrementUsage, {
      entityId: billing.entityId,
      entityType: billing.entityType,
      counter: "escritosCount",
      amount: 1,
    });

    console.log("Created escrito with id:", escritoId);
    return {
      escritoId,
      prosemirrorId: args.prosemirrorId,
      alreadyExists: false,
    };
  },
});



export const createEscritoInternal = internalMutation({
  args: {

    title: v.string(),
    caseId: v.id("cases"),
    userId: v.id("users"),
    initialContent: v.string(),
  },
  handler: async (ctx, args) => {

    const prosemirrorId = crypto.randomUUID();

    await prosemirrorSync.create(ctx, prosemirrorId, {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: args.initialContent,
            },
          ],
        },
      ]
    });

    const now = Date.now();

    const escritoId = await ctx.db.insert("escritos", {
      title: args.title,
      caseId: args.caseId,
      prosemirrorId: prosemirrorId,
      status: "borrador",
      createdBy: args.userId,
      lastModifiedBy: args.userId,
      isArchived: false,
      lastEditedAt: now,
      // Reasonable defaults for optional metadata fields
      expedientNumber: undefined,
      presentationDate: undefined,
      courtName: undefined,
      wordCount: undefined,
    });

    return { escritoId };
  },
});

/**
 * Updates an existing escrito with new content or metadata.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.escritoId - The ID of the escrito to update
 * @param {string} [args.title] - New title for the escrito
 * @param {string} [args.content] - New content in Tiptap JSON format
 * @param {"borrador" | "terminado"} [args.status] - New status (draft or finished)
 * @param {number} [args.presentationDate] - New presentation date timestamp
 * @param {string} [args.courtName] - New court name
 * @param {string} [args.expedientNumber] - New expedient number
 * @throws {Error} When not authenticated, escrito not found, or lacking full case access
 *
 * @description This function updates an escrito with new data. Only provided fields
 * are updated, allowing for partial updates. The function automatically updates
 * the modification timestamp and word count when content changes.
 *
 * @example
 * ```javascript
 * // Update content and mark as finished
 * await updateEscrito({
 *   escritoId: "escrito_123",
 *   content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Final version..."}]}]}',
 *   status: "terminado"
 * });
 *
 * // Update only court information
 * await updateEscrito({
 *   escritoId: "escrito_123",
 *   courtName: "Appeals Court",
 *   expedientNumber: "AC-2024-002"
 * });
 * ```
 */
export const updateEscrito = mutation({
  args: {
    escritoId: v.id("escritos"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    status: v.optional(v.union(v.literal("borrador"), v.literal("terminado"))),
    presentationDate: v.optional(v.number()),
    courtName: v.optional(v.string()),
    expedientNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get the escrito to check case access
    const escrito = await ctx.db.get(args.escritoId);
    if (!escrito) {
      throw new Error("Escrito not found");
    }

    // Verify user has escrito write permission using NEW system
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(
      ctx,
      currentUser._id,
      escrito.caseId,
      "advanced",
    );

    const updates: any = {
      lastModifiedBy: currentUser._id,
      lastEditedAt: Date.now(),
    };

    if (args.title) updates.title = args.title;
    if (args.content) {
      updates.content = args.content;
      updates.wordCount = args.content.length; // Update word count
    }
    if (args.status) updates.status = args.status;
    if (args.presentationDate !== undefined)
      updates.presentationDate = args.presentationDate;
    if (args.courtName !== undefined) updates.courtName = args.courtName;
    if (args.expedientNumber !== undefined)
      updates.expedientNumber = args.expedientNumber;

    await ctx.db.patch(args.escritoId, updates);
    console.log("Updated escrito:", args.escritoId);
  },
});

/**
 * Retrieves all active escritos for a specific case.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.caseId - The ID of the case to get escritos for
 * @returns {Promise<Object[]>} Array of escrito records ordered by creation date (newest first)
 * @throws {Error} When not authenticated or lacking case access
 *
 * @description This function returns all non-archived escritos belonging to a case,
 * ordered by creation date with the most recent first. The user must have read
 * access to the case to view its escritos.
 *
 * @example
 * ```javascript
 * const escritos = await getEscritos({ caseId: "case_123" });
 * // Returns: [{ title: "Motion", status: "borrador", wordCount: 1500 }, ...]
 * ```
 */
export const getEscritos = query({
  args: {
    caseId: v.id("cases"),
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    status: v.optional(v.union(v.literal("borrador"), v.literal("terminado"))),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  returns: v.object({
    page: v.array(v.any()),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
    totalCount: v.number(),
  }),
  handler: async (ctx, args) => {
    // Verify user has escrito read permission using NEW system
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");

    // Get all escritos for the case
    let escritos = await ctx.db
      .query("escritos")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    // Apply search filter
    if (args.search && args.search.trim()) {
      const searchTerm = args.search.toLowerCase().trim();
      escritos = escritos.filter((escrito) =>
        escrito.title.toLowerCase().includes(searchTerm),
      );
    }

    // Apply status filter
    if (args.status) {
      escritos = escritos.filter((escrito) => escrito.status === args.status);
    }

    // Apply sorting
    if (args.sortBy && args.sortOrder) {
      escritos.sort((a, b) => {
        let aValue, bValue;

        switch (args.sortBy) {
          case "title":
            aValue = a.title.toLowerCase();
            bValue = b.title.toLowerCase();
            break;
          case "status":
            aValue = a.status;
            bValue = b.status;
            break;
          case "createdAt":
          default:
            aValue = a._creationTime;
            bValue = b._creationTime;
            break;
        }

        if (aValue < bValue) return args.sortOrder === "asc" ? -1 : 1;
        if (aValue > bValue) return args.sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    } else {
      // Default sort by creation time (newest first)
      escritos.sort((a, b) => b._creationTime - a._creationTime);
    }

    // Apply pagination
    const offset = args.paginationOpts.cursor
      ? parseInt(args.paginationOpts.cursor)
      : 0;
    const startIndex = offset;
    const endIndex = offset + args.paginationOpts.numItems;

    const paginatedEscritos = escritos.slice(startIndex, endIndex);
    const isDone = endIndex >= escritos.length;
    const continueCursor = isDone ? null : endIndex.toString();

    return {
      page: paginatedEscritos,
      isDone,
      continueCursor,
      totalCount: escritos.length,
    };
  },
});

export const getEscritosForAgent = internalQuery({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("escritos")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .order("desc")
      .collect();
  },
});

/**
 * Retrieves a specific escrito by ID.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.escritoId - The ID of the escrito to retrieve
 * @returns {Promise<Object>} The escrito record
 * @throws {Error} When not authenticated, the escrito is not found, or access is denied
 *
 * @description Fetches an escrito and validates the requester has read access to the
 * corresponding case.
 *
 * @example
 * ```javascript
 * const escrito = await getEscrito({ escritoId: "escrito_123" });
 * // Returns: { title: "Motion", status: "borrador", ... }
 * ```
 */

export const getEscrito = query({
  args: {
    escritoId: v.id("escritos"),
  },
  handler: async (ctx, args) => {
    // First get the escrito to access its caseId
    const escrito = await ctx.db.get(args.escritoId);
    if (!escrito) {
      throw new Error("Escrito not found");
    }

    // Verify user has escrito read permission using the case ID
    // await requireEscritoPermission(ctx, escrito.caseId, "read");
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, escrito.caseId, "basic");

    return escrito;
  },
});

export const internalGetEscrito = internalQuery({
  args: {
    escritoId: v.id("escritos"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.escritoId);
  },
});

/**
 * Archives or unarchives an escrito.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.escritoId - The ID of the escrito to archive/unarchive
 * @param {boolean} args.isArchived - Whether to archive (true) or unarchive (false) the escrito
 * @throws {Error} When not authenticated, escrito not found, or lacking full case access
 *
 * @description This function toggles the archived status of an escrito. When archived,
 * the escrito will no longer appear in the main escritos list but can be restored later.
 * The user must have full access to the case to archive/unarchive escritos.
 *
 * @example
 * ```javascript
 * // Archive an escrito
 * await archiveEscrito({
 *   escritoId: "escrito_123",
 *   isArchived: true
 * });
 *
 * // Unarchive an escrito
 * await archiveEscrito({
 *   escritoId: "escrito_123",
 *   isArchived: false
 * });
 * ```
 */
export const archiveEscrito = mutation({
  args: {
    escritoId: v.id("escritos"),
    isArchived: v.boolean(),
  },
  handler: async (ctx, args) => {
    const escrito = await ctx.db.get(args.escritoId);
    if (!escrito) {
      throw new Error("Escrito not found");
    }

    // Verify user has escrito delete permission for archiving using NEW system
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, escrito.caseId, "admin");

    // Update the archived status
    await ctx.db.patch(args.escritoId, { isArchived: args.isArchived });

    // Get team context from case to update usage counter from correct entity
    const teamContext = await ctx.runQuery(
      internal.functions.cases.getCaseTeamContext,
      {
        caseId: escrito.caseId,
      },
    );

    const billing = await _getBillingEntity(ctx, {
      userId: currentUser._id,
      teamId: teamContext ?? undefined,
    });

    // Update usage counter based on archiving action
    // Archiving: decrement counter (removing from active count)
    // Unarchiving: increment counter (adding back to active count)
    const counterChange = args.isArchived ? -1 : 1;
    await ctx.scheduler.runAfter(0, internal.billing.features.incrementUsage, {
      entityId: billing.entityId,
      entityType: billing.entityType,
      counter: "escritosCount",
      amount: counterChange,
    });

    return { success: true };
  },
});

/**
 * Retrieves all archived escritos for a specific case.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.caseId - The ID of the case to get archived escritos for
 * @returns {Promise<Object[]>} Array of archived escrito records ordered by creation date (newest first)
 * @throws {Error} When not authenticated or lacking case access
 *
 * @description This function returns all archived escritos belonging to a case,
 * ordered by creation date with the most recent first. The user must have read
 * access to the case to view its archived escritos.
 *
 * @example
 * ```javascript
 * const archivedEscritos = await getArchivedEscritos({ caseId: "case_123" });
 * // Returns: [{ title: "Old Motion", status: "terminado", isArchived: true }, ...]
 * ```
 */
export const getArchivedEscritos = query({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    // Verify user has escrito read permission using NEW system
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");

    const archivedEscritos = await ctx.db
      .query("escritos")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isArchived"), true))
      .order("desc")
      .collect();

    return archivedEscritos;
  },
});

/**
 * Searches escritos by title for a specific case.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.caseId - The ID of the case
 * @param {string} args.query - The search query string
 * @param {number} [args.limit] - Maximum number of results (default: 20)
 * @returns {Promise<Object[]>} Array of matching escrito documents
 * @throws {Error} When not authenticated or lacking case access
 *
 * @description Performs a case-insensitive search on escrito titles.
 * Only returns non-archived escritos.
 *
 * @example
 * ```javascript
 * const results = await searchEscritos({
 *   caseId: "case_123",
 *   query: "motion",
 *   limit: 10
 * });
 * ```
 */
export const searchEscritos = query({
  args: {
    caseId: v.id("cases"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    // Verify user has escrito read permission
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");

    const limit = args.limit || 20;
    const searchTerm = args.query.toLowerCase().trim();

    if (!searchTerm) {
      return [];
    }

    // Get all non-archived escritos for the case
    const escritos = await ctx.db
      .query("escritos")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    // Filter by search term and limit results
    return escritos
      .filter((escrito) => escrito.title.toLowerCase().includes(searchTerm))
      .sort((a, b) => b.lastEditedAt - a.lastEditedAt)
      .slice(0, limit);
  },
});

/**
 * Gets the most recent escritos for a specific case.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.caseId - The ID of the case
 * @param {number} [args.limit] - Maximum number of results (default: 10)
 * @returns {Promise<Object[]>} Array of recent escrito documents
 * @throws {Error} When not authenticated or lacking case access
 *
 * @description Returns the most recently edited non-archived escritos.
 *
 * @example
 * ```javascript
 * const recent = await getRecentEscritos({
 *   caseId: "case_123",
 *   limit: 5
 * });
 * ```
 */
export const getRecentEscritos = query({
  args: {
    caseId: v.id("cases"),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    // Verify user has escrito read permission
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");

    const limit = args.limit || 10;

    const escritos = await ctx.db
      .query("escritos")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .order("desc")
      .take(limit);

    return escritos;
  },
});

/**
 * Gets all documents in a folder without pagination (optimized for virtual scrolling).
 *
 * @param {Object} args - The function arguments
 * @param {string} args.caseId - The ID of the case
 * @param {string} [args.folderId] - Optional folder ID (undefined for root)
 * @returns {Promise<Object[]>} Array of all document documents
 * @throws {Error} When not authenticated or lacking case access
 *
 * @description This function returns ALL documents for a folder without pagination.
 * Use this with virtual scrolling on the frontend for optimal performance with large datasets.
 *
 * @example
 * ```javascript
 * const allDocs = await getAllDocumentsInFolder({
 *   caseId: "case_123",
 *   folderId: "folder_456"
 * });
 * ```
 */
export const getAllDocumentsInFolder = query({
  args: {
    caseId: v.id("cases"),
    folderId: v.optional(v.id("folders")),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    // Verify user has document read permission
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");

    // Get all documents for the case and folder
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_case_and_folder", (q) =>
        q.eq("caseId", args.caseId).eq("folderId", args.folderId ?? undefined),
      )
      .collect();

    // Sort by creation time (most recent first)
    documents.sort((a, b) => b._creationTime - a._creationTime);

    return documents;
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
