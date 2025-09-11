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

// ========================================
// SIMPLE TEST FUNCTIONS
// ========================================

/**
 * Create a test case access record
 */
export const createTestAccess = mutation({
  args: {
    caseId: v.id("cases"),
    userId: v.optional(v.id("users")),
    teamId: v.optional(v.id("teams")),
    accessLevel: v.union(
      v.literal("basic"),
      v.literal("advanced"),
      v.literal("admin"),
    ),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const accessId = await ctx.db.insert("caseAccess", {
      caseId: args.caseId,
      userId: args.userId,
      teamId: args.teamId,
      accessLevel: args.accessLevel,
      grantedBy: currentUser._id,
      grantedAt: Date.now(),
      isActive: true,
      notes: `Test access created by ${currentUser.name}`,
    });

    return {
      success: true,
      accessId,
      message: `Created ${args.accessLevel} access for ${args.userId ? "user" : "team"}`,
    };
  },
});

/**
 * Test all permission functions for a case
 */
export const testAllPermissions = query({
  args: {
    caseId: v.id("cases"),
    testUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const userId = args.testUserId || currentUser._id;

    const results = {
      userId,
      caseId: args.caseId,
      timestamp: Date.now(),
      tests: [] as any[],
    };

    // Test 1: Get current access level
    try {
      const currentLevel = await getNewAccessLevel(ctx, userId, args.caseId);
      results.tests.push({
        name: "Get Access Level",
        success: true,
        result: currentLevel,
      });
    } catch (error: any) {
      results.tests.push({
        name: "Get Access Level",
        success: false,
        error: error.message,
      });
    }

    // Test 2: Check basic access
    try {
      const basicCheck = await checkNewCaseAccess(
        ctx,
        userId,
        args.caseId,
        ACCESS_LEVELS.BASIC,
      );
      results.tests.push({
        name: "Check Basic Access",
        success: true,
        result: basicCheck,
      });
    } catch (error: any) {
      results.tests.push({
        name: "Check Basic Access",
        success: false,
        error: error.message,
      });
    }

    // Test 3: Check advanced access
    try {
      const advancedCheck = await checkNewCaseAccess(
        ctx,
        userId,
        args.caseId,
        ACCESS_LEVELS.ADVANCED,
      );
      results.tests.push({
        name: "Check Advanced Access",
        success: true,
        result: advancedCheck,
      });
    } catch (error: any) {
      results.tests.push({
        name: "Check Advanced Access",
        success: false,
        error: error.message,
      });
    }

    // Test 4: Check admin access
    try {
      const adminCheck = await checkNewCaseAccess(
        ctx,
        userId,
        args.caseId,
        ACCESS_LEVELS.ADMIN,
      );
      results.tests.push({
        name: "Check Admin Access",
        success: true,
        result: adminCheck,
      });
    } catch (error: any) {
      results.tests.push({
        name: "Check Admin Access",
        success: false,
        error: error.message,
      });
    }

    // Test 5: Try to require basic access
    try {
      const requireBasic = await requireNewCaseAccess(
        ctx,
        userId,
        args.caseId,
        ACCESS_LEVELS.BASIC,
      );
      results.tests.push({
        name: "Require Basic Access",
        success: true,
        result: requireBasic,
      });
    } catch (error: any) {
      results.tests.push({
        name: "Require Basic Access",
        success: false,
        error: error.message,
      });
    }

    // Test 6: Try to require advanced access
    try {
      const requireAdvanced = await requireNewCaseAccess(
        ctx,
        userId,
        args.caseId,
        ACCESS_LEVELS.ADVANCED,
      );
      results.tests.push({
        name: "Require Advanced Access",
        success: true,
        result: requireAdvanced,
      });
    } catch (error: any) {
      results.tests.push({
        name: "Require Advanced Access",
        success: false,
        error: error.message,
      });
    }

    // Test 7: Try to require admin access
    try {
      const requireAdmin = await requireNewCaseAccess(
        ctx,
        userId,
        args.caseId,
        ACCESS_LEVELS.ADMIN,
      );
      results.tests.push({
        name: "Require Admin Access",
        success: true,
        result: requireAdmin,
      });
    } catch (error: any) {
      results.tests.push({
        name: "Require Admin Access",
        success: false,
        error: error.message,
      });
    }

    return {
      ...results,
      summary: {
        total: results.tests.length,
        passed: results.tests.filter((t) => t.success).length,
        failed: results.tests.filter((t) => !t.success).length,
      },
    };
  },
});

/**
 * Get all current case access records
 */
export const getAllAccess = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const allAccess = await ctx.db.query("caseAccess").collect();

    return {
      currentUser: currentUser.name,
      totalRecords: allAccess.length,
      records: allAccess.map((access) => ({
        _id: access._id,
        caseId: access.caseId,
        userId: access.userId,
        teamId: access.teamId,
        accessLevel: access.accessLevel,
        isActive: access.isActive,
        notes: access.notes,
        grantedAt: new Date(access.grantedAt).toISOString(),
      })),
    };
  },
});

/**
 * Clear all test data
 */
export const clearAllAccess = mutation({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const allAccess = await ctx.db.query("caseAccess").collect();

    for (const access of allAccess) {
      await ctx.db.delete(access._id);
    }

    return {
      success: true,
      deleted: allAccess.length,
      message: `Cleared ${allAccess.length} access records`,
    };
  },
});

/**
 * Get test data (cases, users, teams)
 */
export const getTestData = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const cases = await ctx.db.query("cases").take(5);
    const users = await ctx.db.query("users").take(5);
    const teams = await ctx.db.query("teams").take(5);

    return {
      currentUser: {
        _id: currentUser._id,
        name: currentUser.name,
        email: currentUser.email,
      },
      availableData: {
        cases: cases.map((c) => ({ _id: c._id, title: c.title })),
        users: users.map((u) => ({ _id: u._id, name: u.name, email: u.email })),
        teams: teams.map((t) => ({ _id: t._id, name: t.name })),
      },
      accessLevels: Object.values(ACCESS_LEVELS),
      instructions: {
        step1: "Use createTestAccess to create access records",
        step2: "Use testAllPermissions to test a specific case",
        step3: "Use getAllAccess to see all records",
        step4: "Use clearAllAccess to clean up",
      },
    };
  },
});

// ========================================
// SIMPLE TEST FUNCTIONS (NO AUTH REQUIRED)
// ========================================

/**
 * Get test data without authentication
 */
export const getTestDataNoAuth = query({
  args: {},
  handler: async (ctx) => {
    const cases = await ctx.db.query("cases").take(5);
    const users = await ctx.db.query("users").take(5);
    const teams = await ctx.db.query("teams").take(5);

    return {
      availableData: {
        cases: cases.map((c) => ({ _id: c._id, title: c.title })),
        users: users.map((u) => ({ _id: u._id, name: u.name, email: u.email })),
        teams: teams.map((t) => ({ _id: t._id, name: t.name })),
      },
      accessLevels: Object.values(ACCESS_LEVELS),
      instructions: {
        step1: "Use createTestAccessNoAuth to create access records",
        step2: "Use testAllPermissionsNoAuth to test a specific case",
        step3: "Use getAllAccessNoAuth to see all records",
        step4: "Use clearAllAccessNoAuth to clean up",
      },
    };
  },
});

/**
 * Create test access without authentication
 */
export const createTestAccessNoAuth = mutation({
  args: {
    caseId: v.id("cases"),
    userId: v.optional(v.id("users")),
    teamId: v.optional(v.id("teams")),
    accessLevel: v.union(
      v.literal("basic"),
      v.literal("advanced"),
      v.literal("admin"),
    ),
    grantedByUserId: v.id("users"), // Manual user ID since no auth
  },
  handler: async (ctx, args) => {
    const accessId = await ctx.db.insert("caseAccess", {
      caseId: args.caseId,
      userId: args.userId,
      teamId: args.teamId,
      accessLevel: args.accessLevel,
      grantedBy: args.grantedByUserId,
      grantedAt: Date.now(),
      isActive: true,
      notes: `Test access created without auth`,
    });

    return {
      success: true,
      accessId,
      message: `Created ${args.accessLevel} access for ${args.userId ? "user" : "team"}`,
    };
  },
});

/**
 * Test all permissions without authentication
 */
export const testAllPermissionsNoAuth = query({
  args: {
    caseId: v.id("cases"),
    testUserId: v.id("users"), // Required since no auth
  },
  handler: async (ctx, args) => {
    const results = {
      userId: args.testUserId,
      caseId: args.caseId,
      timestamp: Date.now(),
      tests: [] as any[],
    };

    // Test 1: Get current access level
    try {
      const currentLevel = await getNewAccessLevel(
        ctx,
        args.testUserId,
        args.caseId,
      );
      results.tests.push({
        name: "Get Access Level",
        success: true,
        result: currentLevel,
      });
    } catch (error: any) {
      results.tests.push({
        name: "Get Access Level",
        success: false,
        error: error.message,
      });
    }

    // Test 2: Check basic access
    try {
      const basicCheck = await checkNewCaseAccess(
        ctx,
        args.testUserId,
        args.caseId,
        ACCESS_LEVELS.BASIC,
      );
      results.tests.push({
        name: "Check Basic Access",
        success: true,
        result: basicCheck,
      });
    } catch (error: any) {
      results.tests.push({
        name: "Check Basic Access",
        success: false,
        error: error.message,
      });
    }

    // Test 3: Check advanced access
    try {
      const advancedCheck = await checkNewCaseAccess(
        ctx,
        args.testUserId,
        args.caseId,
        ACCESS_LEVELS.ADVANCED,
      );
      results.tests.push({
        name: "Check Advanced Access",
        success: true,
        result: advancedCheck,
      });
    } catch (error: any) {
      results.tests.push({
        name: "Check Advanced Access",
        success: false,
        error: error.message,
      });
    }

    // Test 4: Check admin access
    try {
      const adminCheck = await checkNewCaseAccess(
        ctx,
        args.testUserId,
        args.caseId,
        ACCESS_LEVELS.ADMIN,
      );
      results.tests.push({
        name: "Check Admin Access",
        success: true,
        result: adminCheck,
      });
    } catch (error: any) {
      results.tests.push({
        name: "Check Admin Access",
        success: false,
        error: error.message,
      });
    }

    // Test 5: Try to require basic access
    try {
      const requireBasic = await requireNewCaseAccess(
        ctx,
        args.testUserId,
        args.caseId,
        ACCESS_LEVELS.BASIC,
      );
      results.tests.push({
        name: "Require Basic Access",
        success: true,
        result: requireBasic,
      });
    } catch (error: any) {
      results.tests.push({
        name: "Require Basic Access",
        success: false,
        error: error.message,
      });
    }

    // Test 6: Try to require advanced access
    try {
      const requireAdvanced = await requireNewCaseAccess(
        ctx,
        args.testUserId,
        args.caseId,
        ACCESS_LEVELS.ADVANCED,
      );
      results.tests.push({
        name: "Require Advanced Access",
        success: true,
        result: requireAdvanced,
      });
    } catch (error: any) {
      results.tests.push({
        name: "Require Advanced Access",
        success: false,
        error: error.message,
      });
    }

    // Test 7: Try to require admin access
    try {
      const requireAdmin = await requireNewCaseAccess(
        ctx,
        args.testUserId,
        args.caseId,
        ACCESS_LEVELS.ADMIN,
      );
      results.tests.push({
        name: "Require Admin Access",
        success: true,
        result: requireAdmin,
      });
    } catch (error: any) {
      results.tests.push({
        name: "Require Admin Access",
        success: false,
        error: error.message,
      });
    }

    return {
      ...results,
      summary: {
        total: results.tests.length,
        passed: results.tests.filter((t) => t.success).length,
        failed: results.tests.filter((t) => !t.success).length,
      },
    };
  },
});

/**
 * Get all access records without authentication
 */
export const getAllAccessNoAuth = query({
  args: {},
  handler: async (ctx) => {
    const allAccess = await ctx.db.query("caseAccess").collect();

    return {
      totalRecords: allAccess.length,
      records: allAccess.map((access) => ({
        _id: access._id,
        caseId: access.caseId,
        userId: access.userId,
        teamId: access.teamId,
        accessLevel: access.accessLevel,
        isActive: access.isActive,
        notes: access.notes,
        grantedAt: new Date(access.grantedAt).toISOString(),
      })),
    };
  },
});

/**
 * Clear all access records without authentication
 */
export const clearAllAccessNoAuth = mutation({
  args: {},
  handler: async (ctx) => {
    const allAccess = await ctx.db.query("caseAccess").collect();

    for (const access of allAccess) {
      await ctx.db.delete(access._id);
    }

    return {
      success: true,
      deleted: allAccess.length,
      message: `Cleared ${allAccess.length} access records`,
    };
  },
});
