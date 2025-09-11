import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { checkNewCaseAccess, getCurrentUserFromAuth } from "../auth_utils";

// ============================================================================
// SIMPLE PERMISSIONS TESTING FUNCTIONS
// ============================================================================

/**
 * Test grantUserCaseAccess - Simple version
 */
export const testGrantAccess = mutation({
  args: {
    caseId: v.id("cases"),
    userId: v.id("users"),
    accessLevel: v.union(
      v.literal("basic"),
      v.literal("advanced"),
      v.literal("admin"),
    ),
  },
  handler: async (ctx, args) => {
    try {
      const currentUser = await getCurrentUserFromAuth(ctx);

      // Grant access directly
      const accessId = await ctx.db.insert("caseAccess", {
        caseId: args.caseId,
        userId: args.userId,
        accessLevel: args.accessLevel,
        grantedBy: currentUser._id,
        grantedAt: Date.now(),
        isActive: true,
      });

      return {
        success: true,
        message: `✅ Access granted: ${args.accessLevel} level to user ${args.userId}`,
        accessId,
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ Failed to grant access: ${error}`,
      };
    }
  },
});

/**
 * Test revokeUserCaseAccess - Simple version
 */
export const testRevokeAccess = mutation({
  args: {
    caseId: v.id("cases"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    try {
      const access = await ctx.db
        .query("caseAccess")
        .withIndex("by_case_and_user", (q) =>
          q.eq("caseId", args.caseId).eq("userId", args.userId),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      if (access) {
        await ctx.db.patch(access._id, { isActive: false });
        return {
          success: true,
          message: `✅ Access revoked for user ${args.userId}`,
        };
      } else {
        return {
          success: false,
          message: `ℹ️ No active access found for user ${args.userId}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `❌ Failed to revoke access: ${error}`,
      };
    }
  },
});

/**
 * Test checkNewCaseAccess function
 */
export const testCheckAccess = query({
  args: {
    caseId: v.id("cases"),
    userId: v.id("users"),
    requiredLevel: v.union(
      v.literal("basic"),
      v.literal("advanced"),
      v.literal("admin"),
    ),
  },
  handler: async (ctx, args) => {
    try {
      const access = await checkNewCaseAccess(
        ctx,
        args.userId,
        args.caseId,
        args.requiredLevel,
      );

      return {
        success: true,
        hasAccess: access.hasAccess,
        userLevel: access.userLevel,
        source: access.source,
        message: `✅ Access check: ${access.hasAccess ? "GRANTED" : "DENIED"} - Level: ${access.userLevel || "none"} - Source: ${access.source || "none"}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ Access check failed: ${error}`,
      };
    }
  },
});

/**
 * List all users with access to a case
 */
export const listUsersWithAccess = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    try {
      const userAccesses = await ctx.db
        .query("caseAccess")
        .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .filter((q) => q.neq(q.field("userId"), undefined))
        .collect();

      const usersWithAccess = [];
      for (const access of userAccesses) {
        if (access.userId) {
          const user = await ctx.db.get(access.userId);
          if (user) {
            usersWithAccess.push({
              userId: user._id,
              email: user.email,
              name: user.name,
              accessLevel: access.accessLevel,
              grantedAt: access.grantedAt,
            });
          }
        }
      }

      return {
        success: true,
        count: usersWithAccess.length,
        users: usersWithAccess,
        message: `✅ Found ${usersWithAccess.length} users with access`,
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ Failed to list users: ${error}`,
      };
    }
  },
});

/**
 * Inspect caseAccess table data
 */
export const inspectCaseAccess = query({
  args: {
    caseId: v.optional(v.id("cases")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    try {
      const limit = args.limit || 10;

      const accessRecords = args.caseId
        ? await ctx.db
            .query("caseAccess")
            .withIndex("by_case", (q) => q.eq("caseId", args.caseId!))
            .take(limit)
        : await ctx.db.query("caseAccess").take(limit);

      const enrichedRecords = [];
      for (const access of accessRecords) {
        const user = access.userId ? await ctx.db.get(access.userId) : null;
        const caseData = await ctx.db.get(access.caseId);

        enrichedRecords.push({
          accessId: access._id,
          caseId: access.caseId,
          caseTitle: caseData?.title || "N/A",
          userId: access.userId,
          userEmail: user?.email || "N/A",
          accessLevel: access.accessLevel,
          isActive: access.isActive,
          grantedAt: access.grantedAt,
        });
      }

      return {
        success: true,
        total: accessRecords.length,
        records: enrichedRecords,
        message: `✅ Found ${accessRecords.length} access records`,
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ Failed to inspect data: ${error}`,
      };
    }
  },
});

/**
 * Get all cases (for testing)
 */
export const getAllCases = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    try {
      const limit = args.limit || 10;
      const cases = await ctx.db.query("cases").take(limit);

      return {
        success: true,
        cases: cases.map((c) => ({
          id: c._id,
          title: c.title,
          status: c.status,
        })),
        message: `✅ Found ${cases.length} cases`,
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ Failed to get cases: ${error}`,
      };
    }
  },
});

/**
 * Get all users (for testing)
 */
export const getAllUsers = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    try {
      const limit = args.limit || 10;
      const users = await ctx.db.query("users").take(limit);

      return {
        success: true,
        users: users.map((u) => ({
          id: u._id,
          email: u.email,
          name: u.name,
          role: u.role,
        })),
        message: `✅ Found ${users.length} users`,
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ Failed to get users: ${error}`,
      };
    }
  },
});
