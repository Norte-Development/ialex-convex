import { action, mutation, query, internalQuery } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getCurrentUserFromAuth } from "../auth_utils";

// ========================================
// LIBRARY DOCUMENT MANAGEMENT
// ========================================

/**
 * Generates a Google Cloud Storage V4 signed URL for client-side uploads.
 *
 * Auth: requires an authenticated user.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.title - The document title (used in the GCS path)
 * @param {string} args.mimeType - MIME type to be enforced by the signed request
 * @param {number} args.fileSize - Size in bytes (informational for clients; not enforced server-side)
 * @returns {Promise<{url: string, bucket: string, object: string, contentType: string, expiresAt: number}>}
 * A payload containing the signed upload URL and target object metadata.
 * @throws {Error} If the user is unauthenticated or GCS configuration is missing
 */
export const generateUploadUrl = action({
    args: {
      title: v.string(),
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
      if (!user) throw new Error("User not authenticated");

      const bucket = process.env.GCS_BUCKET as string;
      const ttl = Number(process.env.GCS_UPLOAD_URL_TTL_SECONDS || 900);

      if (!bucket) throw new Error("Missing GCS bucket configuration");

      const timestamp = Date.now();
      const objectPath = `library/documents/${crypto.randomUUID()}/${timestamp}-${args.title}`;
  
      const { url, bucket: returnedBucket, object, expiresSeconds } = await ctx.runAction(
        internal.utils.gcs.generateGcsV4SignedUrlAction,
        {
          bucket,
          object: objectPath,
          expiresSeconds: ttl,
          method: "PUT",
          contentType: args.mimeType,
        },
      );
  
      return {
        url,
        bucket: returnedBucket,
        object,
        contentType: args.mimeType,
        expiresAt: Date.now() + expiresSeconds * 1000,
      };
    },
  });

/**
 * Creates a new library document record and schedules processing.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.title - The document title
 * @param {string} [args.description] - Optional document description
 * @param {string} [args.teamId] - Team ID for team library (mutually exclusive with personal library)
 * @param {string} [args.folderId] - Optional folder to organize the document
 * @param {string} [args.gcsBucket] - GCS bucket name
 * @param {string} args.gcsObject - GCS object path
 * @param {string} args.mimeType - MIME type of the document
 * @param {number} args.fileSize - File size in bytes
 * @param {string[]} [args.tags] - Optional tags for organization
 * @returns {Promise<string>} The created library document's ID
 * @throws {Error} When not authenticated or invalid permissions
 */
export const createLibraryDocument = mutation({
    args: {
        title: v.string(),
    description: v.optional(v.string()),
        teamId: v.optional(v.id("teams")),
    folderId: v.optional(v.id("libraryFolders")),
        gcsBucket: v.optional(v.string()),
        gcsObject: v.string(),
        mimeType: v.string(),
    fileSize: v.number(),
    tags: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const currentUser = await getCurrentUserFromAuth(ctx);

    // Validate team membership if uploading to team library
    if (args.teamId) {
            const team = await ctx.db.get(args.teamId);
            if (!team) throw new Error("Team not found");

      const isTeamMember = await ctx.db
        .query("teamMemberships")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", team._id).eq("userId", currentUser._id),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      if (!isTeamMember) throw new Error("Not a team member");
    }

    // Validate folder if provided
        if (args.folderId) {
            const folder = await ctx.db.get(args.folderId);
            if (!folder) throw new Error("Folder not found");

      // Ensure folder belongs to the same scope (personal or team)
      if (args.teamId && folder.teamId !== args.teamId) {
        throw new Error("Folder doesn't belong to the specified team");
      }
      if (!args.teamId && folder.userId !== currentUser._id) {
        throw new Error("Folder doesn't belong to your personal library");
      }
    }

    // Idempotency: avoid duplicate records for the same GCS object
        if (args.gcsObject) {
            const existingGcs = await ctx.db
              .query("libraryDocuments")
              .withIndex("by_gcs_object", (q) => q.eq("gcsObject", args.gcsObject!))
              .first();
            if (existingGcs) return existingGcs._id;
        }

        const libraryDocumentId = await ctx.db.insert("libraryDocuments", {
            title: args.title,
      description: args.description,
      userId: args.teamId ? undefined : currentUser._id,
            teamId: args.teamId ?? undefined,
            folderId: args.folderId ?? undefined,
            createdBy: currentUser._id,
            gcsBucket: args.gcsBucket,
            gcsObject: args.gcsObject,
            mimeType: args.mimeType,
      fileSize: args.fileSize,
      tags: args.tags,
      processingStatus: "pending",
    });

    // Schedule document processing
    await ctx.scheduler.runAfter(
      0,
      internal.functions.libraryDocumentProcessing.processLibraryDocument,
      { libraryDocumentId },
    );

    console.log("Created library document with id:", libraryDocumentId);
    return libraryDocumentId;
  },
});

/**
 * Gets library documents for a user or team with pagination.
 *
 * @param {Object} args - The function arguments
 * @param {string} [args.teamId] - Team ID for team library (optional, defaults to personal)
 * @param {string} [args.folderId] - Optional folder filter
 * @param {Object} args.paginationOpts - Pagination options with numItems and cursor
 * @returns {Promise<Object>} Paginated results with page, isDone, and continueCursor
 */
export const getLibraryDocuments = query({
  args: {
    teamId: v.optional(v.id("teams")),
    folderId: v.optional(v.id("libraryFolders")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Validate team access if teamId is provided
    if (args.teamId) {
      const isTeamMember = await ctx.db
        .query("teamMemberships")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", args.teamId!).eq("userId", currentUser._id),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      if (!isTeamMember) throw new Error("Not a team member");
    }

    // Query documents
    let query;
    if (args.folderId) {
      query = ctx.db
        .query("libraryDocuments")
        .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
        .order("desc");
    } else if (args.teamId) {
      query = ctx.db
        .query("libraryDocuments")
        .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
        .order("desc");
    } else {
      // Personal library - use currentUser._id from auth
      query = ctx.db
        .query("libraryDocuments")
        .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
        .order("desc");
    }

    return await query.paginate(args.paginationOpts);
  },
});

/**
 * Gets all library documents accessible to the current user (personal + all teams) with pagination.
 *
 * @param {Object} args - The function arguments
 * @param {number} [args.limit=20] - Maximum number of documents to return (default: 20)
 * @param {number} [args.offset=0] - Number of documents to skip (default: 0)
 * @returns {Promise<Object>} Object with documents array and pagination metadata
 */
export const getAllAccessibleLibraryDocuments = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const limit = args.limit ?? 20;
    const offset = args.offset ?? 0;

    // Get personal library documents
    const personalDocs = await ctx.db
      .query("libraryDocuments")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .order("desc")
      .collect();

    // Get all active team memberships
    const teamMemberships = await ctx.db
      .query("teamMemberships")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Get documents from all teams
    const teamDocs = [];
    for (const membership of teamMemberships) {
      const docs = await ctx.db
        .query("libraryDocuments")
        .withIndex("by_team", (q) => q.eq("teamId", membership.teamId))
        .order("desc")
        .collect();
      teamDocs.push(...docs);
    }

    // Combine and sort by creation time (descending)
    const allDocs = [...personalDocs, ...teamDocs].sort(
      (a, b) => b._creationTime - a._creationTime
    );

    // Apply pagination
    const paginatedDocs = allDocs.slice(offset, offset + limit);
    const hasMore = offset + limit < allDocs.length;

    return {
      documents: paginatedDocs,
      totalCount: allDocs.length,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
    };
  },
});



/**
 * Gets all library documents accessible to the specified user (personal + all teams) with pagination.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.userId - The user ID
 * @param {number} [args.limit=20] - Maximum number of documents to return (default: 20)
 * @param {number} [args.offset=0] - Number of documents to skip (default: 0)
 * @returns {Promise<Object>} Object with documents array and pagination metadata
 */
export const getAllAccessibleLibraryDocumentsForAgent = internalQuery({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const offset = args.offset ?? 0;

    // Get personal library documents
    const personalDocs = await ctx.db
      .query("libraryDocuments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    // Get all active team memberships
    const teamMemberships = await ctx.db
      .query("teamMemberships")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Get documents from all teams
    const teamDocs = [];
    for (const membership of teamMemberships) {
      const docs = await ctx.db
        .query("libraryDocuments")
        .withIndex("by_team", (q) => q.eq("teamId", membership.teamId))
        .order("desc")
        .collect();
      teamDocs.push(...docs);
    }

    // Combine and sort by creation time (descending)
    const allDocs = [...personalDocs, ...teamDocs].sort(
      (a, b) => b._creationTime - a._creationTime
    );

    // Apply pagination
    const paginatedDocs = allDocs.slice(offset, offset + limit);
    const hasMore = offset + limit < allDocs.length;

    return {
      documents: paginatedDocs,
      totalCount: allDocs.length,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
    };

  },
});

/**
 * Gets a single library document by ID with permission check.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.documentId - The document ID
 * @returns {Promise<Object>} The library document
 * @throws {Error} When not found or no access
 */
export const getLibraryDocument = query({
  args: {
    documentId: v.id("libraryDocuments"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const document = await ctx.db.get(args.documentId);

    if (!document) throw new Error("Library document not found");

    // Check access
    if (document.userId && document.userId !== currentUser._id) {
      throw new Error("Cannot access this document");
    }

    if (document.teamId) {
      const isTeamMember = await ctx.db
        .query("teamMemberships")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", document.teamId!).eq("userId", currentUser._id),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      if (!isTeamMember) throw new Error("Cannot access this document");
    }

    return document;
  },
});

/**
 * Gets a single library document by ID without permission check.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.documentId - The document ID
 * @returns {Promise<Object>} The library document
 */
export const getLibraryDocumentForAgent = internalQuery({
  args: {
    documentId: v.id("libraryDocuments"),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    return document;
  },
});



/**
 * Gets a download URL for a library document.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.documentId - The document ID
 * @returns {Promise<string>} The signed download URL
 */
export const getLibraryDocumentUrl = action({
  args: {
    documentId: v.id("libraryDocuments"),
  },
  handler: async (ctx, args): Promise<string> => {
    // Get and validate document access
    const document = await ctx.runQuery(api.functions.libraryDocument.getLibraryDocument, {
      documentId: args.documentId,
    });

    if (!document.gcsBucket || !document.gcsObject) {
      throw new Error("Document not stored in GCS");
    }

    const { url } = await ctx.runAction(internal.utils.gcs.generateGcsV4SignedUrlAction, {
      bucket: document.gcsBucket,
      object: document.gcsObject,
      expiresSeconds: 900, // 15 minutes
      method: "GET",
    });

    return url;
  },
});

/**
 * Deletes a library document and schedules chunk cleanup.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.documentId - The document ID to delete
 */
export const deleteLibraryDocument = mutation({
  args: {
    documentId: v.id("libraryDocuments"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const document = await ctx.db.get(args.documentId);

    if (!document) throw new Error("Library document not found");

    // Only creator or team admin can delete
    if (document.userId && document.userId !== currentUser._id) {
      throw new Error("Cannot delete this document");
    }

    if (document.teamId) {
      const membership = await ctx.db
        .query("teamMemberships")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", document.teamId!).eq("userId", currentUser._id),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      if (!membership || membership.role !== "admin") {
        throw new Error("Only team admins can delete team library documents");
      }
    }

    // Delete the document record
    await ctx.db.delete(args.documentId);

    // Schedule cleanup of vector chunks
    await ctx.scheduler.runAfter(
      0,
      internal.functions.libraryDocumentProcessing.deleteLibraryDocumentChunks,
      { libraryDocumentId: args.documentId },
    );

    console.log("Deleted library document:", args.documentId);
  },
});

/**
 * Moves a library document to a different folder.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.documentId - The document ID
 * @param {string} [args.newFolderId] - New folder ID (undefined for root)
 */
export const moveLibraryDocument = mutation({
  args: {
    documentId: v.id("libraryDocuments"),
    newFolderId: v.optional(v.id("libraryFolders")),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const document = await ctx.db.get(args.documentId);

    if (!document) throw new Error("Library document not found");

    // Check access
    if (document.userId && document.userId !== currentUser._id) {
      throw new Error("Cannot move this document");
    }

    if (document.teamId) {
      const membership = await ctx.db
        .query("teamMemberships")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", document.teamId!).eq("userId", currentUser._id),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      if (!membership) throw new Error("Cannot move this document");
    }

    // Validate new folder if provided
    if (args.newFolderId) {
      const folder = await ctx.db.get(args.newFolderId);
      if (!folder) throw new Error("Destination folder not found");

      // Ensure folder belongs to the same scope
      if (document.teamId && folder.teamId !== document.teamId) {
        throw new Error("Cannot move to a folder in a different team");
      }
      if (document.userId && folder.userId !== document.userId) {
        throw new Error("Cannot move to a folder in a different scope");
      }
    }

    await ctx.db.patch(args.documentId, {
      folderId: args.newFolderId,
    });

    console.log("Moved library document:", args.documentId);
  },
});

/**
 * Updates a library document's metadata.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.documentId - The document ID
 * @param {string} [args.title] - New title
 * @param {string} [args.description] - New description
 * @param {string[]} [args.tags] - New tags
 */
export const updateLibraryDocument = mutation({
  args: {
    documentId: v.id("libraryDocuments"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const document = await ctx.db.get(args.documentId);

    if (!document) throw new Error("Library document not found");

    // Check access
    if (document.userId && document.userId !== currentUser._id) {
      throw new Error("Cannot update this document");
    }

    if (document.teamId) {
      const membership = await ctx.db
        .query("teamMemberships")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", document.teamId!).eq("userId", currentUser._id),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      if (!membership) throw new Error("Cannot update this document");
    }

    const updateData: any = {};
    if (args.title !== undefined) updateData.title = args.title;
    if (args.description !== undefined) updateData.description = args.description;
    if (args.tags !== undefined) updateData.tags = args.tags;

    await ctx.db.patch(args.documentId, updateData);
    console.log("Updated library document:", args.documentId);
  },
});

