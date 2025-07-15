import { v } from "convex/values";
import { query, mutation } from "../_generated/server";

// ========================================
// TEAM MANAGEMENT
// ========================================

export const createTeam = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    department: v.optional(v.string()),
    teamLead: v.optional(v.id("users")),
    createdBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const teamId = await ctx.db.insert("teams", {
      name: args.name,
      description: args.description,
      teamLead: args.teamLead,
      isActive: true,
      createdBy: args.createdBy,
    });
    
    console.log("Created team with id:", teamId);
    return teamId;
  },
});

export const getTeams = query({
  args: {
    department: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_active_status", (q) => q.eq("isActive", args.isActive ?? true))
      .collect();
    
    
    return teams;
  },
});

// ========================================
// TEAM MEMBERSHIP MANAGEMENT
// ========================================

export const addUserToTeam = mutation({
  args: {
    teamId: v.id("teams"),
    userId: v.id("users"),
    role: v.union(v.literal("secretario"), v.literal("abogado"), v.literal("admin")),
    addedBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Check if user is already in the team
    const existing = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team_and_user", (q) => 
        q.eq("teamId", args.teamId).eq("userId", args.userId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (existing) {
      throw new Error("User is already a member of this team");
    }
    
    const membershipId = await ctx.db.insert("teamMemberships", {
      teamId: args.teamId,
      userId: args.userId,
      role: args.role,
      joinedAt: Date.now(),
      addedBy: args.addedBy,
      isActive: true,
    });
    
    console.log("Added user to team with membership id:", membershipId);
    return membershipId;
  },
});

export const removeUserFromTeam = mutation({
  args: {
    teamId: v.id("teams"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
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
    
    await ctx.db.patch(membership._id, { isActive: false });
    console.log("Removed user from team");
  },
});

export const getTeamMembers = query({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const members = await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId);
        return { 
          ...user, 
          teamRole: membership.role,
          joinedAt: membership.joinedAt 
        };
      })
    );
    
    return members;
  },
});

export const getUserTeams = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("teamMemberships")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const teams = await Promise.all(
      memberships.map(async (membership) => {
        const team = await ctx.db.get(membership.teamId);
        return { 
          ...team, 
          userRole: membership.role,
          joinedAt: membership.joinedAt 
        };
      })
    );
    
    return teams;
  },
});

// ========================================
// TEAM CASE ACCESS MANAGEMENT
// ========================================

export const grantTeamCaseAccess = mutation({
  args: {
    caseId: v.id("cases"),
    teamId: v.id("teams"),
    accessLevel: v.union(v.literal("full"), v.literal("read")),
    grantedBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Check if access already exists
    const existing = await ctx.db
      .query("teamCaseAccess")
      .withIndex("by_case_and_team", (q) => 
        q.eq("caseId", args.caseId).eq("teamId", args.teamId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (existing) {
      // Update existing access level
      await ctx.db.patch(existing._id, { 
        accessLevel: args.accessLevel,
        grantedBy: args.grantedBy 
      });
      console.log("Updated team case access");
      return existing._id;
    } else {
      // Create new access
      const accessId = await ctx.db.insert("teamCaseAccess", {
        caseId: args.caseId,
        teamId: args.teamId,
        accessLevel: args.accessLevel,
        grantedBy: args.grantedBy,
        isActive: true,
      });
      
      console.log("Granted team case access with id:", accessId);
      return accessId;
    }
  },
});

export const revokeTeamCaseAccess = mutation({
  args: {
    caseId: v.id("cases"),
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const access = await ctx.db
      .query("teamCaseAccess")
      .withIndex("by_case_and_team", (q) => 
        q.eq("caseId", args.caseId).eq("teamId", args.teamId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!access) {
      throw new Error("Team does not have access to this case");
    }
    
    await ctx.db.patch(access._id, { isActive: false });
    console.log("Revoked team case access");
  },
});

export const getTeamsWithCaseAccess = query({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    const accesses = await ctx.db
      .query("teamCaseAccess")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const teamsWithAccess = await Promise.all(
      accesses.map(async (access) => {
        const team = await ctx.db.get(access.teamId);
        return { 
          ...team, 
          accessLevel: access.accessLevel,
          grantedBy: access.grantedBy 
        };
      })
    );
    
    return teamsWithAccess;
  },
});

export const getCasesAccessibleByTeam = query({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const accesses = await ctx.db
      .query("teamCaseAccess")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const cases = await Promise.all(
      accesses.map(async (access) => {
        const caseData = await ctx.db.get(access.caseId);
        return { 
          ...caseData, 
          accessLevel: access.accessLevel 
        };
      })
    );
    
    return cases;
  },
}); 