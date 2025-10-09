import { QueryCtx, MutationCtx, internalQuery, internalMutation } from "../_generated/server";
import { ToolCtx } from "@convex-dev/agent";
import { ConvexError, v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

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
 * Retrieves the current user ID from authentication.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex context object
 * @returns {Promise<string>} The user's ID
 * @throws {Error} When user is not authenticated
 *
 * @description This function returns the authenticated user's ID without
 * requiring a database lookup. Useful for quick ID checks.
 */
export async function getCurrentUserId(ctx: QueryCtx | MutationCtx) {
  const identity = await requireAuth(ctx);
  return identity.subject;
}

/**
 * Checks if the current user has access to a specific case.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex context object
 * @param {string} caseId - The case document ID
 * @returns {Promise<boolean>} True if user has access, false otherwise
 *
 * @description This function checks if the current authenticated user
 * has permission to access the specified case. It verifies both
 * case existence and user permissions.
 */
export async function checkCaseAccess(ctx: QueryCtx | MutationCtx, caseId: Id<"cases">) {
  const user = await getCurrentUserFromAuth(ctx);

  const caseDoc = await ctx.db.get(caseId);
  if (!caseDoc) {
    return false;
  }

  // Case creator always has access
  if (caseDoc.createdBy === user._id) {
    return true;
  }

  // Assigned lawyer has access
  if (caseDoc.assignedLawyer === user._id) {
    return true;
  }

  // Team members have access through team membership
  const caseTeams = caseDoc.teams || [];
  for (const teamId of caseTeams) {
    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", teamId).eq("userId", user._id)
      )
      .first();

    if (membership) {
      return true;
    }
  }

  return false;
}

/**
 * Ensures the current user has access to a specific case.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex context object
 * @param {string} caseId - The case document ID
 * @returns {Promise<Object>} The case document if access is granted
 * @throws {Error} When user doesn't have access or case doesn't exist
 *
 * @description This function verifies both case existence and user access
 * permissions, throwing an error if either check fails.
 */
export async function requireCaseAccess(ctx: QueryCtx | MutationCtx, caseId: Id<"cases">) {
  const hasAccess = await checkCaseAccess(ctx, caseId);
  if (!hasAccess) {
    throw new Error("Access denied to case");
  }

  const caseDoc = await ctx.db.get(caseId);
  if (!caseDoc) {
    throw new Error("Case not found");
  }

  return caseDoc;
}

/**
 * Checks if the current user has access to create a new case.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex context object
 * @returns {Promise<boolean>} True if user can create cases, false otherwise
 *
 * @description This function checks if the authenticated user has permission
 * to create new cases in the system.
 */
export async function checkNewCaseAccess(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUserFromAuth(ctx);

  // Only lawyers can create cases
  return user.role === "lawyer" || user.role === "admin";
}

/**
 * Ensures the current user can create a new case.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex context object
 * @returns {Promise<Object>} The user document if authorized
 * @throws {Error} When user doesn't have permission to create cases
 *
 * @description This function verifies that the authenticated user has
 * permission to create new cases, throwing an error if not authorized.
 */
export async function requireNewCaseAccess(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUserFromAuth(ctx);

  if (!checkNewCaseAccess(ctx)) {
    throw new Error("Access denied: Only lawyers can create cases");
  }

  return user;
}

/**
 * Checks if the current user has access to a specific team.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex context object
 * @param {string} teamId - The team document ID
 * @returns {Promise<boolean>} True if user has access, false otherwise
 *
 * @description This function checks if the current authenticated user
 * has permission to access the specified team.
 */
export async function checkTeamAccess(ctx: QueryCtx | MutationCtx, teamId: Id<"teams">) {
  const user = await getCurrentUserFromAuth(ctx);

  const membership = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q) =>
      q.eq("teamId", teamId).eq("userId", user._id)
    )
    .first();

  return !!membership;
}

/**
 * Ensures the current user has access to a specific team.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex context object
 * @param {string} teamId - The team document ID
 * @returns {Promise<Object>} The team document if access is granted
 * @throws {Error} When user doesn't have access or team doesn't exist
 *
 * @description This function verifies both team existence and user access
 * permissions, throwing an error if either check fails.
 */
export async function requireTeamAccess(ctx: QueryCtx | MutationCtx, teamId: Id<"teams">) {
  const hasAccess = await checkTeamAccess(ctx, teamId);
  if (!hasAccess) {
    throw new Error("Access denied to team");
  }

  const team = await ctx.db.get(teamId);
  if (!team) {
    throw new Error("Team not found");
  }

  return team;
}

/**
 * Checks if the current user has admin access.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex context object
 * @returns {Promise<boolean>} True if user is an admin, false otherwise
 *
 * @description This function checks if the authenticated user has admin privileges.
 */
export async function checkAdminAccess(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUserFromAuth(ctx);
  return user.role === "admin";
}

/**
 * Ensures the current user has admin access.
 *
 * @param {QueryCtx | MutationCtx} ctx - The Convex context object
 * @returns {Promise<Object>} The user document if authorized
 * @throws {Error} When user doesn't have admin permissions
 *
 * @description This function verifies that the authenticated user has admin
 * privileges, throwing an error if not authorized.
 */
export async function requireAdminAccess(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUserFromAuth(ctx);

  if (!checkAdminAccess(ctx)) {
    throw new Error("Access denied: Admin access required");
  }

  return user;
}

/**
 * Agent context helper for authentication in agent tools.
 *
 * @param {ToolCtx} ctx - The agent tool context
 * @returns {Promise<Object>} The user document if authenticated
 * @throws {Error} When user is not authenticated
 *
 * @description This helper function is used specifically in agent tools
 * to get the current authenticated user. It handles the different context
 * type used by agent tools.
 */
export async function getCurrentUserForAgent(ctx: ToolCtx) {
  // Agent tools use a different auth system - they need to get user from query
  const user = await ctx.runQuery(internal.users.getCurrentUser);
  if (!user) {
    throw new Error("Not authenticated");
  }
  return user;
}

/**
 * Internal query to get current user for agent tools.
 * This is used by agents that need to authenticate users.
 */
export const getCurrentUser = internalQuery({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    return user;
  },
});

/**
 * Internal query to get current user ID for agent tools.
 */
export const getCurrentUserIdInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }

    return identity.subject;
  },
});

/**
 * Internal query to check if current user can create cases.
 */
export const canCreateCases = internalQuery({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return false;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      return false;
    }

    return user.role === "lawyer" || user.role === "admin";
  },
});

/**
 * Internal query to check if current user has access to a case.
 */
export const hasCaseAccess = internalQuery({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return false;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      return false;
    }

    const caseDoc = await ctx.db.get(args.caseId);
    if (!caseDoc) {
      return false;
    }

    // Case creator always has access
    if (caseDoc.createdBy === user._id) {
      return true;
    }

    // Assigned lawyer has access
    if (caseDoc.assignedLawyer === user._id) {
      return true;
    }

    // Team members have access through team membership
    const caseTeams = caseDoc.teams || [];
    for (const teamId of caseTeams) {
      const membership = await ctx.db
        .query("teamMembers")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", teamId).eq("userId", user._id)
        )
        .first();

      if (membership) {
        return true;
      }
    }

    return false;
  },
});

/**
 * Internal mutation to create a user record from Clerk authentication.
 * This is called by the auth webhook when a user signs up.
 */
export const createUserFromAuth = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existingUser) {
      return existingUser;
    }

    // Create new user record
    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      role: "client", // Default role, can be upgraded by admin
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return await ctx.db.get(userId);
  },
});