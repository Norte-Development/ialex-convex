import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
  getCurrentUserFromAuth,
  checkNewCaseAccess,
  requireNewCaseAccess,
  getNewAccessLevel,
  grantNewCaseAccess,
  ACCESS_LEVELS,
} from "../auth_utils";
import { Id } from "../_generated/dataModel";

// ========================================
// TEST DATA CREATION
// ========================================

/**
 * Create test case access records for testing
 */
export const createTestCaseAccess = mutation({
  args: {
    caseId: v.id("cases"),
    userId: v.optional(v.id("users")),
    teamId: v.optional(v.id("teams")),
    accessLevel: v.union(
      v.literal("basic"),
      v.literal("advanced"),
      v.literal("admin"),
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    return await ctx.db.insert("caseAccess", {
      caseId: args.caseId,
      userId: args.userId,
      teamId: args.teamId,
      accessLevel: args.accessLevel,
      grantedBy: currentUser._id,
      grantedAt: Date.now(),
      isActive: true,
      notes: args.notes || `Test access created by ${currentUser.name}`,
    });
  },
});

/**
 * Get all case access records for debugging
 */
export const getAllCaseAccess = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    return await ctx.db.query("caseAccess").collect();
  },
});

/**
 * Clear all test case access records
 */
export const clearTestCaseAccess = mutation({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const allAccess = await ctx.db.query("caseAccess").collect();

    for (const access of allAccess) {
      await ctx.db.delete(access._id);
    }

    return { deleted: allAccess.length };
  },
});

// ========================================
// PERMISSION TESTING FUNCTIONS
// ========================================

/**
 * Test checkNewCaseAccess function
 */
export const testCheckCaseAccess = query({
  args: {
    caseId: v.id("cases"),
    userId: v.optional(v.id("users")),
    requiredLevel: v.optional(
      v.union(v.literal("basic"), v.literal("advanced"), v.literal("admin")),
    ),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const testUserId = args.userId || currentUser._id;
    const requiredLevel = args.requiredLevel || ACCESS_LEVELS.BASIC;

    try {
      const result = await checkNewCaseAccess(
        ctx,
        testUserId,
        args.caseId,
        requiredLevel,
      );

      return {
        success: true,
        result,
        testInfo: {
          testedUserId: testUserId,
          caseId: args.caseId,
          requiredLevel,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error,
        testInfo: {
          testedUserId: testUserId,
          caseId: args.caseId,
          requiredLevel,
        },
      };
    }
  },
});

/**
 * Test requireNewCaseAccess function
 */
export const testRequireCaseAccess = query({
  args: {
    caseId: v.id("cases"),
    userId: v.optional(v.id("users")),
    requiredLevel: v.optional(
      v.union(v.literal("basic"), v.literal("advanced"), v.literal("admin")),
    ),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const testUserId = args.userId || currentUser._id;
    const requiredLevel = args.requiredLevel || ACCESS_LEVELS.BASIC;

    try {
      const result = await requireNewCaseAccess(
        ctx,
        testUserId,
        args.caseId,
        requiredLevel,
      );

      return {
        success: true,
        result,
        testInfo: {
          testedUserId: testUserId,
          caseId: args.caseId,
          requiredLevel,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error,
        testInfo: {
          testedUserId: testUserId,
          caseId: args.caseId,
          requiredLevel,
        },
      };
    }
  },
});

/**
 * Test getNewAccessLevel function
 */
export const testGetAccessLevel = query({
  args: {
    caseId: v.id("cases"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const testUserId = args.userId || currentUser._id;

    try {
      const result = await getNewAccessLevel(ctx, testUserId, args.caseId);

      return {
        success: true,
        result,
        testInfo: {
          testedUserId: testUserId,
          caseId: args.caseId,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error,
        testInfo: {
          testedUserId: testUserId,
          caseId: args.caseId,
        },
      };
    }
  },
});

/**
 * Test grantNewCaseAccess function
 */
export const testGrantCaseAccess = mutation({
  args: {
    caseId: v.id("cases"),
    accessLevel: v.union(
      v.literal("basic"),
      v.literal("advanced"),
      v.literal("admin"),
    ),
    targetUserId: v.optional(v.id("users")),
    targetTeamId: v.optional(v.id("teams")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    if (!args.targetUserId && !args.targetTeamId) {
      return {
        success: false,
        error: "Must specify either targetUserId or targetTeamId",
      };
    }

    try {
      const target = args.targetUserId
        ? { userId: args.targetUserId }
        : { teamId: args.targetTeamId! };

      const accessId = await grantNewCaseAccess(
        ctx,
        currentUser._id,
        args.caseId,
        args.accessLevel,
        target,
        { notes: args.notes },
      );

      return {
        success: true,
        accessId,
        testInfo: {
          grantedBy: currentUser._id,
          caseId: args.caseId,
          accessLevel: args.accessLevel,
          target,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error,
        testInfo: {
          grantedBy: currentUser._id,
          caseId: args.caseId,
          accessLevel: args.accessLevel,
        },
      };
    }
  },
});

// ========================================
// COMPREHENSIVE TEST SCENARIOS
// ========================================

/**
 * Run comprehensive permission tests
 */
export const runPermissionTests = query({
  args: {
    caseId: v.id("cases"),
    testUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const testUserId = args.testUserId || currentUser._id;

    const tests = [];

    // Test 1: Check basic access
    try {
      const basicCheck = await checkNewCaseAccess(
        ctx,
        testUserId,
        args.caseId,
        ACCESS_LEVELS.BASIC,
      );
      tests.push({
        name: "Basic Access Check",
        success: true,
        result: basicCheck,
      });
    } catch (error) {
      tests.push({
        name: "Basic Access Check",
        success: false,
        error: error,
      });
    }

    // Test 2: Check advanced access
    try {
      const advancedCheck = await checkNewCaseAccess(
        ctx,
        testUserId,
        args.caseId,
        ACCESS_LEVELS.ADVANCED,
      );
      tests.push({
        name: "Advanced Access Check",
        success: true,
        result: advancedCheck,
      });
    } catch (error) {
      tests.push({
        name: "Advanced Access Check",
        success: false,
        error: error,
      });
    }

    // Test 3: Check admin access
    try {
      const adminCheck = await checkNewCaseAccess(
        ctx,
        testUserId,
        args.caseId,
        ACCESS_LEVELS.ADMIN,
      );
      tests.push({
        name: "Admin Access Check",
        success: true,
        result: adminCheck,
      });
    } catch (error) {
      tests.push({
        name: "Admin Access Check",
        success: false,
        error: error,
      });
    }

    // Test 4: Get current access level
    try {
      const currentLevel = await getNewAccessLevel(
        ctx,
        testUserId,
        args.caseId,
      );
      tests.push({
        name: "Get Current Access Level",
        success: true,
        result: currentLevel,
      });
    } catch (error) {
      tests.push({
        name: "Get Current Access Level",
        success: false,
        error: error,
      });
    }

    return {
      testUserId,
      caseId: args.caseId,
      timestamp: Date.now(),
      tests,
      summary: {
        total: tests.length,
        passed: tests.filter((t) => t.success).length,
        failed: tests.filter((t) => !t.success).length,
      },
    };
  },
});

/**
 * Get test data for UI
 */
export const getTestData = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Get available cases
    const cases = await ctx.db.query("cases").take(10);

    // Get available users
    const users = await ctx.db.query("users").take(10);

    // Get available teams
    const teams = await ctx.db.query("teams").take(10);

    // Get current case access records
    const caseAccess = await ctx.db.query("caseAccess").take(20);

    return {
      currentUser,
      cases: cases.map((c) => ({
        _id: c._id,
        title: c.title,
        createdBy: c.createdBy,
      })),
      users: users.map((u) => ({ _id: u._id, name: u.name, email: u.email })),
      teams: teams.map((t) => ({
        _id: t._id,
        name: t.name,
        description: t.description,
      })),
      caseAccess,
      accessLevels: Object.values(ACCESS_LEVELS),
    };
  },
});
