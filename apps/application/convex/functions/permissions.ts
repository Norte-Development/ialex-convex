import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import {
  getCurrentUserFromAuth,
  checkNewCaseAccess,
  AccessLevel,
  grantNewCaseAccess,
  requireNewCaseAccess,
} from "../auth_utils";

// Permission types for validation - matching frontend constants
const permissionTypes = v.union(
  // Case-level permissions
  v.literal("case.view"),
  v.literal("case.edit"),
  v.literal("case.delete"),

  // Document permissions
  v.literal("documents.read"),
  v.literal("documents.write"),
  v.literal("documents.delete"),

  // Escrito permissions
  v.literal("escritos.read"),
  v.literal("escritos.write"),
  v.literal("escritos.delete"),

  // Client permissions
  v.literal("clients.read"),
  v.literal("clients.write"),
  v.literal("clients.delete"),

  // Team permissions
  v.literal("teams.read"),
  v.literal("teams.write"),

  // Chat permissions
  v.literal("chat.access"),

  // Full access
  v.literal("full"),
);

const newAccessLevelType = v.union(
  v.literal("none"),
  v.literal("basic"),
  v.literal("advanced"),
  v.literal("admin"),
);

/**
 * Grant individual user access to a case with specific permissions
 */
export const grantUserCaseAccess = mutation({
  args: {
    caseId: v.id("cases"),
    userId: v.id("users"),
    accessLevel: newAccessLevelType,
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Only users with full access can grant permissions
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "admin");

    // Prevent self-granting
    if (currentUser._id === args.userId) {
      throw new Error("Cannot grant permissions to yourself");
    }

    // Check if access already exists
    const existing = await ctx.db
      .query("caseAccess")
      .withIndex("by_case_and_user", (q) =>
        q.eq("caseId", args.caseId).eq("userId", args.userId),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (existing) {
      // Update existing permissions
      await ctx.db.patch(existing._id, {
        accessLevel: args.accessLevel,
        grantedBy: currentUser._id,
        grantedAt: Date.now(),
        expiresAt: args.expiresAt,
      });
      return existing._id;
    }

    // Create new access
    return await ctx.db.insert("caseAccess", {
      caseId: args.caseId,
      userId: args.userId,
      accessLevel: args.accessLevel,
      grantedBy: currentUser._id,
      grantedAt: Date.now(),
      expiresAt: args.expiresAt,
      isActive: true,
    });
  },
});

/**
 * Revoke user access to a case
 */
export const revokeUserCaseAccess = mutation({
  args: {
    caseId: v.id("cases"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "admin");

    const access = await ctx.db
      .query("caseAccess")
      .withIndex("by_case_and_user", (q) =>
        q.eq("caseId", args.caseId).eq("userId", args.userId),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (access) {
      await ctx.db.patch(access._id, { isActive: false });
    }
  },
});

/**
 * Get all users with access to a specific case
 */
export const getUsersWithCaseAccess = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");

    const userAccesses = await ctx.db
      .query("caseAccess")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .filter((q) => q.neq(q.field("userId"), undefined))
      .filter((q) =>
        q.or(
          q.eq(q.field("expiresAt"), undefined),
          q.gt(q.field("expiresAt"), Date.now()),
        ),
      )
      .collect();

    // Get user details
    const usersWithAccess = [];
    for (const access of userAccesses) {
      if (access.userId) {
        const user = await ctx.db.get(access.userId);
        if (user) {
          usersWithAccess.push({
            ...access,
            user,
          });
        }
      }
    }

    return usersWithAccess;
  },
});

/**
 * Get current user's permissions for a case
 */
export const getUserCasePermissions = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const access = await checkNewCaseAccess(
      ctx,
      currentUser._id,
      args.caseId,
      "basic",
    );

    return {
      hasAccess: access.hasAccess,
      accessLevel: access.userLevel,
      source: access.source,
    };
  },
});

/**
 * Check if current user has specific permission
 */
export const hasPermission = query({
  args: {
    caseId: v.id("cases"),
    permission: permissionTypes,
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const access = await checkNewCaseAccess(
      ctx,
      currentUser._id,
      args.caseId,
      "basic",
    );

    if (!access.hasAccess) return false;
    const permissions = access.userLevel || "none";

    return permissions.includes(args.permission);
  },
});

/**
 * Check if current user has sufficient access level (new system)
 */
export const hasNewAccessLevel = query({
  args: {
    caseId: v.id("cases"),
    requiredLevel: newAccessLevelType,
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const access = await checkNewCaseAccess(
      ctx,
      currentUser._id,
      args.caseId,
      args.requiredLevel as AccessLevel,
    );

    return access.hasAccess;
  },
});

/**
 * Get all users with access to a case (including team access) - new system
 */
export const getAllNewUsersWithCaseAccess = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");

    const caseData = await ctx.db.get(args.caseId);
    if (!caseData) {
      throw new Error("Case not found");
    }

    const usersWithAccess = new Set();

    // 1. Add direct access users (assigned lawyer and creator)
    if (caseData.assignedLawyer) {
      usersWithAccess.add(caseData.assignedLawyer);
    }
    if (caseData.createdBy) {
      usersWithAccess.add(caseData.createdBy);
    }

    // 2. Get all access records from the new unified table
    const allAccesses = await ctx.db
      .query("caseAccess")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .filter((q) =>
        q.or(
          q.eq(q.field("expiresAt"), undefined),
          q.gt(q.field("expiresAt"), Date.now()),
        ),
      )
      .collect();

    // 3. Add users with direct access
    for (const access of allAccesses) {
      if (access.userId) {
        usersWithAccess.add(access.userId);
      }
    }

    // 4. Add users with team access
    for (const access of allAccesses) {
      if (access.teamId) {
        const teamId = access.teamId;
        const teamMembers = await ctx.db
          .query("teamMemberships")
          .withIndex("by_team", (q) => q.eq("teamId", teamId))
          .filter((q) => q.eq(q.field("isActive"), true))
          .collect();

        for (const member of teamMembers) {
          usersWithAccess.add(member.userId);
        }
      }
    }

    return Array.from(usersWithAccess);
  },
});

// Get users with individual case access (new hierarchical system)
export const getNewUsersWithCaseAccess = query({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");

    const userAccess = await ctx.db
      .query("caseAccess")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.neq(q.field("userId"), undefined))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const usersWithAccess = [];
    for (const access of userAccess) {
      if (access.userId) {
        const user = await ctx.db.get(access.userId);
        if (user) {
          usersWithAccess.push({
            userId: access.userId,
            user: {
              _id: user._id,
              name: user.name,
              email: user.email,
            },
            accessLevel: access.accessLevel,
            grantedAt: access.grantedAt,
            grantedBy: access.grantedBy,
            expiresAt: access.expiresAt,
          });
        }
      }
    }

    return usersWithAccess;
  },
});

// Grant individual case access (new hierarchical system)
export const grantNewUserCaseAccess = mutation({
  args: {
    caseId: v.id("cases"),
    userId: v.id("users"),
    accessLevel: newAccessLevelType,
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "admin");

    // Remove ALL existing access records for this user and case
    // Use the more specific index and collect all records to handle edge cases
    const existingAccessRecords = await ctx.db
      .query("caseAccess")
      .withIndex("by_case_and_user", (q) =>
        q.eq("caseId", args.caseId).eq("userId", args.userId),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Deactivate all existing records
    for (const record of existingAccessRecords) {
      await ctx.db.patch(record._id, { isActive: false });
    }

    // Grant new access
    const accessId = await ctx.db.insert("caseAccess", {
      caseId: args.caseId,
      userId: args.userId,
      accessLevel: args.accessLevel,
      grantedBy: currentUser._id,
      grantedAt: Date.now(),
      expiresAt: args.expiresAt,
      isActive: true,
    });

    return accessId;
  },
});
