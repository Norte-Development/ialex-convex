import { v } from "convex/values";
import { query, mutation } from "../_generated/server";

// ========================================
// CASE MANAGEMENT
// ========================================

export const createCase = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    assignedLawyer: v.id("users"),
    createdBy: v.id("users"),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    category: v.optional(v.string()),
    estimatedHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const caseId = await ctx.db.insert("cases", {
      title: args.title,
      description: args.description,
      assignedLawyer: args.assignedLawyer,
      createdBy: args.createdBy,
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
    if (args.status) {
      const cases = await ctx.db
        .query("cases")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
      return cases;
    } else if (args.assignedLawyer) {
      const cases = await ctx.db
        .query("cases")
        .withIndex("by_assigned_lawyer", (q) => q.eq("assignedLawyer", args.assignedLawyer!))
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
      return cases;
    } else {
      const cases = await ctx.db
        .query("cases")
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
      return cases;
    }
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
    addedBy: v.id("users"),
  },
  handler: async (ctx, args) => {
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
      addedBy: args.addedBy,
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
    const relationships = await ctx.db
      .query("clientCases")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const cases = await Promise.all(
      relationships.map(async (rel) => {
        const caseData = await ctx.db.get(rel.caseId);
        return { ...caseData, clientRole: rel.role };
      })
    );
    
    return cases;
  },
});

// Helper function to check if a user has access to a case through team membership
export const checkUserCaseAccess = query({
  args: {
    userId: v.id("users"),
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    // Check direct access (assigned lawyer or case creator)
    const caseData = await ctx.db.get(args.caseId);
    if (!caseData) return { hasAccess: false, accessLevel: null };
    
    if (caseData.assignedLawyer === args.userId || caseData.createdBy === args.userId) {
      return { hasAccess: true, accessLevel: "full", source: "direct" };
    }
    
    // Check team access
    const userMemberships = await ctx.db
      .query("teamMemberships")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    for (const membership of userMemberships) {
      const teamAccess = await ctx.db
        .query("teamCaseAccess")
        .withIndex("by_case_and_team", (q) => 
          q.eq("caseId", args.caseId).eq("teamId", membership.teamId)
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();
      
      if (teamAccess) {
        return { 
          hasAccess: true, 
          accessLevel: teamAccess.accessLevel, 
          source: "team",
          teamId: membership.teamId 
        };
      }
    }
    
    return { hasAccess: false, accessLevel: null };
  },
}); 