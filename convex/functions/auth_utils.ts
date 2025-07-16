import { QueryCtx, MutationCtx } from "../_generated/server";

// ========================================
// AUTHENTICATION UTILITIES
// Common helpers for Clerk authentication across all functions
// ========================================

export async function getCurrentUserFromAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new Error("Not authenticated");
  }
  
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  
  if (!user) {
    throw new Error("User not found in database");
  }
  
  return user;
}

export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new Error("Not authenticated");
  }
  return identity;
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const currentUser = await getCurrentUserFromAuth(ctx);
  if (currentUser.role !== "admin") {
    throw new Error("Unauthorized: Admin access required");
  }
  return currentUser;
}

export async function checkCaseAccess(ctx: QueryCtx | MutationCtx, caseId: string, userId: string) {
  // Check if case exists
  const caseData = await ctx.db.get(caseId as any);
  if (!caseData) {
    throw new Error("Case not found");
  }
  
  // Type assertion - we know this is a case
  const caseRecord = caseData as any;
  
  // Check direct access (assigned lawyer or case creator)
  if (caseRecord.assignedLawyer === userId || caseRecord.createdBy === userId) {
    return { hasAccess: true, accessLevel: "full", source: "direct" };
  }
  
  // Check team access
  const userMemberships = await ctx.db
    .query("teamMemberships")
    .withIndex("by_user", (q) => q.eq("userId", userId as any))
    .filter((q) => q.eq(q.field("isActive"), true))
    .collect();
  
  for (const membership of userMemberships) {
    const teamAccess = await ctx.db
      .query("teamCaseAccess")
      .withIndex("by_case_and_team", (q) => 
        q.eq("caseId", caseId as any).eq("teamId", membership.teamId)
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
}

export async function requireCaseAccess(ctx: QueryCtx | MutationCtx, caseId: string, requiredLevel: "read" | "full" = "read") {
  const currentUser = await getCurrentUserFromAuth(ctx);
  const access = await checkCaseAccess(ctx, caseId, currentUser._id);
  
  if (!access.hasAccess) {
    throw new Error("Unauthorized: No access to this case");
  }
  
  if (requiredLevel === "full" && access.accessLevel === "read") {
    throw new Error("Unauthorized: Full access required for this operation");
  }
  
  return { currentUser, access };
} 