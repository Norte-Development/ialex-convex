import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getCurrentUserFromAuth, requireCaseAccess, checkCaseAccess } from "./auth_utils";

// ========================================
// CASE MANAGEMENT
// ========================================

export const createCase = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    assignedLawyer: v.optional(v.id("users")),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    category: v.optional(v.string()),
    estimatedHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Auto-assign to current user if no lawyer specified
    const assignedLawyer = args.assignedLawyer || currentUser._id;
    
    const caseId = await ctx.db.insert("cases", {
      title: args.title,
      description: args.description,
      assignedLawyer: assignedLawyer,
      createdBy: currentUser._id,
      status: "pendiente",
      priority: args.priority,
      category: args.category,
      estimatedHours: args.estimatedHours,
      startDate: Date.now(),
      isArchived: false,
    });
    
    console.log("Created case with id:", caseId);
    return caseId;
  },
});

export const getCases = query({
  args: {
    status: v.optional(v.union(
      v.literal("pendiente"),
      v.literal("en progreso"),
      v.literal("completado"),
      v.literal("archivado"),
      v.literal("cancelado")
    )),
    assignedLawyer: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Get all cases, then filter based on access
    let cases;
    if (args.status) {
      cases = await ctx.db
        .query("cases")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
    } else if (args.assignedLawyer) {
      cases = await ctx.db
        .query("cases")
        .withIndex("by_assigned_lawyer", (q) => q.eq("assignedLawyer", args.assignedLawyer!))
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
    } else {
      cases = await ctx.db
        .query("cases")
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
    }
    
    // Filter cases based on user access (direct or team-based)
    const accessibleCases = [];
    for (const caseData of cases) {
      // Check direct access
      if (caseData.assignedLawyer === currentUser._id || caseData.createdBy === currentUser._id) {
        accessibleCases.push(caseData);
        continue;
      }
      
      // Check team access
      const userMemberships = await ctx.db
        .query("teamMemberships")
        .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
      
      let hasTeamAccess = false;
      for (const membership of userMemberships) {
        const teamAccess = await ctx.db
          .query("teamCaseAccess")
          .withIndex("by_case_and_team", (q) => 
            q.eq("caseId", caseData._id).eq("teamId", membership.teamId)
          )
          .filter((q) => q.eq(q.field("isActive"), true))
          .first();
        
        if (teamAccess) {
          hasTeamAccess = true;
          break;
        }
      }
      
      if (hasTeamAccess) {
        accessibleCases.push(caseData);
      }
    }
    
    return accessibleCases;
  },
});

// ========================================
// CLIENT-CASE RELATIONSHIP MANAGEMENT
// ========================================

export const addClientToCase = mutation({
  args: {
    clientId: v.id("clients"),
    caseId: v.id("cases"),
    role: v.optional(v.string()), // e.g., "plaintiff", "defendant", "witness"
  },
  handler: async (ctx, args) => {
    // Verify user has full access to the case
    const { currentUser } = await requireCaseAccess(ctx, args.caseId, "full");
    
    // Check if relationship already exists
    const existing = await ctx.db
      .query("clientCases")
      .withIndex("by_client_and_case", (q) => 
        q.eq("clientId", args.clientId).eq("caseId", args.caseId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (existing) {
      throw new Error("Client is already associated with this case");
    }
    
    const relationshipId = await ctx.db.insert("clientCases", {
      clientId: args.clientId,
      caseId: args.caseId,
      role: args.role,
      addedBy: currentUser._id,
      isActive: true,
    });
    
    console.log("Added client to case with relationship id:", relationshipId);
    return relationshipId;
  },
});

export const removeClientFromCase = mutation({
  args: {
    clientId: v.id("clients"),
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    // Verify user has full access to the case
    await requireCaseAccess(ctx, args.caseId, "full");
    
    const relationship = await ctx.db
      .query("clientCases")
      .withIndex("by_client_and_case", (q) => 
        q.eq("clientId", args.clientId).eq("caseId", args.caseId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!relationship) {
      throw new Error("Client is not associated with this case");
    }
    
    await ctx.db.patch(relationship._id, { isActive: false });
    console.log("Removed client from case");
  },
});

export const getClientsForCase = query({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    // Verify user has access to the case
    await requireCaseAccess(ctx, args.caseId, "read");
    
    const relationships = await ctx.db
      .query("clientCases")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const clients = await Promise.all(
      relationships.map(async (rel) => {
        const client = await ctx.db.get(rel.clientId);
        return { ...client, role: rel.role };
      })
    );
    
    return clients;
  },
});

export const getCasesForClient = query({
  args: {
    clientId: v.id("clients"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    const relationships = await ctx.db
      .query("clientCases")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    // Filter cases based on user access
    const accessibleCases = [];
    for (const rel of relationships) {
      const access = await checkCaseAccess(ctx, rel.caseId, currentUser._id);
      if (access.hasAccess) {
        const caseData = await ctx.db.get(rel.caseId);
        accessibleCases.push({ ...caseData, clientRole: rel.role });
      }
    }
    
    return accessibleCases;
  },
});

// Helper function to check if a user has access to a case through team membership
export const checkUserCaseAccess = query({
  args: {
    userId: v.optional(v.id("users")),
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Use provided userId or current user's ID
    const userId = args.userId || currentUser._id;
    
    // Only allow checking your own access or admin can check others
    if (userId !== currentUser._id && currentUser.role !== "admin") {
      throw new Error("Unauthorized: Cannot check other users' access");
    }
    
    // Use the centralized checkCaseAccess helper
    return await checkCaseAccess(ctx, args.caseId, userId);
  },
}); 