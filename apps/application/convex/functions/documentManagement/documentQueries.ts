import { v } from "convex/values";
import { query } from "../../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { getCurrentUserFromAuth, requireNewCaseAccess } from "../../auth_utils";
import { api } from "../../_generated/api";

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

