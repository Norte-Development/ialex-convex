import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { 
  getCurrentUserFromAuth, 
  requireCaseAccess, 
  checkCaseAccess,
  PERMISSIONS 
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
  v.literal("full")
);

/**
 * Grant individual user access to a case with specific permissions
 */
export const grantUserCaseAccess = mutation({
  args: {
    caseId: v.id("cases"),
    userId: v.id("users"),
    permissions: v.array(permissionTypes),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Only users with full access can grant permissions
    const { currentUser } = await requireCaseAccess(ctx, args.caseId, "full");
    
    // Prevent self-granting
    if (currentUser._id === args.userId) {
      throw new Error("Cannot grant permissions to yourself");
    }
    
    // Check if access already exists
    const existing = await ctx.db
      .query("userCaseAccess")
      .withIndex("by_user_and_case", (q) => 
        q.eq("userId", args.userId).eq("caseId", args.caseId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (existing) {
      // Update existing permissions
      await ctx.db.patch(existing._id, {
        permissions: args.permissions,
        grantedBy: currentUser._id,
        grantedAt: Date.now(),
        expiresAt: args.expiresAt,
      });
      return existing._id;
    }
    
    // Create new access
    return await ctx.db.insert("userCaseAccess", {
      caseId: args.caseId,
      userId: args.userId,
      permissions: args.permissions,
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
    await requireCaseAccess(ctx, args.caseId, "full");
    
    const access = await ctx.db
      .query("userCaseAccess")
      .withIndex("by_user_and_case", (q) => 
        q.eq("userId", args.userId).eq("caseId", args.caseId)
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
    await requireCaseAccess(ctx, args.caseId, "read");
    
    const userAccesses = await ctx.db
      .query("userCaseAccess")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .filter((q) => q.or(
        q.eq(q.field("expiresAt"), undefined),
        q.gt(q.field("expiresAt"), Date.now())
      ))
      .collect();
    
    // Get user details
    const usersWithAccess = [];
    for (const access of userAccesses) {
      const user = await ctx.db.get(access.userId);
      if (user) {
        usersWithAccess.push({
          ...access,
          user,
        });
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
    const access = await checkCaseAccess(ctx, args.caseId, currentUser._id);
    
    return {
      hasAccess: access.hasAccess,
      accessLevel: access.accessLevel,
      source: access.source,
      permissions: access.permissions || [],
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
    const access = await checkCaseAccess(ctx, args.caseId, currentUser._id);
    
    if (!access.hasAccess) return false;
    const permissions = access.permissions as string[] || [];
    if (permissions.includes(PERMISSIONS.FULL)) return true;
    
    return permissions.includes(args.permission);
  },
});

// ========================================
// TEAM MEMBER PERMISSIONS
// ========================================

/**
 * Grant specific permissions to a team member for a case
 */
export const grantTeamMemberCaseAccess = mutation({
  args: {
    caseId: v.id("cases"),
    teamId: v.id("teams"),
    userId: v.id("users"),
    permissions: v.array(permissionTypes),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { currentUser } = await requireCaseAccess(ctx, args.caseId, "full");
    
    // Verify user is member of the team
    const membership = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team_and_user", (q) => 
        q.eq("teamId", args.teamId).eq("userId", args.userId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!membership) {
      throw new Error("User is not a member of this team");
    }
    
    // Check if access already exists
    const existing = await ctx.db
      .query("teamMemberCaseAccess")
      .withIndex("by_team_user_case", (q) => 
        q.eq("teamId", args.teamId).eq("userId", args.userId).eq("caseId", args.caseId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        permissions: args.permissions,
        grantedBy: currentUser._id,
        grantedAt: Date.now(),
        expiresAt: args.expiresAt,
      });
      return existing._id;
    }
    
    return await ctx.db.insert("teamMemberCaseAccess", {
      caseId: args.caseId,
      teamId: args.teamId,
      userId: args.userId,
      permissions: args.permissions,
      grantedBy: currentUser._id,
      grantedAt: Date.now(),
      expiresAt: args.expiresAt,
      isActive: true,
    });
  },
});

/**
 * Get all users with access to a case (including team access)
 */
export const getAllUsersWithCaseAccess = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    await requireCaseAccess(ctx, args.caseId, "read");
    
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
    
    // 2. Add users with individual permissions
    const individualAccesses = await ctx.db
      .query("userCaseAccess")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .filter((q) => q.or(
        q.eq(q.field("expiresAt"), undefined),
        q.gt(q.field("expiresAt"), Date.now())
      ))
      .collect();
    
    for (const access of individualAccesses) {
      usersWithAccess.add(access.userId);
    }
    
    // 3. Add users with team access
    const teamAccesses = await ctx.db
      .query("teamCaseAccess")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    for (const teamAccess of teamAccesses) {
      // Get all team members
      const teamMembers = await ctx.db
        .query("teamMemberships")
        .withIndex("by_team", (q) => q.eq("teamId", teamAccess.teamId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
      
      for (const member of teamMembers) {
        usersWithAccess.add(member.userId);
      }
    }
    
    // 4. Add users with specific team member permissions
    const teamMemberAccesses = await ctx.db
      .query("teamMemberCaseAccess")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .filter((q) => q.or(
        q.eq(q.field("expiresAt"), undefined),
        q.gt(q.field("expiresAt"), Date.now())
      ))
      .collect();
    
    for (const access of teamMemberAccesses) {
      usersWithAccess.add(access.userId);
    }
    
    return Array.from(usersWithAccess);
  },
});

/**
 * Get team members with their specific case permissions
 */
export const getTeamMembersWithCaseAccess = query({
  args: { 
    caseId: v.id("cases"),
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    await requireCaseAccess(ctx, args.caseId, "read");
    
    // Get all team members
    const teamMembers = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const membersWithAccess = [];
    
    for (const member of teamMembers) {
      const user = await ctx.db.get(member.userId);
      if (!user) continue;
      
      // Check specific team member permissions
      const memberAccess = await ctx.db
        .query("teamMemberCaseAccess")
        .withIndex("by_team_user_case", (q) => 
          q.eq("teamId", args.teamId).eq("userId", member.userId).eq("caseId", args.caseId)
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .filter((q) => q.or(
          q.eq(q.field("expiresAt"), undefined),
          q.gt(q.field("expiresAt"), Date.now())
        ))
        .first();
      
      membersWithAccess.push({
        user,
        teamRole: member.role,
        specificAccess: memberAccess || null,
        hasSpecificPermissions: !!memberAccess,
      });
    }
    
    return membersWithAccess;
  },
}); 