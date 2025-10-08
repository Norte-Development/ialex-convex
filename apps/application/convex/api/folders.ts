import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getCurrentUserFromAuth, requireNewCaseAccess } from "../services/auth/authUtils";

// ========================================
// FOLDER MANAGEMENT
// ========================================

/**
 * Creates a new folder within a specific case for organizing documents.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.name - The folder name
 * @param {string} [args.description] - Optional description of the folder's purpose
 * @param {string} args.caseId - The ID of the case this folder belongs to
 * @param {string} [args.parentFolderId] - Optional parent folder ID for creating subfolders
 * @param {string} [args.color] - Optional color for UI organization (hex or color name)
 * @param {number} [args.sortOrder] - Optional custom sort order for folder organization
 * @returns {Promise<string>} The created folder's document ID
 * @throws {Error} When not authenticated or lacking case access
 *
 * @description This function creates a new folder within a case to organize documents.
 * The user must have write access to the case to create folders. Supports nested
 * folders through the parentFolderId parameter. Folders are not archived by default.
 *
 * @example
 * ```javascript
 * const folderId = await createFolder({
 *   name: "Evidence",
 *   description: "Physical and digital evidence for the case",
 *   caseId: "case_123",
 *   color: "#FF5733",
 *   sortOrder: 1
 * });
 *
 * // Create a subfolder
 * const subFolderId = await createFolder({
 *   name: "Photos",
 *   description: "Photographic evidence",
 *   caseId: "case_123",
 *   parentFolderId: folderId
 * });
 * ```
 */
export const createFolder = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    caseId: v.id("cases"),
    parentFolderId: v.optional(v.id("folders")),
    color: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify user has case access
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "advanced");

    // If parentFolderId is provided, verify it belongs to the same case
    if (args.parentFolderId) {
      const parentFolder = await ctx.db.get(args.parentFolderId);
      if (!parentFolder) {
        throw new Error("Parent folder not found");
      }
      if (parentFolder.caseId !== args.caseId) {
        throw new Error("Parent folder must belong to the same case");
      }
    }

    // Check for duplicate folder names in the same location
    const existingFolder = await ctx.db
      .query("folders")
      .withIndex("by_case_and_parent", (q) =>
        q
          .eq("caseId", args.caseId)
          .eq("parentFolderId", args.parentFolderId || undefined),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("name"), args.name),
          q.eq(q.field("isArchived"), false),
        ),
      )
      .first();

    if (existingFolder) {
      throw new Error(
        "A folder with this name already exists in this location",
      );
    }

    const folderId = await ctx.db.insert("folders", {
      name: args.name,
      description: args.description,
      caseId: args.caseId,
      parentFolderId: args.parentFolderId,
      color: args.color,
      sortOrder: args.sortOrder,
      isArchived: false,
      createdBy: currentUser._id,
    });

    console.log("Created folder with id:", folderId);
    return folderId;
  },
});

/**
 * Retrieves all folders for a specific case, organized by hierarchy.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.caseId - The ID of the case to get folders for
 * @param {string} [args.parentFolderId] - Optional parent folder ID to get only subfolders
 * @param {boolean} [args.includeArchived] - Whether to include archived folders (default: false)
 * @returns {Promise<Object[]>} Array of folder documents sorted by sortOrder then by name
 * @throws {Error} When not authenticated or lacking case access
 *
 * @description This function returns folders for a specific case. If parentFolderId is
 * provided, only returns direct children of that folder. Otherwise returns root-level
 * folders. Results are sorted by sortOrder (if provided) then alphabetically by name.
 *
 * @example
 * ```javascript
 * // Get all root folders for a case
 * const rootFolders = await getFoldersForCase({ caseId: "case_123" });
 *
 * // Get subfolders of a specific folder
 * const subFolders = await getFoldersForCase({
 *   caseId: "case_123",
 *   parentFolderId: "folder_456"
 * });
 *
 * // Include archived folders
 * const allFolders = await getFoldersForCase({
 *   caseId: "case_123",
 *   includeArchived: true
 * });
 * ```
 */
export const getFoldersForCase = query({
  args: {
    caseId: v.id("cases"),
    parentFolderId: v.optional(v.id("folders")),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Verify user has case access
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");

    let folders;
    if (args.parentFolderId) {
      // Get folders with specific parent
      folders = await ctx.db
        .query("folders")
        .withIndex("by_case_and_parent", (q) =>
          q.eq("caseId", args.caseId).eq("parentFolderId", args.parentFolderId),
        )
        .collect();
    } else {
      // Get root folders (no parent)
      folders = await ctx.db
        .query("folders")
        .withIndex("by_case_and_parent", (q) =>
          q.eq("caseId", args.caseId).eq("parentFolderId", undefined),
        )
        .collect();
    }

    // Filter archived folders if not requested
    if (!args.includeArchived) {
      folders = folders.filter((folder) => !folder.isArchived);
    }

    // Sort by sortOrder then by name
    folders.sort((a, b) => {
      // First sort by sortOrder (if both have it)
      if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
        if (a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder;
        }
      }
      // If only one has sortOrder, prioritize it
      if (a.sortOrder !== undefined && b.sortOrder === undefined) {
        return -1;
      }
      if (a.sortOrder === undefined && b.sortOrder !== undefined) {
        return 1;
      }
      // Finally sort alphabetically by name
      return a.name.localeCompare(b.name);
    });

    return folders;
  },
});

/**
 * Get a specific folder by ID with access validation.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.folderId - The ID of the folder to retrieve
 * @returns {Promise<Object>} The folder document
 * @throws {Error} When not authenticated, lacking case access, or folder not found
 *
 * @description This function retrieves a single folder and validates that the user
 * has access to the case that contains the folder.
 *
 * @example
 * ```javascript
 * const folder = await getFolderById({ folderId: "folder_123" });
 * ```
 */
export const getFolderById = query({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.folderId);
    if (!folder) {
      throw new Error("Folder not found");
    }

    // Verify user has case access
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, folder.caseId, "basic");

    return folder;
  },
});

/**
 * Updates an existing folder's properties.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.folderId - The ID of the folder to update
 * @param {string} [args.name] - New folder name
 * @param {string} [args.description] - New folder description
 * @param {string} [args.color] - New folder color
 * @param {number} [args.sortOrder] - New sort order
 * @returns {Promise<string>} The updated folder's document ID
 * @throws {Error} When not authenticated, lacking case access, or folder not found
 *
 * @description This function updates folder properties. The user must have write
 * access to the case. If changing the name, validates that no duplicate exists
 * in the same location.
 *
 * @example
 * ```javascript
 * await updateFolder({
 *   folderId: "folder_123",
 *   name: "Updated Evidence",
 *   description: "Updated description",
 *   color: "#00FF00",
 *   sortOrder: 2
 * });
 * ```
 */
export const updateFolder = mutation({
  args: {
    folderId: v.id("folders"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.folderId);
    if (!folder) {
      throw new Error("Folder not found");
    }

    // Verify user has case access
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, folder.caseId, "admin");

    // If updating name, check for duplicates
    if (args.name && args.name !== folder.name) {
      const existingFolder = await ctx.db
        .query("folders")
        .withIndex("by_case_and_parent", (q) =>
          q
            .eq("caseId", folder.caseId)
            .eq("parentFolderId", folder.parentFolderId || undefined),
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("name"), args.name!),
            q.eq(q.field("isArchived"), false),
            q.neq(q.field("_id"), args.folderId),
          ),
        )
        .first();

      if (existingFolder) {
        throw new Error(
          "A folder with this name already exists in this location",
        );
      }
    }

    // Build update object with only provided fields
    const updateData: any = {};
    if (args.name !== undefined) updateData.name = args.name;
    if (args.description !== undefined)
      updateData.description = args.description;
    if (args.color !== undefined) updateData.color = args.color;
    if (args.sortOrder !== undefined) updateData.sortOrder = args.sortOrder;

    await ctx.db.patch(args.folderId, updateData);
    console.log("Updated folder with id:", args.folderId);
    return args.folderId;
  },
});

/**
 * Archives a folder and all its contents (subfolders and documents).
 *
 * @param {Object} args - The function arguments
 * @param {string} args.folderId - The ID of the folder to archive
 * @returns {Promise<void>}
 * @throws {Error} When not authenticated, lacking case access, or folder not found
 *
 * @description This function performs a soft delete by archiving the folder and
 * recursively archiving all subfolders. Documents in the folder are not archived
 * but become "orphaned" (their folderId remains but the folder is archived).
 * The user must have write access to the case.
 *
 * @example
 * ```javascript
 * await archiveFolder({ folderId: "folder_123" });
 * ```
 */
export const archiveFolder = mutation({
  args: {
    folderId: v.id("folders"),
  },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.folderId);
    if (!folder) {
      throw new Error("Folder not found");
    }

    // Verify user has case access
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, folder.caseId, "admin");
    // Archive the folder
    await ctx.db.patch(args.folderId, { isArchived: true });

    // Recursively archive all subfolders
    await archiveSubfolders(ctx, args.folderId);

    console.log("Archived folder and subfolders:", args.folderId);
  },
});

/**
 * Helper function to recursively archive subfolders.
 */
async function archiveSubfolders(ctx: any, parentFolderId: string) {
  const subfolders = await ctx.db
    .query("folders")
    .withIndex("by_parent", (q: any) => q.eq("parentFolderId", parentFolderId))
    .filter((q: any) => q.eq(q.field("isArchived"), false))
    .collect();

  for (const subfolder of subfolders) {
    await ctx.db.patch(subfolder._id, { isArchived: true });
    // Recursively archive deeper subfolders
    await archiveSubfolders(ctx, subfolder._id);
  }
}

/**
 * Restores an archived folder and optionally its subfolders.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.folderId - The ID of the folder to restore
 * @param {boolean} [args.restoreSubfolders] - Whether to restore subfolders (default: false)
 * @returns {Promise<void>}
 * @throws {Error} When not authenticated, lacking case access, or folder not found
 *
 * @description This function restores an archived folder. If restoreSubfolders is true,
 * also restores all archived subfolders. The user must have write access to the case.
 *
 * @example
 * ```javascript
 * // Restore just the folder
 * await restoreFolder({ folderId: "folder_123" });
 *
 * // Restore folder and all subfolders
 * await restoreFolder({ folderId: "folder_123", restoreSubfolders: true });
 * ```
 */
export const restoreFolder = mutation({
  args: {
    folderId: v.id("folders"),
    restoreSubfolders: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.folderId);
    if (!folder) {
      throw new Error("Folder not found");
    }

    // Verify user has case access
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, folder.caseId, "admin");

    // Restore the folder
    await ctx.db.patch(args.folderId, { isArchived: false });

    // Optionally restore subfolders
    if (args.restoreSubfolders) {
      await restoreSubfolders(ctx, args.folderId);
    }

    console.log("Restored folder:", args.folderId);
  },
});

/**
 * Helper function to recursively restore subfolders.
 */
async function restoreSubfolders(ctx: any, parentFolderId: string) {
  const subfolders = await ctx.db
    .query("folders")
    .withIndex("by_parent", (q: any) => q.eq("parentFolderId", parentFolderId))
    .filter((q: any) => q.eq(q.field("isArchived"), true))
    .collect();

  for (const subfolder of subfolders) {
    await ctx.db.patch(subfolder._id, { isArchived: false });
    // Recursively restore deeper subfolders
    await restoreSubfolders(ctx, subfolder._id);
  }
}

/**
 * Moves a folder to a different parent folder within the same case.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.folderId - The ID of the folder to move
 * @param {string} [args.newParentFolderId] - The new parent folder ID (undefined for root level)
 * @returns {Promise<void>}
 * @throws {Error} When not authenticated, lacking case access, folder not found, or invalid move
 *
 * @description This function moves a folder to a different location in the hierarchy.
 * Validates that the move doesn't create a circular reference and that no naming
 * conflicts exist in the destination. The user must have write access to the case.
 *
 * @example
 * ```javascript
 * // Move folder to root level
 * await moveFolder({ folderId: "folder_123", newParentFolderId: undefined });
 *
 * // Move folder under another folder
 * await moveFolder({ folderId: "folder_123", newParentFolderId: "folder_456" });
 * ```
 */
export const moveFolder = mutation({
  args: {
    folderId: v.id("folders"),
    newParentFolderId: v.optional(v.id("folders")),
  },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.folderId);
    if (!folder) {
      throw new Error("Folder not found");
    }

    // Verify user has case access
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, folder.caseId, "admin");

    // If moving to a parent folder, validate it
    if (args.newParentFolderId) {
      const newParentFolder = await ctx.db.get(args.newParentFolderId);
      if (!newParentFolder) {
        throw new Error("New parent folder not found");
      }
      if (newParentFolder.caseId !== folder.caseId) {
        throw new Error("Cannot move folder to a different case");
      }

      // Prevent circular references (moving a folder into one of its descendants)
      if (
        await isDescendantFolder(ctx, args.newParentFolderId, args.folderId)
      ) {
        throw new Error("Cannot move folder into one of its subfolders");
      }
    }

    // Check for naming conflicts in the destination
    const existingFolder = await ctx.db
      .query("folders")
      .withIndex("by_case_and_parent", (q) =>
        q
          .eq("caseId", folder.caseId)
          .eq("parentFolderId", args.newParentFolderId || undefined),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("name"), folder.name),
          q.eq(q.field("isArchived"), false),
          q.neq(q.field("_id"), args.folderId),
        ),
      )
      .first();

    if (existingFolder) {
      throw new Error(
        "A folder with this name already exists in the destination",
      );
    }

    // Move the folder
    await ctx.db.patch(args.folderId, {
      parentFolderId: args.newParentFolderId,
    });
    console.log("Moved folder:", args.folderId);
  },
});

/**
 * Helper function to check if a folder is a descendant of another folder.
 */
async function isDescendantFolder(
  ctx: any,
  potentialDescendantId: string,
  ancestorId: string,
): Promise<boolean> {
  const potentialDescendant = await ctx.db.get(potentialDescendantId);
  if (!potentialDescendant || !potentialDescendant.parentFolderId) {
    return false;
  }

  if (potentialDescendant.parentFolderId === ancestorId) {
    return true;
  }

  return await isDescendantFolder(
    ctx,
    potentialDescendant.parentFolderId,
    ancestorId,
  );
}

/**
 * Gets the complete folder hierarchy (breadcrumb path) for a specific folder.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.folderId - The ID of the folder to get the path for
 * @returns {Promise<Object[]>} Array of folder objects from root to the specified folder
 * @throws {Error} When not authenticated, lacking case access, or folder not found
 *
 * @description This function returns the complete path from the root level to the
 * specified folder, useful for creating breadcrumb navigation. The user must have
 * read access to the case.
 *
 * @example
 * ```javascript
 * const path = await getFolderPath({ folderId: "folder_123" });
 * // Returns: [{ name: "Evidence" }, { name: "Photos" }, { name: "Crime Scene" }]
 * ```
 */
export const getFolderPath = query({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.folderId);
    if (!folder) {
      throw new Error("Folder not found");
    }

    // Verify user has case access
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, folder.caseId, "basic");

    const path = [];
    let currentFolder = folder;

    // Build path from current folder to root
    while (currentFolder) {
      path.unshift(currentFolder);

      if (currentFolder.parentFolderId) {
        const parentFolder = await ctx.db.get(currentFolder.parentFolderId);
        if (!parentFolder) {
          break; // Parent folder was deleted, stop here
        }
        currentFolder = parentFolder;
      } else {
        break;
      }
    }

    return path;
  },
});
