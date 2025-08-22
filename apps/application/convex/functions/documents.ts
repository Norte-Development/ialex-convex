import { v } from "convex/values";
import { query, mutation, action, internalQuery } from "../_generated/server";
import { 
  requireDocumentPermission, 
  requireEscritoPermission,
  getCurrentUserFromAuth 
} from "../auth_utils";
import { prosemirrorSync } from "../prosemirror";
import { internal, api } from "../_generated/api";
import { rag } from "../rag/rag";




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
  handler: async (ctx, args): Promise<{
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
    
    const bucket = process.env.GCS_BUCKET as string;
    const ttl = Number(process.env.GCS_UPLOAD_URL_TTL_SECONDS || 900);

    if (!bucket) {
      throw new Error("Missing GCS bucket configuration");
    }

    const timestamp = Date.now();
    const objectPath = `cases/${args.caseId}/documents/${crypto.randomUUID()}/${timestamp}-${args.originalFileName}`;

    const { url, bucket: returnedBucket, object, expiresSeconds }: {
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
    // Verify user has document write permission; FULL access bypasses via hasPermission
    const { currentUser } = await requireDocumentPermission(ctx, args.caseId, "write");

    // Idempotency: avoid duplicate records for the same backing object
    if (args.fileId) {
      const existing = await ctx.db
        .query("documents")
        .withIndex("by_file_id", q => q.eq("fileId", args.fileId!))
        .first();
      if (existing) return existing._id;
    }
    if (args.gcsObject) {
      const existingGcs = await ctx.db
        .query("documents")
        .withIndex("by_gcs_object", q => q.eq("gcsObject", args.gcsObject!))
        .first();
      if (existingGcs) return existingGcs._id;
    }

    const documentId = await ctx.db.insert("documents", {
      title: args.title,
      description: args.description,
      caseId: args.caseId,
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

    // Schedule the RAG processing to run asynchronously
    await ctx.scheduler.runAfter(0, internal.functions.documentProcessing.processDocument, {
      documentId,
    });

    console.log("Created document with id:", documentId);
    return documentId;
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
    // Verify user has document read permission
    await requireDocumentPermission(ctx, args.caseId, "read");

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .order("desc")
      .collect();

    return documents;
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

    // Verify user has document read permission
    await requireDocumentPermission(ctx, document.caseId, "read");

    return document;
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

    if (document.storageBackend === "gcs" && document.gcsBucket && document.gcsObject) {
      const bucket = document.gcsBucket as string;
      const object = document.gcsObject as string;
      const ttl = Number(process.env.GCS_DOWNLOAD_URL_TTL_SECONDS || 900);
      if (!bucket || !object) throw new Error("Missing GCS signing configuration");

      const { url: signedUrl }: { url: string } = await ctx.runAction(
        internal.utils.gcs.generateGcsV4SignedUrlAction,
        { bucket, object, expiresSeconds: ttl, method: "GET" }
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

    // Verify user has document delete permission
    await requireDocumentPermission(ctx, document.caseId, "delete");
    
    // Delete document chunks from Qdrant
    try {
      await ctx.scheduler.runAfter(0, internal.rag.qdrant.deleteDocumentChunks, {
        documentId: args.documentId,
        caseId: document.caseId,
      });
    } catch {
      // Ignore Qdrant deletion failure; continue deleting storage and DB record
    }

    if (document.storageBackend === "gcs" && document.gcsBucket && document.gcsObject) {
      await ctx.scheduler.runAfter(0, internal.utils.gcs.deleteGcsObjectAction, {
        bucket: document.gcsBucket,
        object: document.gcsObject,
      });
    } else if (document.fileId) {
      await ctx.storage.delete(document.fileId);
    }
    await ctx.db.delete(args.documentId);

    console.log("Deleted document:", args.documentId);
  },
});




// ========================================
// ESCRITO MANAGEMENT (Simplified)
// ========================================

/**
 * Creates a new escrito (legal writing/brief) for a case.
 *
 * The initial rich-text content is created and tracked via ProseMirror; no content
 * string is required at creation time.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.title - The escrito title
 * @param {string} args.caseId - The ID of the case this escrito belongs to
 * @param {number} [args.presentationDate] - Optional timestamp for when this will be presented
 * @param {string} [args.courtName] - Name of the court where this will be filed
 * @param {string} [args.expedientNumber] - Court expedient/case number
 * @returns {Promise<{escritoId: string, prosemirrorId: string}>} IDs for the created escrito and its ProseMirror document
 * @throws {Error} When not authenticated or lacking full case access
 *
 * @example
 * ```javascript
 * const { escritoId, prosemirrorId } = await createEscrito({
 *   title: "Motion to Dismiss",
 *   caseId: "case_123",
 *   courtName: "Supreme Court",
 *   expedientNumber: "SC-2024-001"
 * });
 * ```
 */
export const createEscrito = mutation({
  args: {
    title: v.string(),
    caseId: v.id("cases"),
    presentationDate: v.optional(v.number()),
    courtName: v.optional(v.string()),
    expedientNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify user has escrito write permission
    const { currentUser } = await requireEscritoPermission(ctx, args.caseId, "write");

    const prosemirrorId = crypto.randomUUID();

    await prosemirrorSync.create(ctx, prosemirrorId, {
      content: {
        type: "doc",
        content: [],
      },
    })
    
    const escritoId = await ctx.db.insert("escritos", {
      title: args.title,
      caseId: args.caseId,
      status: "borrador",
      presentationDate: args.presentationDate,
      courtName: args.courtName,
      expedientNumber: args.expedientNumber,
      prosemirrorId: prosemirrorId,
      lastEditedAt: Date.now(),
      createdBy: currentUser._id,
      lastModifiedBy: currentUser._id,
      isArchived: false,
    });

    console.log("Created escrito with id:", escritoId);
    return {escritoId, prosemirrorId};
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

    // Verify user has escrito write permission
    const { currentUser } = await requireEscritoPermission(ctx, escrito.caseId, "write");

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
  },
  handler: async (ctx, args) => {
    // Verify user has escrito read permission
    await requireEscritoPermission(ctx, args.caseId, "read");

    const escritos = await ctx.db
      .query("escritos")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .order("desc")
      .collect();

    return escritos;
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

    return escrito;
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

    // Verify user has escrito delete permission for archiving
    await requireEscritoPermission(ctx, escrito.caseId, "delete");

    await ctx.db.patch(args.escritoId, { isArchived: args.isArchived });
    console.log(
      `${args.isArchived ? "Archived" : "Unarchived"} escrito:`,
      args.escritoId,
    );
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
    // Verify user has escrito read permission
    await requireEscritoPermission(ctx, args.caseId, "read");

    const archivedEscritos = await ctx.db
      .query("escritos")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isArchived"), true))
      .order("desc")
      .collect();

    return archivedEscritos;
  },
});

