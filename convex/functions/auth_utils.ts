import { QueryCtx, MutationCtx } from "../_generated/server";

// ========================================
// AUTHENTICATION UTILITIES
// Common helpers for Clerk authentication across all functions
// ========================================

/**
 * Retrieves the current authenticated user from the database.
 * 
 * @param {QueryCtx | MutationCtx} ctx - The Convex context object
 * @returns {Promise<Object>} The user document from the database
 * @throws {Error} When user is not authenticated or not found in database
 * 
 * @description This function first verifies the user's Clerk authentication,
 * then looks up their corresponding record in the users table using their Clerk ID.
 * This ensures that authenticated users have been properly synced to the database.
 */
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

/**
 * Ensures the current request is from an authenticated user.
 * 
 * @param {QueryCtx | MutationCtx} ctx - The Convex context object
 * @returns {Promise<Object>} The Clerk identity object
 * @throws {Error} When user is not authenticated
 * 
 * @description This is a lightweight authentication check that only verifies
 * the Clerk authentication token without database lookup. Use this when you
 * only need to ensure authentication but don't need user data.
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new Error("Not authenticated");
  }
  return identity;
}

/**
 * Ensures the current user is an administrator.
 * 
 * @param {QueryCtx | MutationCtx} ctx - The Convex context object
 * @returns {Promise<Object>} The current user document
 * @throws {Error} When user is not authenticated or not an admin
 * 
 * @description This function first authenticates the user, then verifies
 * they have admin role. Use this for operations that require admin privileges.
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const currentUser = await getCurrentUserFromAuth(ctx);
  if (currentUser.role !== "admin") {
    throw new Error("Unauthorized: Admin access required");
  }
  return currentUser;
}

/**
 * Checks if a user has access to a specific case and determines the access level.
 * 
 * @param {QueryCtx | MutationCtx} ctx - The Convex context object
 * @param {string} caseId - The ID of the case to check access for
 * @param {string} userId - The ID of the user to check access for
 * @returns {Promise<Object>} Access information object with hasAccess, accessLevel, and source
 * @throws {Error} When case is not found
 * 
 * @description This function implements the comprehensive access control system:
 * - Direct access: User is assigned lawyer or case creator (full access)
 * - Team access: User belongs to a team with granted access to the case
 * 
 * @example
 * ```javascript
 * const access = await checkCaseAccess(ctx, caseId, userId);
 * if (access.hasAccess) {
 *   console.log(`User has ${access.accessLevel} access via ${access.source}`);
 * }
 * ```
 */
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

/**
 * Ensures the current user has the required access level to a case.
 * 
 * @param {QueryCtx | MutationCtx} ctx - The Convex context object
 * @param {string} caseId - The ID of the case to check access for
 * @param {"read" | "full"} requiredLevel - The minimum access level required (defaults to "read")
 * @returns {Promise<Object>} Object containing currentUser and access information
 * @throws {Error} When user lacks required access or case access
 * 
 * @description This function combines authentication with case access control.
 * It's the primary authorization function used by case-related operations.
 * 
 * Access levels:
 * - "read": Can view case data
 * - "full": Can modify case data
 * 
 * @example
 * ```javascript
 * // Require read access for viewing case
 * const { currentUser, access } = await requireCaseAccess(ctx, caseId, "read");
 * 
 * // Require full access for modifying case
 * const { currentUser, access } = await requireCaseAccess(ctx, caseId, "full");
 * ```
 */
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