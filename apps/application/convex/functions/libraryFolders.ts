import { v } from "convex/values";
import { query, mutation, internalMutation } from "../_generated/server";
import { internal, api } from "../_generated/api";
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
 * @param {string} [args.teamId] - Team ID for team library (optional, defaults to personal)
 * @param {string} [args.parentFolderId] - Optional parent folder filter
 * @param {boolean} [args.includeArchived] - Include archived folders
 * @returns {Promise<Object[]>} Array of folders sorted by sortOrder then name
 */
export const getLibraryFolders = query({
  args: {
    teamId: v.optional(v.id("teams")),
    parentFolderId: v.optional(v.id("libraryFolders")),
    includeArchived: v.optional(v.boolean()),
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
      // Personal library - use currentUser._id from auth
      folders = await ctx.db
        .query("libraryFolders")
        .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
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
 * Gets document counts for multiple library folders.
 * Useful for displaying folder item counts efficiently.
 *
 * @param {Object} args - The function arguments
 * @param {string[]} args.folderIds - Array of folder IDs to get counts for
 * @param {string} [args.teamId] - Team ID for team library (optional, defaults to personal)
 * @returns {Promise<Record<string, number>>} Map of folderId -> document count
 */
export const getLibraryFolderDocumentCounts = query({
  args: {
    folderIds: v.array(v.id("libraryFolders")),
    teamId: v.optional(v.id("teams")),
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

    const counts: Record<string, number> = {};

    // Get counts for each folder
    for (const folderId of args.folderIds) {
      const folder = await ctx.db.get(folderId);
      if (!folder) continue;

      // Verify access - must match scope (personal or team)
      if (args.teamId) {
        // Team library - folder must belong to the same team
        if (folder.teamId !== args.teamId) continue;
      } else {
        // Personal library - folder must belong to current user
        if (folder.userId !== currentUser._id) continue;
      }

      // Count documents in this folder
      const documentCount = await ctx.db
        .query("libraryDocuments")
        .withIndex("by_folder", (q) => q.eq("folderId", folderId))
        .collect();

      counts[folderId] = documentCount.length;
    }

    return counts;
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

// ========================================
// ROOT FOLDER MANAGEMENT
// ========================================

/**
 * Ensures the Root folder exists and migrates existing top-level items to it.
 * This should be called when a user first accesses their library to ensure
 * proper folder structure. Safe to call multiple times (idempotent).
 *
 * @param {Object} args - The function arguments
 * @param {string} [args.teamId] - Team ID for team library (optional, defaults to personal)
 * @returns {Promise<Object>} The Root folder document
 */
export const ensureLibraryRootFolder = mutation({
  args: {
    teamId: v.optional(v.id("teams")),
  },
  handler: async (ctx, args): Promise<{
    _id: string;
    _creationTime: number;
    name: string;
    description?: string;
    userId?: string;
    teamId?: string;
    parentFolderId?: string;
    color?: string;
    isArchived: boolean;
    createdBy: string;
    sortOrder?: number;
  }> => {
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

    // Use internal function to ensure Root exists and migrate
    const rootFolder = await ctx.runMutation(
      internal.functions.libraryFolders.getOrCreateLibraryRootFolder,
      {
        teamId: args.teamId,
        userId: currentUser._id,
      },
    );

    return rootFolder;
  },
});

/**
 * Gets the Root folder for the current user or specified team.
 * Root folder is a special folder that serves as the top-level container.
 *
 * @param {Object} args - The function arguments
 * @param {string} [args.teamId] - Team ID for team library (optional, defaults to personal)
 * @returns {Promise<Object>} The Root folder document
 */
export const getLibraryRootFolder = query({
  args: {
    teamId: v.optional(v.id("teams")),
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

    // Root folder has name "Root" and no parent
    let rootFolder;
    if (args.teamId) {
      rootFolder = await ctx.db
        .query("libraryFolders")
        .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
        .filter((q) =>
          q.and(
            q.eq(q.field("name"), "Root"),
            q.eq(q.field("parentFolderId"), undefined),
            q.eq(q.field("isArchived"), false),
          ),
        )
        .first();
    } else {
      rootFolder = await ctx.db
        .query("libraryFolders")
        .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
        .filter((q) =>
          q.and(
            q.eq(q.field("name"), "Root"),
            q.eq(q.field("parentFolderId"), undefined),
            q.eq(q.field("isArchived"), false),
          ),
        )
        .first();
    }

    return rootFolder;
  },
});

/**
 * Gets or creates the Root folder for a given scope (personal or team).
 * Automatically migrates existing top-level items to Root when Root is first created.
 * This is an internal function used to ensure Root exists and migration is complete.
 *
 * @param {Object} args - The function arguments
 * @param {string} [args.teamId] - Team ID for team library (optional, defaults to personal)
 * @param {string} args.userId - User ID (required for personal library or team admin)
 * @returns {Promise<Object>} The Root folder document
 */
export const getOrCreateLibraryRootFolder = internalMutation({
  args: {
    teamId: v.optional(v.id("teams")),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Check if Root folder already exists
    let rootFolder;
    if (args.teamId) {
      rootFolder = await ctx.db
        .query("libraryFolders")
        .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
        .filter((q) =>
          q.and(
            q.eq(q.field("name"), "Root"),
            q.eq(q.field("parentFolderId"), undefined),
            q.eq(q.field("isArchived"), false),
          ),
        )
        .first();
    } else {
      rootFolder = await ctx.db
        .query("libraryFolders")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .filter((q) =>
          q.and(
            q.eq(q.field("name"), "Root"),
            q.eq(q.field("parentFolderId"), undefined),
            q.eq(q.field("isArchived"), false),
          ),
        )
        .first();
    }

    // Create Root folder if it doesn't exist
    const wasCreated = !rootFolder;
    if (!rootFolder) {
      const rootFolderId = await ctx.db.insert("libraryFolders", {
        name: "Root",
        description: "Root folder - top level container",
        userId: args.teamId ? undefined : args.userId,
        teamId: args.teamId ?? undefined,
        parentFolderId: undefined,
        isArchived: false,
        createdBy: args.userId,
        sortOrder: 0,
      });
      const createdRoot = await ctx.db.get(rootFolderId);
      if (!createdRoot) {
        throw new Error("Failed to create Root folder");
      }
      rootFolder = createdRoot;
    }

    // If Root was just created, migrate existing top-level items to it
    if (wasCreated) {
      const rootFolderId = rootFolder._id;
      let foldersUpdated = 0;
      let documentsUpdated = 0;

      // Migrate folders with undefined parentFolderId
      let foldersToMigrate;
      if (args.teamId) {
        foldersToMigrate = await ctx.db
          .query("libraryFolders")
          .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
          .filter((q) =>
            q.and(
              q.eq(q.field("parentFolderId"), undefined),
              q.neq(q.field("_id"), rootFolderId),
              q.eq(q.field("isArchived"), false),
            ),
          )
          .collect();
      } else {
        foldersToMigrate = await ctx.db
          .query("libraryFolders")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .filter((q) =>
            q.and(
              q.eq(q.field("parentFolderId"), undefined),
              q.neq(q.field("_id"), rootFolderId),
              q.eq(q.field("isArchived"), false),
            ),
          )
          .collect();
      }

      for (const folder of foldersToMigrate) {
        await ctx.db.patch(folder._id, {
          parentFolderId: rootFolderId,
        });
        foldersUpdated++;
      }

      // Migrate documents with undefined folderId
      let documentsToMigrate;
      if (args.teamId) {
        documentsToMigrate = await ctx.db
          .query("libraryDocuments")
          .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
          .filter((q) => q.eq(q.field("folderId"), undefined))
          .collect();
      } else {
        documentsToMigrate = await ctx.db
          .query("libraryDocuments")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .filter((q) => q.eq(q.field("folderId"), undefined))
          .collect();
      }

      for (const document of documentsToMigrate) {
        await ctx.db.patch(document._id, {
          folderId: rootFolderId,
        });
        documentsUpdated++;
      }

      console.log(
        `Created Root folder and migrated ${foldersUpdated} folders and ${documentsUpdated} documents`,
      );
    }

    return rootFolder;
  },
});

/**
 * Migrates implicit root (undefined parentFolderId/folderId) to explicit Root folder.
 * This ensures all top-level items are properly parented under the Root folder.
 *
 * @param {Object} args - The function arguments
 * @param {string} [args.teamId] - Team ID for team library (optional, defaults to personal)
 * @param {string} args.userId - User ID (required)
 * @returns {Promise<Object>} Migration results with counts
 */
export const migrateImplicitRootToExplicitRoot = internalMutation({
  args: {
    teamId: v.optional(v.id("teams")),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Check if Root folder already exists
    let rootFolder;
    if (args.teamId) {
      rootFolder = await ctx.db
        .query("libraryFolders")
        .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
        .filter((q) =>
          q.and(
            q.eq(q.field("name"), "Root"),
            q.eq(q.field("parentFolderId"), undefined),
            q.eq(q.field("isArchived"), false),
          ),
        )
        .first();
    } else {
      rootFolder = await ctx.db
        .query("libraryFolders")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .filter((q) =>
          q.and(
            q.eq(q.field("name"), "Root"),
            q.eq(q.field("parentFolderId"), undefined),
            q.eq(q.field("isArchived"), false),
          ),
        )
        .first();
    }

    // Create Root folder if it doesn't exist
    if (!rootFolder) {
      const rootFolderId = await ctx.db.insert("libraryFolders", {
        name: "Root",
        description: "Root folder - top level container",
        userId: args.teamId ? undefined : args.userId,
        teamId: args.teamId ?? undefined,
        parentFolderId: undefined,
        isArchived: false,
        createdBy: args.userId,
        sortOrder: 0,
      });
      const createdRoot = await ctx.db.get(rootFolderId);
      if (!createdRoot) {
        throw new Error("Failed to create Root folder");
      }
      rootFolder = createdRoot;
    }

    const rootFolderId = rootFolder._id;
    let foldersUpdated = 0;
    let documentsUpdated = 0;

    // Migrate folders with undefined parentFolderId
    let foldersToMigrate;
    if (args.teamId) {
      foldersToMigrate = await ctx.db
        .query("libraryFolders")
        .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
        .filter((q) =>
          q.and(
            q.eq(q.field("parentFolderId"), undefined),
            q.neq(q.field("_id"), rootFolderId),
            q.eq(q.field("isArchived"), false),
          ),
        )
        .collect();
    } else {
      foldersToMigrate = await ctx.db
        .query("libraryFolders")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .filter((q) =>
          q.and(
            q.eq(q.field("parentFolderId"), undefined),
            q.neq(q.field("_id"), rootFolderId),
            q.eq(q.field("isArchived"), false),
          ),
        )
        .collect();
    }

    for (const folder of foldersToMigrate) {
      await ctx.db.patch(folder._id, {
        parentFolderId: rootFolderId,
      });
      foldersUpdated++;
    }

    // Migrate documents with undefined folderId
    let documentsToMigrate;
    if (args.teamId) {
      documentsToMigrate = await ctx.db
        .query("libraryDocuments")
        .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
        .filter((q) => q.eq(q.field("folderId"), undefined))
        .collect();
    } else {
      documentsToMigrate = await ctx.db
        .query("libraryDocuments")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .filter((q) => q.eq(q.field("folderId"), undefined))
        .collect();
    }

    for (const document of documentsToMigrate) {
      await ctx.db.patch(document._id, {
        folderId: rootFolderId,
      });
      documentsUpdated++;
    }

    return {
      rootId: rootFolderId,
      foldersUpdated,
      documentsUpdated,
    };
  },
});

// ========================================
// MOVE DESTINATION LISTING
// ========================================

/**
 * Helper function to build folder hierarchy and compute paths.
 * Returns a map of folderId -> { folder, path, depth }
 */
async function buildFolderHierarchy(
  ctx: any,
  folders: any[],
  rootFolderId: string,
): Promise<Map<string, { folder: any; path: string; depth: number }>> {
  const folderMap = new Map(folders.map((f) => [f._id, f]));
  const childrenMap = new Map<string, any[]>();

  // Build children map
  for (const folder of folders) {
    if (folder.parentFolderId) {
      if (!childrenMap.has(folder.parentFolderId)) {
        childrenMap.set(folder.parentFolderId, []);
      }
      childrenMap.get(folder.parentFolderId)!.push(folder);
    }
  }

  const result = new Map<string, { folder: any; path: string; depth: number }>();

  // DFS from root to build paths
  function buildPath(folderId: string, currentPath: string, depth: number) {
    const folder = folderMap.get(folderId);
    if (!folder) return;

    const path = currentPath === "Root" ? "Root" : `${currentPath} / ${folder.name}`;
    result.set(folderId, { folder, path, depth });

    const children = childrenMap.get(folderId) || [];
    for (const child of children) {
      buildPath(child._id, path, depth + 1);
    }
  }

  buildPath(rootFolderId, "Root", 0);
  return result;
}

/**
 * Helper function to get all descendant folder IDs (including the folder itself).
 */
async function getAllDescendantIds(
  ctx: any,
  folderId: string,
  folders: any[],
): Promise<Set<string>> {
  const result = new Set<string>([folderId]);
  const childrenMap = new Map<string, any[]>();

  for (const folder of folders) {
    if (folder.parentFolderId) {
      if (!childrenMap.has(folder.parentFolderId)) {
        childrenMap.set(folder.parentFolderId, []);
      }
      childrenMap.get(folder.parentFolderId)!.push(folder);
    }
  }

  function collectDescendants(id: string) {
    const children = childrenMap.get(id) || [];
    for (const child of children) {
      result.add(child._id);
      collectDescendants(child._id);
    }
  }

  collectDescendants(folderId);
  return result;
}

/**
 * Lists all valid move destinations for a library folder.
 * Returns folders in the same scope, excluding the folder itself and its descendants.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.folderId - The folder ID to get destinations for
 * @returns {Promise<Array>} Array of destination options with folderId, name, path, and depth
 */
export const listMoveDestinationsForLibraryFolder = query({
  args: {
    folderId: v.id("libraryFolders"),
  },
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

    // Ensure Root folder exists (on-demand migration)
    // Look up Root folder directly (can't call query from query)
    let rootFolder;
    if (folder.teamId) {
      rootFolder = await ctx.db
        .query("libraryFolders")
        .withIndex("by_team", (q) => q.eq("teamId", folder.teamId))
        .filter((q) =>
          q.and(
            q.eq(q.field("name"), "Root"),
            q.eq(q.field("parentFolderId"), undefined),
            q.eq(q.field("isArchived"), false),
          ),
        )
        .first();
    } else {
      rootFolder = await ctx.db
        .query("libraryFolders")
        .withIndex("by_user", (q) => q.eq("userId", folder.userId || currentUser._id))
        .filter((q) =>
          q.and(
            q.eq(q.field("name"), "Root"),
            q.eq(q.field("parentFolderId"), undefined),
            q.eq(q.field("isArchived"), false),
          ),
        )
        .first();
    }

    // Create Root if it doesn't exist (can't create from query, so return null and let UI handle)
    if (!rootFolder) {
      // Root will be created on first mutation operation
      // For now, return empty list - UI should trigger migration first
      return [];
    }

    // Get all folders in the same scope (non-archived)
    let allFolders;
    if (folder.teamId) {
      allFolders = await ctx.db
        .query("libraryFolders")
        .withIndex("by_team", (q) => q.eq("teamId", folder.teamId))
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
    } else {
      allFolders = await ctx.db
        .query("libraryFolders")
        .withIndex("by_user", (q) => q.eq("userId", folder.userId || currentUser._id))
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
    }

    // Build hierarchy and paths
    const hierarchy = await buildFolderHierarchy(ctx, allFolders, rootFolder._id);

    // Get all descendant IDs (folder itself + all subfolders)
    const excludedIds = await getAllDescendantIds(ctx, args.folderId, allFolders);

    // Filter out excluded folders and build result
    const destinations: Array<{
      folderId: string;
      name: string;
      path: string;
      depth: number;
    }> = [];

    for (const [folderId, { folder, path, depth }] of hierarchy) {
      if (!excludedIds.has(folderId)) {
        destinations.push({
          folderId: folder._id,
          name: folder.name,
          path,
          depth,
        });
      }
    }

    // Sort by depth then name
    destinations.sort((a, b) => {
      if (a.depth !== b.depth) {
        return a.depth - b.depth;
      }
      return a.name.localeCompare(b.name);
    });

    return destinations;
  },
});

/**
 * Lists all valid move destinations for a library document.
 * Returns all folders in the same scope (non-archived).
 *
 * @param {Object} args - The function arguments
 * @param {string} args.documentId - The document ID to get destinations for
 * @returns {Promise<Array>} Array of destination options with folderId, name, path, and depth
 */
export const listMoveDestinationsForLibraryDocument = query({
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

    // Ensure Root folder exists (on-demand migration)
    // Look up Root folder directly (can't call query from query)
    let rootFolder;
    if (document.teamId) {
      rootFolder = await ctx.db
        .query("libraryFolders")
        .withIndex("by_team", (q) => q.eq("teamId", document.teamId))
        .filter((q) =>
          q.and(
            q.eq(q.field("name"), "Root"),
            q.eq(q.field("parentFolderId"), undefined),
            q.eq(q.field("isArchived"), false),
          ),
        )
        .first();
    } else {
      rootFolder = await ctx.db
        .query("libraryFolders")
        .withIndex("by_user", (q) => q.eq("userId", document.userId || currentUser._id))
        .filter((q) =>
          q.and(
            q.eq(q.field("name"), "Root"),
            q.eq(q.field("parentFolderId"), undefined),
            q.eq(q.field("isArchived"), false),
          ),
        )
        .first();
    }

    // Create Root if it doesn't exist (can't create from query, so return empty list and let UI handle)
    if (!rootFolder) {
      // Root will be created on first mutation operation
      // For now, return empty list - UI should trigger migration first
      return [];
    }

    // Get all folders in the same scope (non-archived)
    let allFolders;
    if (document.teamId) {
      allFolders = await ctx.db
        .query("libraryFolders")
        .withIndex("by_team", (q) => q.eq("teamId", document.teamId))
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
    } else {
      allFolders = await ctx.db
        .query("libraryFolders")
        .withIndex("by_user", (q) => q.eq("userId", document.userId || currentUser._id))
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
    }

    // Build hierarchy and paths
    const hierarchy = await buildFolderHierarchy(ctx, allFolders, rootFolder._id);

    // Build result array
    const destinations: Array<{
      folderId: string;
      name: string;
      path: string;
      depth: number;
    }> = [];

    for (const [folderId, { folder, path, depth }] of hierarchy) {
      destinations.push({
        folderId: folder._id,
        name: folder.name,
        path,
        depth,
      });
    }

    // Sort by depth then name
    destinations.sort((a, b) => {
      if (a.depth !== b.depth) {
        return a.depth - b.depth;
      }
      return a.name.localeCompare(b.name);
    });

    return destinations;
  },
});

// ========================================
// CONVENIENCE FUNCTIONS
// ========================================

/**
 * Moves a library folder to Root (convenience wrapper).
 *
 * @param {Object} args - The function arguments
 * @param {string} args.folderId - The folder ID to move
 */
export const moveLibraryFolderToRoot = mutation({
  args: {
    folderId: v.id("libraryFolders"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const folder = await ctx.db.get(args.folderId);

    if (!folder) throw new Error("Library folder not found");

    // Ensure Root exists and migrate existing items (idempotent)
    const rootFolder = await ctx.runMutation(
      internal.functions.libraryFolders.getOrCreateLibraryRootFolder,
      {
        teamId: folder.teamId,
        userId: folder.userId || currentUser._id,
      },
    );

    // Use existing move function via API
    await ctx.runMutation(api.functions.libraryFolders.moveLibraryFolder, {
      folderId: args.folderId,
      newParentFolderId: rootFolder._id,
    });
  },
});

// ========================================
// COMBINED LISTING (OPTIONAL)
// ========================================

/**
 * Gets all library items (folders + documents) for a given parent folder.
 * Useful for displaying folder contents in a unified view.
 *
 * @param {Object} args - The function arguments
 * @param {string} [args.teamId] - Team ID for team library (optional, defaults to personal)
 * @param {string} [args.parentFolderId] - Parent folder ID (undefined for Root)
 * @returns {Promise<Object>} Object with folders and documents arrays
 */
export const getLibraryItems = query({
  args: {
    teamId: v.optional(v.id("teams")),
    parentFolderId: v.optional(v.id("libraryFolders")),
  },
  handler: async (ctx, args): Promise<{
    folders: any[];
    documents: any[];
  }> => {
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

    // Get folders directly
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
      folders = await ctx.db
        .query("libraryFolders")
        .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
        .filter((q) =>
          q.eq(q.field("parentFolderId"), args.parentFolderId || undefined),
        )
        .collect();
    }

    // Filter archived
    folders = folders.filter((folder) => !folder.isArchived);

    // Sort folders
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

    // Get documents directly
    let documents;
    if (args.parentFolderId) {
      documents = await ctx.db
        .query("libraryDocuments")
        .withIndex("by_folder", (q) => q.eq("folderId", args.parentFolderId))
        .order("desc")
        .collect();
    } else if (args.teamId) {
      documents = await ctx.db
        .query("libraryDocuments")
        .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
        .filter((q) => q.eq(q.field("folderId"), undefined))
        .order("desc")
        .collect();
    } else {
      documents = await ctx.db
        .query("libraryDocuments")
        .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
        .filter((q) => q.eq(q.field("folderId"), undefined))
        .order("desc")
        .collect();
    }

    return {
      folders,
      documents,
    };
  },
});

