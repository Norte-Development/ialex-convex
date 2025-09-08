import { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import { ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";

// Frontend permission constants for type safety
export const PERMISSIONS = {
  // Case-level permissions
  CASE_VIEW: "case.view",
  CASE_EDIT: "case.edit",
  CASE_DELETE: "case.delete",

  // Document permissions
  DOC_READ: "documents.read",
  DOC_WRITE: "documents.write",
  DOC_DELETE: "documents.delete",

  // Escrito permissions
  ESCRITO_READ: "escritos.read",
  ESCRITO_WRITE: "escritos.write",
  ESCRITO_DELETE: "escritos.delete",

  // Client permissions
  CLIENT_READ: "clients.read",
  CLIENT_WRITE: "clients.write",
  CLIENT_DELETE: "clients.delete",

  // Team permissions
  TEAM_READ: "teams.read",
  TEAM_WRITE: "teams.write",

  // Chat permissions
  CHAT_ACCESS: "chat.access",

  // Full access
  FULL: "full",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

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
 * - Individual user access: Specific permissions granted to the user
 * - Team member access: Granular permissions for team members on specific cases
 * - General team access: Inherited through team membership
 *
 * @example
 * ```javascript
 * const access = await checkCaseAccess(ctx, caseId, userId);
 * if (access.hasAccess) {
 *   console.log(`User has ${access.accessLevel} access via ${access.source}`);
 * }
 * ```
 */
export async function checkCaseAccess(
  ctx: QueryCtx | MutationCtx,
  caseId: string,
  userId: string,
) {
  // Check if case exists
  const caseData = await ctx.db.get(caseId as any);
  if (!caseData) {
    throw new Error("Case not found");
  }

  // Type assertion - we know this is a case
  const caseRecord = caseData as any;

  // Check direct access (assigned lawyer or case creator)
  if (caseRecord.assignedLawyer === userId || caseRecord.createdBy === userId) {
    return {
      hasAccess: true,
      accessLevel: "full",
      source: "direct",
      permissions: [PERMISSIONS.FULL],
    };
  }

  // Check individual user access
  const userAccess = await ctx.db
    .query("userCaseAccess")
    .withIndex("by_user_and_case", (q) =>
      q.eq("userId", userId as any).eq("caseId", caseId as any),
    )
    .filter((q) => q.eq(q.field("isActive"), true))
    .filter((q) =>
      q.or(
        q.eq(q.field("expiresAt"), undefined),
        q.gt(q.field("expiresAt"), Date.now()),
      ),
    )
    .first();

  if (userAccess) {
    const hasFullAccess = userAccess.permissions.includes(PERMISSIONS.FULL);
    return {
      hasAccess: true,
      accessLevel: hasFullAccess ? "full" : "read",
      source: "user",
      permissions: userAccess.permissions,
    };
  }

  // Check team member specific access
  const userMemberships = await ctx.db
    .query("teamMemberships")
    .withIndex("by_user", (q) => q.eq("userId", userId as any))
    .filter((q) => q.eq(q.field("isActive"), true))
    .collect();

  for (const membership of userMemberships) {
    // First check if user has specific permissions as team member
    const teamMemberAccess = await ctx.db
      .query("teamMemberCaseAccess")
      .withIndex("by_team_user_case", (q) =>
        q
          .eq("teamId", membership.teamId)
          .eq("userId", userId as any)
          .eq("caseId", caseId as any),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .filter((q) =>
        q.or(
          q.eq(q.field("expiresAt"), undefined),
          q.gt(q.field("expiresAt"), Date.now()),
        ),
      )
      .first();

    if (teamMemberAccess) {
      const hasFullAccess = teamMemberAccess.permissions.includes(
        PERMISSIONS.FULL,
      );
      return {
        hasAccess: true,
        accessLevel: hasFullAccess ? "full" : "read",
        source: "team-member",
        teamId: membership.teamId,
        permissions: teamMemberAccess.permissions,
      };
    }

    // Fallback to general team access
    const teamAccess = await ctx.db
      .query("teamCaseAccess")
      .withIndex("by_case_and_team", (q) =>
        q.eq("caseId", caseId as any).eq("teamId", membership.teamId),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (teamAccess) {
      // Map team access level to granular permissions
      const permissions =
        teamAccess.accessLevel === "full"
          ? [PERMISSIONS.FULL]
          : [
              PERMISSIONS.CASE_VIEW,
              PERMISSIONS.DOC_READ,
              PERMISSIONS.ESCRITO_READ,
              PERMISSIONS.CLIENT_READ,
              PERMISSIONS.TEAM_READ,
              PERMISSIONS.CHAT_ACCESS,
            ];

      return {
        hasAccess: true,
        accessLevel: teamAccess.accessLevel,
        source: "team",
        teamId: membership.teamId,
        permissions: permissions,
      };
    }
  }

  return { hasAccess: false, accessLevel: null, permissions: [] };
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
export async function requireCaseAccess(
  ctx: QueryCtx | MutationCtx,
  caseId: string,
  requiredLevel: "read" | "full" = "read",
) {
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

// ========================================
// GRANULAR PERMISSION HELPERS
// ========================================

/**
 * Checks if a user has a specific permission for a case.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex context object
 * @param {string} caseId - The ID of the case to check permission for
 * @param {string} userId - The ID of the user to check permission for
 * @param {Permission} permission - The specific permission to check
 * @returns {Promise<boolean>} Whether the user has the permission
 */
export async function hasPermission(
  ctx: QueryCtx | MutationCtx,
  caseId: string,
  userId: string,
  permission: Permission,
): Promise<boolean> {
  const access = await checkCaseAccess(ctx, caseId, userId);

  if (!access.hasAccess) return false;

  const permissions = access.permissions as string[];
  return (
    permissions.includes(PERMISSIONS.FULL) || permissions.includes(permission)
  );
}

/**
 * Requires that the current user has a specific permission for a case.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex context object
 * @param {string} caseId - The ID of the case to check permission for
 * @param {Permission} permission - The specific permission to require
 * @returns {Promise<Object>} Object containing currentUser and access information
 * @throws {Error} When user lacks the required permission
 */
export async function requirePermission(
  ctx: QueryCtx | MutationCtx,
  caseId: string,
  permission: Permission,
) {
  const currentUser = await getCurrentUserFromAuth(ctx);
  const hasAccess = await hasPermission(
    ctx,
    caseId,
    currentUser._id,
    permission,
  );

  if (!hasAccess) {
    throw new Error(
      `Unauthorized: ${permission} permission required for this operation`,
    );
  }

  const access = await checkCaseAccess(ctx, caseId, currentUser._id);
  return { currentUser, access };
}

/**
 * Checks if a user has any of the specified permissions for a case.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex context object
 * @param {string} caseId - The ID of the case to check permissions for
 * @param {string} userId - The ID of the user to check permissions for
 * @param {Permission[]} permissions - The permissions to check (user needs at least one)
 * @returns {Promise<boolean>} Whether the user has any of the permissions
 */
export async function hasAnyPermission(
  ctx: QueryCtx | MutationCtx,
  caseId: string,
  userId: string,
  permissions: Permission[],
): Promise<boolean> {
  const access = await checkCaseAccess(ctx, caseId, userId);

  if (!access.hasAccess) return false;

  const userPermissions = access.permissions as string[];
  if (userPermissions.includes(PERMISSIONS.FULL)) return true;

  return permissions.some((permission) => userPermissions.includes(permission));
}

/**
 * Requires that the current user has any of the specified permissions for a case.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex context object
 * @param {string} caseId - The ID of the case to check permissions for
 * @param {Permission[]} permissions - The permissions to check (user needs at least one)
 * @returns {Promise<Object>} Object containing currentUser and access information
 * @throws {Error} When user lacks any of the required permissions
 */
export async function requireAnyPermission(
  ctx: QueryCtx | MutationCtx,
  caseId: string,
  permissions: Permission[],
) {
  const currentUser = await getCurrentUserFromAuth(ctx);
  const hasAccess = await hasAnyPermission(
    ctx,
    caseId,
    currentUser._id,
    permissions,
  );

  if (!hasAccess) {
    const permissionList = permissions.join(" or ");
    throw new Error(
      `Unauthorized: One of these permissions required: ${permissionList}`,
    );
  }

  const access = await checkCaseAccess(ctx, caseId, currentUser._id);
  return { currentUser, access };
}

// ========================================
// RESOURCE-SPECIFIC PERMISSION HELPERS
// ========================================

/**
 * Checks if a user has document permission for a case.
 */
export async function hasDocumentPermission(
  ctx: QueryCtx | MutationCtx,
  caseId: string,
  userId: string,
  operation: "read" | "write" | "delete",
): Promise<boolean> {
  const permissionMap = {
    read: PERMISSIONS.DOC_READ,
    write: PERMISSIONS.DOC_WRITE,
    delete: PERMISSIONS.DOC_DELETE,
  };
  return hasPermission(ctx, caseId, userId, permissionMap[operation]);
}

/**
 * Requires document permission for the current user.
 */
export async function requireDocumentPermission(
  ctx: QueryCtx | MutationCtx,
  caseId: string,
  operation: "read" | "write" | "delete",
) {
  const permissionMap = {
    read: PERMISSIONS.DOC_READ,
    write: PERMISSIONS.DOC_WRITE,
    delete: PERMISSIONS.DOC_DELETE,
  };
  return requirePermission(ctx, caseId, permissionMap[operation]);
}

/**
 * Checks if a user has escrito permission for a case.
 */
export async function hasEscritoPermission(
  ctx: QueryCtx | MutationCtx,
  caseId: string,
  userId: string,
  operation: "read" | "write" | "delete",
): Promise<boolean> {
  const permissionMap = {
    read: PERMISSIONS.ESCRITO_READ,
    write: PERMISSIONS.ESCRITO_WRITE,
    delete: PERMISSIONS.ESCRITO_DELETE,
  };
  return hasPermission(ctx, caseId, userId, permissionMap[operation]);
}

/**
 * Requires escrito permission for the current user.
 */
export async function requireEscritoPermission(
  ctx: QueryCtx | MutationCtx,
  caseId: string,
  operation: "read" | "write" | "delete",
) {
  const permissionMap = {
    read: PERMISSIONS.ESCRITO_READ,
    write: PERMISSIONS.ESCRITO_WRITE,
    delete: PERMISSIONS.ESCRITO_DELETE,
  };
  return requirePermission(ctx, caseId, permissionMap[operation]);
}

/**
 * Checks if a user has client permission for a case.
 */
export async function hasClientPermission(
  ctx: QueryCtx | MutationCtx,
  caseId: string,
  userId: string,
  operation: "read" | "write" | "delete",
): Promise<boolean> {
  const permissionMap = {
    read: PERMISSIONS.CLIENT_READ,
    write: PERMISSIONS.CLIENT_WRITE,
    delete: PERMISSIONS.CLIENT_DELETE,
  };
  return hasPermission(ctx, caseId, userId, permissionMap[operation]);
}

/**
 * Requires client permission for the current user.
 */
export async function requireClientPermission(
  ctx: QueryCtx | MutationCtx,
  caseId: string,
  operation: "read" | "write" | "delete",
) {
  const permissionMap = {
    read: PERMISSIONS.CLIENT_READ,
    write: PERMISSIONS.CLIENT_WRITE,
    delete: PERMISSIONS.CLIENT_DELETE,
  };
  return requirePermission(ctx, caseId, permissionMap[operation]);
}

/**
 * Checks if a user has team permission for a case.
 */
export async function hasTeamPermission(
  ctx: QueryCtx | MutationCtx,
  caseId: string,
  userId: string,
  operation: "read" | "write",
): Promise<boolean> {
  const permissionMap = {
    read: PERMISSIONS.TEAM_READ,
    write: PERMISSIONS.TEAM_WRITE,
  };
  return hasPermission(ctx, caseId, userId, permissionMap[operation]);
}

/**
 * Requires team permission for the current user.
 */
export async function requireTeamPermission(
  ctx: QueryCtx | MutationCtx,
  caseId: string,
  operation: "read" | "write",
) {
  const permissionMap = {
    read: PERMISSIONS.TEAM_READ,
    write: PERMISSIONS.TEAM_WRITE,
  };
  return requirePermission(ctx, caseId, permissionMap[operation]);
}

/**
 * Checks if a user has chat permission for a case.
 */
export async function hasChatPermission(
  ctx: QueryCtx | MutationCtx,
  caseId: string,
  userId: string,
): Promise<boolean> {
  return hasPermission(ctx, caseId, userId, PERMISSIONS.CHAT_ACCESS);
}

/**
 * Requires chat permission for the current user.
 */
export async function requireChatPermission(
  ctx: QueryCtx | MutationCtx,
  caseId: string,
) {
  return requirePermission(ctx, caseId, PERMISSIONS.CHAT_ACCESS);
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
