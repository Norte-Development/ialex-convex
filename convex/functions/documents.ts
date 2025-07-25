import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getCurrentUserFromAuth, requireCaseAccess } from "./auth_utils";

// ========================================
// DOCUMENT MANAGEMENT
// ========================================

/**
 * Creates a new document record associated with a case.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.title - The document title or name
 * @param {string} [args.description] - Optional description of the document
 * @param {string} args.caseId - The ID of the case this document belongs to
 * @param {"contract" | "evidence" | "correspondence" | "legal_brief" | "court_filing" | "other"} [args.documentType] - The type/category of document
 * @param {string} args.fileId - The Convex storage file ID
 * @param {string} args.originalFileName - The original name of the uploaded file
 * @param {string} args.mimeType - The MIME type of the file (e.g., "application/pdf")
 * @param {number} args.fileSize - The size of the file in bytes
 * @param {string[]} [args.tags] - Optional tags for categorizing the document
 * @returns {Promise<string>} The created document's document ID
 * @throws {Error} When not authenticated or lacking full case access
 *
 * @description This function creates a document record linked to a case and stored file.
 * The user must have full access to the case to add documents. The function stores
 * metadata about the file including its original name, size, and type for later retrieval.
 *
 * @example
 * ```javascript
 * const documentId = await createDocument({
 *   title: "Settlement Agreement Draft",
 *   description: "Initial draft of settlement terms",
 *   caseId: "case_123",
 *   documentType: "contract",
 *   fileId: "storage_file_456",
 *   originalFileName: "settlement_draft_v1.pdf",
 *   mimeType: "application/pdf",
 *   fileSize: 245760,
 *   tags: ["settlement", "draft"]
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
    fileId: v.id("_storage"),
    originalFileName: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Verify user has full access to the case
    const { currentUser } = await requireCaseAccess(ctx, args.caseId, "full");

    const documentId = await ctx.db.insert("documents", {
      title: args.title,
      description: args.description,
      caseId: args.caseId,
      documentType: args.documentType,
      fileId: args.fileId,
      originalFileName: args.originalFileName,
      mimeType: args.mimeType,
      fileSize: args.fileSize,
      createdBy: currentUser._id,
      tags: args.tags,
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
    // Verify user has access to the case
    await requireCaseAccess(ctx, args.caseId, "read");

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .order("desc")
      .collect();

    return documents;
  },
});

// ========================================
// ESCRITO MANAGEMENT (Simplified)
// ========================================

/**
 * Creates a new escrito (legal writing/brief) for a case.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.title - The escrito title
 * @param {string} args.content - The escrito content in Tiptap JSON format
 * @param {string} args.caseId - The ID of the case this escrito belongs to
 * @param {number} [args.presentationDate] - Optional timestamp for when this will be presented
 * @param {string} [args.courtName] - Name of the court where this will be filed
 * @param {string} [args.expedientNumber] - Court expedient/case number
 * @returns {Promise<string>} The created escrito's document ID
 * @throws {Error} When not authenticated or lacking full case access
 *
 * @description This function creates a new legal writing (escrito) associated with a case.
 * The content is stored as Tiptap JSON for rich text editing. The escrito starts in
 * "borrador" (draft) status and tracks word count and modification timestamps.
 *
 * @example
 * ```javascript
 * const escritoId = await createEscrito({
 *   title: "Motion to Dismiss",
 *   content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Motion content..."}]}]}',
 *   caseId: "case_123",
 *   courtName: "Supreme Court",
 *   expedientNumber: "SC-2024-001"
 * });
 * ```
 */
export const createEscrito = mutation({
  args: {
    title: v.string(),
    content: v.string(), // Tiptap JSON
    caseId: v.id("cases"),
    presentationDate: v.optional(v.number()),
    courtName: v.optional(v.string()),
    expedientNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify user has full access to the case
    const { currentUser } = await requireCaseAccess(ctx, args.caseId, "full");

    const wordCount = args.content.length; // Simple word count estimation

    const escritoId = await ctx.db.insert("escritos", {
      title: args.title,
      content: args.content,
      caseId: args.caseId,
      status: "borrador",
      presentationDate: args.presentationDate,
      courtName: args.courtName,
      expedientNumber: args.expedientNumber,
      wordCount: wordCount,
      lastEditedAt: Date.now(),
      createdBy: currentUser._id,
      lastModifiedBy: currentUser._id,
      isArchived: false,
    });

    console.log("Created escrito with id:", escritoId);
    return escritoId;
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

    // Verify user has full access to the case
    const { currentUser } = await requireCaseAccess(
      ctx,
      escrito.caseId,
      "full",
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
  },
  handler: async (ctx, args) => {
    // Verify user has access to the case
    await requireCaseAccess(ctx, args.caseId, "read");

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
 * Retrieves an especific escrito for a specific case.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.escritoId - The ID of the escrito to get documents for
 * @returns {Promise<Object[]>} Array of document records ordered by creation date (newest first)
 * @throws {Error} When not authenticated or lacking case access
 *
 * @description This function returns an especific escrito belonging to a case,
 * ordered by creation date with the most recent first. The user must have read
 * access to the case to view its escrito.
 *
 * @example
 * ```javascript
 * const escrito = await getEscrito({ escritoId: "escrito_123" });
 * // Returns: [{ title: "Motion", status: "borrador", wordCount: 1500 }, ...]
 * ```
 */

export const getEscrito = query({
  args: {
    escritoId: v.id("escritos"),
  },
  handler: async (ctx, args) => {
    await requireCaseAccess(ctx, args.escritoId, "read");

    const escrito = await ctx.db.get(args.escritoId);
    if (!escrito) {
      throw new Error("Escrito not found");
    }

    return escrito;
  },
});
