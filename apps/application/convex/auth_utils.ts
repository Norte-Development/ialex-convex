import {
  QueryCtx,
  MutationCtx,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { ToolCtx } from "@convex-dev/agent";
import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

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
// Admin organization guard (Clerk)
// ========================================

export const ADMINS_ORG_SLUG = "admins" as const;

/**
 * Requires that the authenticated Clerk session has the active organization set
 * to the `admins` org (by slug).
 *
 * Note: This relies on Clerk JWT template claims including `org_slug`.
 */
export async function requireAdminsOrg(ctx: QueryCtx | MutationCtx) {
  const identity = await requireAuth(ctx);
  const claims = (identity as any).claims ?? {};

  const orgSlug: string | undefined =
    claims.org_slug ??
    claims.orgSlug ??
    claims.organization_slug ??
    claims.organizationSlug ??
    claims.org?.slug ??
    claims.organization?.slug;

  if (orgSlug !== ADMINS_ORG_SLUG) {
    throw new ConvexError({
      code: "ADMIN_ORG_REQUIRED",
      message: `This operation requires the '${ADMINS_ORG_SLUG}' organization.`,
      orgSlug: orgSlug ?? null,
    });
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

// ----------------------------------------
// Runtime type guards for context features
// ----------------------------------------
function hasDb(
  ctx: QueryCtx | MutationCtx | ToolCtx,
): ctx is QueryCtx | MutationCtx {
  return (ctx as any).db !== undefined;
}

function hasRunQuery(ctx: QueryCtx | MutationCtx | ToolCtx): ctx is ToolCtx {
  return typeof (ctx as any).runQuery === "function";
}

// Note: we intentionally omit a hasRunMutation guard here since write helpers
// in this file accept MutationCtx. For ToolCtx, use the exported internal mutations.

/**
 * Check if user has access to a case using the NEW unified system
 * This will gradually replace the old permission functions
 */
export async function checkNewCaseAccess(
  ctx: QueryCtx | MutationCtx | ToolCtx,
  userId: Id<"users">,
  caseId: Id<"cases">,
  requiredLevel: AccessLevel = ACCESS_LEVELS.BASIC,
): Promise<{
  hasAccess: boolean;
  userLevel?: AccessLevel;
  source?: "user" | "team";
}> {
  if (!hasDb(ctx)) {
    if (hasRunQuery(ctx)) {
      return await ctx.runQuery(
        internal.auth_utils.internalCheckNewCaseAccess,
        {
          userId,
          caseId,
          requiredLevel,
        },
      );
    }
    throw new Error("checkNewCaseAccess requires database or runQuery context");
  }

  // Check direct user access first
  const userAccess = await ctx.db
    .query("caseAccess")
    .withIndex("by_case_and_user", (q) =>
      q.eq("caseId", caseId).eq("userId", userId),
    )
    .filter((q) => q.eq(q.field("isActive"), true))
    .filter((q) =>
      q.or(
        q.eq(q.field("expiresAt"), undefined),
        q.gt(q.field("expiresAt"), Date.now()),
      ),
    )
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
      .filter((q) =>
        q.or(
          q.eq(q.field("expiresAt"), undefined),
          q.gt(q.field("expiresAt"), Date.now()),
        ),
      )
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
  ctx: QueryCtx | MutationCtx | ToolCtx,
  userId: Id<"users">,
  caseId: Id<"cases">,
  requiredLevel: AccessLevel = ACCESS_LEVELS.BASIC,
): Promise<{ userLevel: AccessLevel; source: "user" | "team" }> {
  if (!hasDb(ctx)) {
    if (hasRunQuery(ctx)) {
      return await ctx.runQuery(
        internal.auth_utils.internalRequireNewCaseAccess,
        {
          userId,
          caseId,
          requiredLevel,
        },
      );
    }
    throw new Error(
      "requireNewCaseAccess requires database or runQuery context",
    );
  }

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
  ctx: QueryCtx | MutationCtx | ToolCtx,
  userId: Id<"users">,
  caseId: Id<"cases">,
): Promise<{ level: AccessLevel | null; source?: "user" | "team" }> {
  if (!hasDb(ctx)) {
    if (hasRunQuery(ctx)) {
      return await ctx.runQuery(internal.auth_utils.internalGetNewAccessLevel, {
        userId,
        caseId,
      });
    }
    throw new Error("getNewAccessLevel requires database or runQuery context");
  }

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

// ========================================
// Internal Convex functions for action-safe usage
// ========================================

export const internalCheckNewCaseAccess = internalQuery({
  args: {
    userId: v.id("users"),
    caseId: v.id("cases"),
    requiredLevel: v.union(
      v.literal("basic"),
      v.literal("advanced"),
      v.literal("admin"),
    ),
  },
  returns: v.object({
    hasAccess: v.boolean(),
    userLevel: v.optional(
      v.union(v.literal("basic"), v.literal("advanced"), v.literal("admin")),
    ),
    source: v.optional(v.union(v.literal("user"), v.literal("team"))),
  }),
  handler: async (ctx, args) => {
    const { userId, caseId, requiredLevel } = args;
    // Direct user access
    const userAccess = await ctx.db
      .query("caseAccess")
      .withIndex("by_case_and_user", (q) =>
        q.eq("caseId", caseId).eq("userId", userId),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .filter((q) =>
        q.or(
          q.eq(q.field("expiresAt"), undefined),
          q.gt(q.field("expiresAt"), Date.now()),
        ),
      )
      .first();

    if (userAccess && userAccess.userId) {
      const hasAccess = isAccessLevelSufficient(
        userAccess.accessLevel as AccessLevel,
        requiredLevel as AccessLevel,
      );
      return {
        hasAccess,
        userLevel: userAccess.accessLevel as AccessLevel,
        source: "user" as const,
      };
    }

    // Team-based access
    const user = await ctx.db.get(userId);
    if (!user) {
      return { hasAccess: false } as const;
    }

    const teamMemberships = await ctx.db
      .query("teamMemberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    for (const membership of teamMemberships) {
      const teamAccess = await ctx.db
        .query("caseAccess")
        .withIndex("by_case_and_team", (q) =>
          q.eq("caseId", caseId).eq("teamId", membership.teamId),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .filter((q) =>
          q.or(
            q.eq(q.field("expiresAt"), undefined),
            q.gt(q.field("expiresAt"), Date.now()),
          ),
        )
        .first();

      if (teamAccess && teamAccess.teamId) {
        const hasAccess = isAccessLevelSufficient(
          teamAccess.accessLevel as AccessLevel,
          requiredLevel as AccessLevel,
        );
        if (hasAccess) {
          return {
            hasAccess: true,
            userLevel: teamAccess.accessLevel as AccessLevel,
            source: "team" as const,
          } as const;
        }
      }
    }

    return { hasAccess: false } as const;
  },
});

export const internalRequireNewCaseAccess = internalQuery({
  args: {
    userId: v.id("users"),
    caseId: v.id("cases"),
    requiredLevel: v.union(
      v.literal("basic"),
      v.literal("advanced"),
      v.literal("admin"),
    ),
  },
  returns: v.object({
    userLevel: v.union(
      v.literal("basic"),
      v.literal("advanced"),
      v.literal("admin"),
    ),
    source: v.union(v.literal("user"), v.literal("team")),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ userLevel: AccessLevel; source: "user" | "team" }> => {
    const res: {
      hasAccess: boolean;
      userLevel?: AccessLevel;
      source?: "user" | "team";
    } = await ctx.runQuery(
      internal.auth_utils.internalCheckNewCaseAccess,
      args,
    );
    if (!res.hasAccess || !res.userLevel || !res.source) {
      throw new ConvexError({
        code: "INSUFFICIENT_PERMISSIONS",
        message: `Required access level: ${args.requiredLevel}. User has insufficient permissions for this case.`,
        requiredLevel: args.requiredLevel,
        userLevel: (res.userLevel as any) || "none",
      });
    }
    return { userLevel: res.userLevel, source: res.source } as const;
  },
});

export const internalGetNewAccessLevel = internalQuery({
  args: {
    userId: v.id("users"),
    caseId: v.id("cases"),
  },
  returns: v.object({
    level: v.union(
      v.literal("basic"),
      v.literal("advanced"),
      v.literal("admin"),
      v.null(),
    ),
    source: v.optional(v.union(v.literal("user"), v.literal("team"))),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ level: AccessLevel | null; source?: "user" | "team" }> => {
    const res: {
      hasAccess: boolean;
      userLevel?: AccessLevel;
      source?: "user" | "team";
    } = await ctx.runQuery(internal.auth_utils.internalCheckNewCaseAccess, {
      ...args,
      requiredLevel: "basic",
    });
    return {
      level: (res.userLevel as AccessLevel | undefined) ?? null,
      source: res.source,
    } as const;
  },
});

export const internalGrantNewCaseAccess = internalMutation({
  args: {
    grantedBy: v.id("users"),
    caseId: v.id("cases"),
    accessLevel: v.union(
      v.literal("basic"),
      v.literal("advanced"),
      v.literal("admin"),
    ),
    target: v.union(
      v.object({ userId: v.id("users") }),
      v.object({ teamId: v.id("teams") }),
    ),
    options: v.object({
      expiresAt: v.optional(v.number()),
      notes: v.optional(v.string()),
    }),
  },
  returns: v.id("caseAccess"),
  handler: async (ctx, args) => {
    const { grantedBy, caseId, accessLevel, target, options } = args;

    const res = await ctx.runQuery(
      internal.auth_utils.internalRequireNewCaseAccess,
      {
        userId: grantedBy,
        caseId,
        requiredLevel: "admin",
      },
    );
    if (!res?.userLevel) {
      throw new ConvexError({
        code: "INSUFFICIENT_PERMISSIONS",
        message: "Admin access required",
      });
    }

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
    } as const;

    const id = await ctx.db.insert("caseAccess", accessRecord);
    return id;
  },
});

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
  // In action contexts, call the internal mutation from the action instead of this helper.
  // This helper requires a real MutationCtx and a database.
  if (!hasDb(ctx)) {
    throw new Error(
      "grantNewCaseAccess requires a MutationCtx with database access",
    );
  }

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
