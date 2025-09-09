import { QueryCtx, MutationCtx } from "./_generated/server";
import { ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";

// // Frontend permission constants for type safety
// export const PERMISSIONS = {
//   // Case-level permissions
//   CASE_VIEW: "case.view",
//   CASE_EDIT: "case.edit",
//   CASE_DELETE: "case.delete",

//   // Document permissions
//   DOC_READ: "documents.read",
//   DOC_WRITE: "documents.write",
//   DOC_DELETE: "documents.delete",

//   // Escrito permissions
//   ESCRITO_READ: "escritos.read",
//   ESCRITO_WRITE: "escritos.write",
//   ESCRITO_DELETE: "escritos.delete",

//   // Client permissions
//   CLIENT_READ: "clients.read",
//   CLIENT_WRITE: "clients.write",
//   CLIENT_DELETE: "clients.delete",

//   // Team permissions
//   TEAM_READ: "teams.read",
//   TEAM_WRITE: "teams.write",

//   // Chat permissions
//   CHAT_ACCESS: "chat.access",

//   // Full access
//   FULL: "full",
// } as const;

// export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

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

// ========================================
// NEW UNIFIED PERMISSIONS SYSTEM
// ========================================

export const ACCESS_LEVELS = {
  BASIC: "basic" as const,
  ADVANCED: "advanced" as const,
  ADMIN: "admin" as const,
} as const;

export type AccessLevel = (typeof ACCESS_LEVELS)[keyof typeof ACCESS_LEVELS];

/**
 * Check if user has access to a case using the NEW unified system
 * This will gradually replace the old permission functions
 */
export async function checkNewCaseAccess(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  caseId: Id<"cases">,
  requiredLevel: AccessLevel = ACCESS_LEVELS.BASIC,
): Promise<{
  hasAccess: boolean;
  userLevel?: AccessLevel;
  source?: "user" | "team";
}> {
  // Check direct user access first
  const userAccess = await ctx.db
    .query("caseAccess")
    .withIndex("by_case_and_user", (q) =>
      q.eq("caseId", caseId).eq("userId", userId),
    )
    .filter((q) => q.eq(q.field("isActive"), true))
    .first();

  if (userAccess && userAccess.userId) {
    const hasAccess = isAccessLevelSufficient(
      userAccess.accessLevel as AccessLevel,
      requiredLevel,
    );
    return {
      hasAccess,
      userLevel: userAccess.accessLevel as AccessLevel,
      source: "user",
    };
  }

  // Check team access
  const user = await ctx.db.get(userId);
  if (!user) {
    return { hasAccess: false };
  }

  // Get user's teams
  const teamMemberships = await ctx.db
    .query("teamMemberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("isActive"), true))
    .collect();

  // Check each team for case access
  for (const membership of teamMemberships) {
    const teamAccess = await ctx.db
      .query("caseAccess")
      .withIndex("by_case_and_team", (q) =>
        q.eq("caseId", caseId).eq("teamId", membership.teamId),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (teamAccess && teamAccess.teamId) {
      const hasAccess = isAccessLevelSufficient(
        teamAccess.accessLevel as AccessLevel,
        requiredLevel,
      );
      if (hasAccess) {
        return {
          hasAccess: true,
          userLevel: teamAccess.accessLevel as AccessLevel,
          source: "team",
        };
      }
    }
  }

  return { hasAccess: false };
}

/**
 * Require specific access level using NEW system
 * Throws error if user doesn't have sufficient access
 */
export async function requireNewCaseAccess(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  caseId: Id<"cases">,
  requiredLevel: AccessLevel = ACCESS_LEVELS.BASIC,
): Promise<{ userLevel: AccessLevel; source: "user" | "team" }> {
  const accessCheck = await checkNewCaseAccess(
    ctx,
    userId,
    caseId,
    requiredLevel,
  );

  if (!accessCheck.hasAccess) {
    throw new ConvexError({
      code: "INSUFFICIENT_PERMISSIONS",
      message: `Required access level: ${requiredLevel}. User has insufficient permissions for this case.`,
      requiredLevel,
      userLevel: accessCheck.userLevel || "none",
    });
  }

  return {
    userLevel: accessCheck.userLevel!,
    source: accessCheck.source!,
  };
}

/**
 * Get user's current access level for a case using NEW system
 */
export async function getNewAccessLevel(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  caseId: Id<"cases">,
): Promise<{ level: AccessLevel | null; source?: "user" | "team" }> {
  const accessCheck = await checkNewCaseAccess(
    ctx,
    userId,
    caseId,
    ACCESS_LEVELS.BASIC,
  );

  return {
    level: accessCheck.userLevel || null,
    source: accessCheck.source,
  };
}

/**
 * Check if an access level is sufficient for the required level
 * admin > advanced > basic
 */
function isAccessLevelSufficient(
  userLevel: AccessLevel,
  requiredLevel: AccessLevel,
): boolean {
  const levels = {
    [ACCESS_LEVELS.BASIC]: 1,
    [ACCESS_LEVELS.ADVANCED]: 2,
    [ACCESS_LEVELS.ADMIN]: 3,
  };

  return levels[userLevel] >= levels[requiredLevel];
}

/**
 * Grant case access using NEW system
 */
export async function grantNewCaseAccess(
  ctx: MutationCtx,
  grantedBy: Id<"users">,
  caseId: Id<"cases">,
  accessLevel: AccessLevel,
  target: { userId: Id<"users"> } | { teamId: Id<"teams"> },
  options?: {
    expiresAt?: number;
    notes?: string;
  },
): Promise<Id<"caseAccess">> {
  // Verify granter has admin access
  await requireNewCaseAccess(ctx, grantedBy, caseId, ACCESS_LEVELS.ADMIN);

  const accessRecord = {
    caseId,
    userId: "userId" in target ? target.userId : undefined,
    teamId: "teamId" in target ? target.teamId : undefined,
    accessLevel,
    grantedBy,
    grantedAt: Date.now(),
    expiresAt: options?.expiresAt,
    isActive: true,
    notes: options?.notes,
  };

  return await ctx.db.insert("caseAccess", accessRecord);
}
