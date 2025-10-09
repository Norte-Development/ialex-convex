import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getCurrentUserFromAuth } from "../auth_utils";

// ========================================
// LIBRARY FOLDER MANAGEMENT
// ========================================

/**
 * Creates a new library folder for organizing documents.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.name - The folder name
 * @param {string} [args.description] - Optional description
 * @param {string} [args.teamId] - Team ID for team library
 * @param {string} [args.parentFolderId] - Optional parent folder for subfolders
 * @param {string} [args.color] - Optional color for UI
 * @param {number} [args.sortOrder] - Optional custom sort order
 * @returns {Promise<string>} The created folder's ID
 */
export const createLibraryFolder = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    teamId: v.optional(v.id("teams")),
    parentFolderId: v.optional(v.id("libraryFolders")),
    color: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Validate team membership if creating in team library
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

    // If parentFolderId is provided, verify it belongs to the same scope
    if (args.parentFolderId) {
      const parentFolder = await ctx.db.get(args.parentFolderId);
      if (!parentFolder) {
        throw new Error("Parent folder not found");
      }

      // Ensure parent folder belongs to the same scope
      if (args.teamId && parentFolder.teamId !== args.teamId) {
        throw new Error("Parent folder must belong to the same team");
      }
      if (!args.teamId && parentFolder.userId !== currentUser._id) {
        throw new Error("Parent folder must belong to your personal library");
      }
    }

    // Check for duplicate folder names in the same location
    const existingFolder = await ctx.db
      .query("libraryFolders")
      .filter((q) => {
        let conditions = [
          q.eq(q.field("name"), args.name),
          q.eq(q.field("isArchived"), false),
          q.eq(q.field("parentFolderId"), args.parentFolderId || undefined),
        ];

        if (args.teamId) {
          conditions.push(q.eq(q.field("teamId"), args.teamId));
        } else {
          conditions.push(q.eq(q.field("userId"), currentUser._id));
        }

        return q.and(...conditions);
      })
      .first();

    if (existingFolder) {
      throw new Error("A folder with this name already exists in this location");
    }

    const folderId = await ctx.db.insert("libraryFolders", {
      name: args.name,
      description: args.description,
      userId: args.teamId ? undefined : currentUser._id,
      teamId: args.teamId ?? undefined,
      parentFolderId: args.parentFolderId,
      color: args.color,
      sortOrder: args.sortOrder,
      isArchived: false,
      createdBy: currentUser._id,
    });

    console.log("Created library folder with id:", folderId);
    return folderId;
  },
});

/**
 * Retrieves all library folders for a user or team.
 *
 * @param {Object} args - The function arguments
 * @param {string} [args.userId] - User ID for personal library
 * @param {string} [args.teamId] - Team ID for team library
 * @param {string} [args.parentFolderId] - Optional parent folder filter
 * @param {boolean} [args.includeArchived] - Include archived folders
 * @returns {Promise<Object[]>} Array of folders sorted by sortOrder then name
 */
export const getLibraryFolders = query({
  args: {
    userId: v.optional(v.id("users")),
    teamId: v.optional(v.id("teams")),
    parentFolderId: v.optional(v.id("libraryFolders")),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Validate access
    if (args.teamId) {
      const isTeamMember = await ctx.db
        .query("teamMemberships")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", args.teamId!).eq("userId", currentUser._id),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      if (!isTeamMember) throw new Error("Not a team member");
    } else if (args.userId && args.userId !== currentUser._id) {
      throw new Error("Cannot access another user's personal library");
    }

    // Query folders based on scope
    let folders;
    if (args.teamId) {
      folders = await ctx.db
        .query("libraryFolders")
        .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
        .filter((q) =>
          q.eq(q.field("parentFolderId"), args.parentFolderId || undefined),
        )
        .collect();
    } else {
      const targetUserId = args.userId || currentUser._id;
      folders = await ctx.db
        .query("libraryFolders")
        .withIndex("by_user", (q) => q.eq("userId", targetUserId))
        .filter((q) =>
          q.eq(q.field("parentFolderId"), args.parentFolderId || undefined),
        )
        .collect();
    }

    // Filter archived folders if not requested
    if (!args.includeArchived) {
      folders = folders.filter((folder) => !folder.isArchived);
    }

    // Sort by sortOrder then by name
    folders.sort((a, b) => {
      if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
        if (a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder;
        }
      }
      if (a.sortOrder !== undefined && b.sortOrder === undefined) {
        return -1;
      }
      if (a.sortOrder === undefined && b.sortOrder !== undefined) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });

    return folders;
  },
});

/**
 * Get a specific library folder by ID with access validation.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.folderId - The folder ID
 * @returns {Promise<Object>} The folder document
 */
export const getLibraryFolder = query({
  args: { folderId: v.id("libraryFolders") },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const folder = await ctx.db.get(args.folderId);

    if (!folder) throw new Error("Library folder not found");

    // Check access
    if (folder.userId && folder.userId !== currentUser._id) {
      throw new Error("Cannot access this folder");
    }

    if (folder.teamId) {
      const isTeamMember = await ctx.db
        .query("teamMemberships")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", folder.teamId!).eq("userId", currentUser._id),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      if (!isTeamMember) throw new Error("Cannot access this folder");
    }

    return folder;
  },
});

/**
 * Updates an existing library folder's properties.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.folderId - The folder ID to update
 * @param {string} [args.name] - New folder name
 * @param {string} [args.description] - New description
 * @param {string} [args.color] - New color
 * @param {number} [args.sortOrder] - New sort order
 */
export const updateLibraryFolder = mutation({
  args: {
    folderId: v.id("libraryFolders"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const folder = await ctx.db.get(args.folderId);

    if (!folder) throw new Error("Library folder not found");

    // Check access
    if (folder.userId && folder.userId !== currentUser._id) {
      throw new Error("Cannot update this folder");
    }

    if (folder.teamId) {
      const membership = await ctx.db
        .query("teamMemberships")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", folder.teamId!).eq("userId", currentUser._id),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      if (!membership) throw new Error("Cannot update this folder");
    }

    // If updating name, check for duplicates
    if (args.name && args.name !== folder.name) {
      const existingFolder = await ctx.db
        .query("libraryFolders")
        .filter((q) => {
          let conditions = [
            q.eq(q.field("name"), args.name!),
            q.eq(q.field("isArchived"), false),
            q.eq(q.field("parentFolderId"), folder.parentFolderId || undefined),
            q.neq(q.field("_id"), args.folderId),
          ];

          if (folder.teamId) {
            conditions.push(q.eq(q.field("teamId"), folder.teamId));
          } else {
            conditions.push(q.eq(q.field("userId"), folder.userId));
          }

          return q.and(...conditions);
        })
        .first();

      if (existingFolder) {
        throw new Error("A folder with this name already exists in this location");
      }
    }

    const updateData: any = {};
    if (args.name !== undefined) updateData.name = args.name;
    if (args.description !== undefined) updateData.description = args.description;
    if (args.color !== undefined) updateData.color = args.color;
    if (args.sortOrder !== undefined) updateData.sortOrder = args.sortOrder;

    await ctx.db.patch(args.folderId, updateData);
    console.log("Updated library folder:", args.folderId);
  },
});

/**
 * Archives a library folder and all its contents.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.folderId - The folder ID to archive
 */
export const archiveLibraryFolder = mutation({
  args: {
    folderId: v.id("libraryFolders"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const folder = await ctx.db.get(args.folderId);

    if (!folder) throw new Error("Library folder not found");

    // Check access - only owner or team admin
    if (folder.userId && folder.userId !== currentUser._id) {
      throw new Error("Cannot archive this folder");
    }

    if (folder.teamId) {
      const membership = await ctx.db
        .query("teamMemberships")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", folder.teamId!).eq("userId", currentUser._id),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      if (!membership || membership.role !== "admin") {
        throw new Error("Only team admins can archive team library folders");
      }
    }

    // Archive the folder
    await ctx.db.patch(args.folderId, { isArchived: true });

    // Recursively archive all subfolders
    await archiveSubfolders(ctx, args.folderId);

    console.log("Archived library folder and subfolders:", args.folderId);
  },
});

/**
 * Helper function to recursively archive subfolders.
 */
async function archiveSubfolders(ctx: any, parentFolderId: string) {
  const subfolders = await ctx.db
    .query("libraryFolders")
    .withIndex("by_parent", (q: any) => q.eq("parentFolderId", parentFolderId))
    .filter((q: any) => q.eq(q.field("isArchived"), false))
    .collect();

  for (const subfolder of subfolders) {
    await ctx.db.patch(subfolder._id, { isArchived: true });
    await archiveSubfolders(ctx, subfolder._id);
  }
}

/**
 * Restores an archived library folder.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.folderId - The folder ID to restore
 * @param {boolean} [args.restoreSubfolders] - Whether to restore subfolders
 */
export const restoreLibraryFolder = mutation({
  args: {
    folderId: v.id("libraryFolders"),
    restoreSubfolders: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const folder = await ctx.db.get(args.folderId);

    if (!folder) throw new Error("Library folder not found");

    // Check access
    if (folder.userId && folder.userId !== currentUser._id) {
      throw new Error("Cannot restore this folder");
    }

    if (folder.teamId) {
      const membership = await ctx.db
        .query("teamMemberships")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", folder.teamId!).eq("userId", currentUser._id),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      if (!membership || membership.role !== "admin") {
        throw new Error("Only team admins can restore team library folders");
      }
    }

    // Restore the folder
    await ctx.db.patch(args.folderId, { isArchived: false });

    // Optionally restore subfolders
    if (args.restoreSubfolders) {
      await restoreSubfolders(ctx, args.folderId);
    }

    console.log("Restored library folder:", args.folderId);
  },
});

/**
 * Helper function to recursively restore subfolders.
 */
async function restoreSubfolders(ctx: any, parentFolderId: string) {
  const subfolders = await ctx.db
    .query("libraryFolders")
    .withIndex("by_parent", (q: any) => q.eq("parentFolderId", parentFolderId))
    .filter((q: any) => q.eq(q.field("isArchived"), true))
    .collect();

  for (const subfolder of subfolders) {
    await ctx.db.patch(subfolder._id, { isArchived: false });
    await restoreSubfolders(ctx, subfolder._id);
  }
}

/**
 * Moves a library folder to a different parent.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.folderId - The folder ID to move
 * @param {string} [args.newParentFolderId] - New parent folder ID (undefined for root)
 */
export const moveLibraryFolder = mutation({
  args: {
    folderId: v.id("libraryFolders"),
    newParentFolderId: v.optional(v.id("libraryFolders")),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const folder = await ctx.db.get(args.folderId);

    if (!folder) throw new Error("Library folder not found");

    // Check access
    if (folder.userId && folder.userId !== currentUser._id) {
      throw new Error("Cannot move this folder");
    }

    if (folder.teamId) {
      const membership = await ctx.db
        .query("teamMemberships")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", folder.teamId!).eq("userId", currentUser._id),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      if (!membership) throw new Error("Cannot move this folder");
    }

    // Validate new parent folder if provided
    if (args.newParentFolderId) {
      const newParentFolder = await ctx.db.get(args.newParentFolderId);
      if (!newParentFolder) {
        throw new Error("New parent folder not found");
      }

      // Ensure same scope
      if (folder.teamId && newParentFolder.teamId !== folder.teamId) {
        throw new Error("Cannot move folder to a different team");
      }
      if (folder.userId && newParentFolder.userId !== folder.userId) {
        throw new Error("Cannot move folder to a different scope");
      }

      // Prevent circular references
      if (await isDescendantFolder(ctx, args.newParentFolderId, args.folderId)) {
        throw new Error("Cannot move folder into one of its subfolders");
      }
    }

    // Check for naming conflicts in destination
    const existingFolder = await ctx.db
      .query("libraryFolders")
      .filter((q) => {
        let conditions = [
          q.eq(q.field("name"), folder.name),
          q.eq(q.field("isArchived"), false),
          q.eq(q.field("parentFolderId"), args.newParentFolderId || undefined),
          q.neq(q.field("_id"), args.folderId),
        ];

        if (folder.teamId) {
          conditions.push(q.eq(q.field("teamId"), folder.teamId));
        } else {
          conditions.push(q.eq(q.field("userId"), folder.userId));
        }

        return q.and(...conditions);
      })
      .first();

    if (existingFolder) {
      throw new Error("A folder with this name already exists in the destination");
    }

    // Move the folder
    await ctx.db.patch(args.folderId, {
      parentFolderId: args.newParentFolderId,
    });

    console.log("Moved library folder:", args.folderId);
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

  return await isDescendantFolder(ctx, potentialDescendant.parentFolderId, ancestorId);
}

/**
 * Gets the complete folder hierarchy (breadcrumb path) for a specific folder.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.folderId - The folder ID to get the path for
 * @returns {Promise<Object[]>} Array of folder objects from root to specified folder
 */
export const getLibraryFolderPath = query({
  args: { folderId: v.id("libraryFolders") },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const folder = await ctx.db.get(args.folderId);

    if (!folder) throw new Error("Library folder not found");

    // Check access
    if (folder.userId && folder.userId !== currentUser._id) {
      throw new Error("Cannot access this folder");
    }

    if (folder.teamId) {
      const isTeamMember = await ctx.db
        .query("teamMemberships")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", folder.teamId!).eq("userId", currentUser._id),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      if (!isTeamMember) throw new Error("Cannot access this folder");
    }

    const path = [];
    let currentFolder = folder;

    // Build path from current folder to root
    while (currentFolder) {
      path.unshift(currentFolder);

      if (currentFolder.parentFolderId) {
        const parentFolder = await ctx.db.get(currentFolder.parentFolderId);
        if (!parentFolder) {
          break;
        }
        currentFolder = parentFolder;
      } else {
        break;
      }
    }

    return path;
  },
});

/**
 * Deletes a library folder permanently (use with caution).
 *
 * @param {Object} args - The function arguments
 * @param {string} args.folderId - The folder ID to delete
 */
export const deleteLibraryFolder = mutation({
  args: {
    folderId: v.id("libraryFolders"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const folder = await ctx.db.get(args.folderId);

    if (!folder) throw new Error("Library folder not found");

    // Check access - only owner or team admin
    if (folder.userId && folder.userId !== currentUser._id) {
      throw new Error("Cannot delete this folder");
    }

    if (folder.teamId) {
      const membership = await ctx.db
        .query("teamMemberships")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", folder.teamId!).eq("userId", currentUser._id),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      if (!membership || membership.role !== "admin") {
        throw new Error("Only team admins can delete team library folders");
      }
    }

    // Check for child folders
    const subfolders = await ctx.db
      .query("libraryFolders")
      .withIndex("by_parent", (q) => q.eq("parentFolderId", args.folderId))
      .first();

    if (subfolders) {
      throw new Error("Cannot delete folder with subfolders. Delete or move them first.");
    }

    // Check for documents in this folder
    const documents = await ctx.db
      .query("libraryDocuments")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .first();

    if (documents) {
      throw new Error("Cannot delete folder with documents. Delete or move them first.");
    }

    await ctx.db.delete(args.folderId);
    console.log("Deleted library folder:", args.folderId);
  },
});

