import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
  getCurrentUserFromAuth,
  checkNewCaseAccess,
  requireNewCaseAccess,
  getNewAccessLevel,
  grantNewCaseAccess,
  ACCESS_LEVELS,
  AccessLevel,
} from "../auth_utils";

// ========================================
// COMPREHENSIVE PERMISSIONS TESTING SUITE
// ========================================

/**
 * Complete testing suite for the new permissions system
 */
export const runCompletePermissionsTest = query({
  args: {
    caseId: v.id("cases"),
    testUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const testUserId = args.testUserId || currentUser._id;

    const results = {
      testInfo: {
        testUserId,
        caseId: args.caseId,
        timestamp: Date.now(),
        testerUser: currentUser.name,
      },
      tests: [] as any[],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        errors: [] as string[],
      },
    };

    // Test 1: Verificar acceso actual
    try {
      const currentAccess = await getNewAccessLevel(
        ctx,
        testUserId,
        args.caseId,
      );
      results.tests.push({
        testNumber: 1,
        testName: "Get Current Access Level",
        status: "PASSED",
        result: currentAccess,
        description: "Obtiene el nivel de acceso actual del usuario",
      });
    } catch (error: any) {
      results.tests.push({
        testNumber: 1,
        testName: "Get Current Access Level",
        status: "FAILED",
        error: error.message,
        description: "Obtiene el nivel de acceso actual del usuario",
      });
      results.summary.errors.push(`Test 1: ${error.message}`);
    }

    // Test 2: Verificar acceso básico
    try {
      const basicCheck = await checkNewCaseAccess(
        ctx,
        testUserId,
        args.caseId,
        ACCESS_LEVELS.BASIC,
      );
      results.tests.push({
        testNumber: 2,
        testName: "Check Basic Access",
        status: "PASSED",
        result: basicCheck,
        description: "Verifica si el usuario tiene acceso básico",
      });
    } catch (error: any) {
      results.tests.push({
        testNumber: 2,
        testName: "Check Basic Access",
        status: "FAILED",
        error: error.message,
        description: "Verifica si el usuario tiene acceso básico",
      });
      results.summary.errors.push(`Test 2: ${error.message}`);
    }

    // Test 3: Verificar acceso avanzado
    try {
      const advancedCheck = await checkNewCaseAccess(
        ctx,
        testUserId,
        args.caseId,
        ACCESS_LEVELS.ADVANCED,
      );
      results.tests.push({
        testNumber: 3,
        testName: "Check Advanced Access",
        status: "PASSED",
        result: advancedCheck,
        description: "Verifica si el usuario tiene acceso avanzado",
      });
    } catch (error: any) {
      results.tests.push({
        testNumber: 3,
        testName: "Check Advanced Access",
        status: "FAILED",
        error: error.message,
        description: "Verifica si el usuario tiene acceso avanzado",
      });
      results.summary.errors.push(`Test 3: ${error.message}`);
    }

    // Test 4: Verificar acceso admin
    try {
      const adminCheck = await checkNewCaseAccess(
        ctx,
        testUserId,
        args.caseId,
        ACCESS_LEVELS.ADMIN,
      );
      results.tests.push({
        testNumber: 4,
        testName: "Check Admin Access",
        status: "PASSED",
        result: adminCheck,
        description: "Verifica si el usuario tiene acceso administrativo",
      });
    } catch (error: any) {
      results.tests.push({
        testNumber: 4,
        testName: "Check Admin Access",
        status: "FAILED",
        error: error.message,
        description: "Verifica si el usuario tiene acceso administrativo",
      });
      results.summary.errors.push(`Test 4: ${error.message}`);
    }

    // Test 5: Intentar requerir acceso básico
    try {
      const requireBasic = await requireNewCaseAccess(
        ctx,
        testUserId,
        args.caseId,
        ACCESS_LEVELS.BASIC,
      );
      results.tests.push({
        testNumber: 5,
        testName:
          "Require Basic Access (Should Pass or Fail Based on Permissions)",
        status: "PASSED",
        result: requireBasic,
        description:
          "Intenta requerir acceso básico (debe fallar si no tiene permisos)",
      });
    } catch (error: any) {
      results.tests.push({
        testNumber: 5,
        testName:
          "Require Basic Access (Should Pass or Fail Based on Permissions)",
        status: "EXPECTED_FAILURE",
        error: error.message,
        description:
          "Intenta requerir acceso básico (debe fallar si no tiene permisos)",
      });
    }

    // Test 6: Intentar requerir acceso avanzado
    try {
      const requireAdvanced = await requireNewCaseAccess(
        ctx,
        testUserId,
        args.caseId,
        ACCESS_LEVELS.ADVANCED,
      );
      results.tests.push({
        testNumber: 6,
        testName:
          "Require Advanced Access (Should Pass or Fail Based on Permissions)",
        status: "PASSED",
        result: requireAdvanced,
        description: "Intenta requerir acceso avanzado",
      });
    } catch (error: any) {
      results.tests.push({
        testNumber: 6,
        testName:
          "Require Advanced Access (Should Pass or Fail Based on Permissions)",
        status: "EXPECTED_FAILURE",
        error: error.message,
        description: "Intenta requerir acceso avanzado",
      });
    }

    // Test 7: Intentar requerir acceso admin
    try {
      const requireAdmin = await requireNewCaseAccess(
        ctx,
        testUserId,
        args.caseId,
        ACCESS_LEVELS.ADMIN,
      );
      results.tests.push({
        testNumber: 7,
        testName:
          "Require Admin Access (Should Pass or Fail Based on Permissions)",
        status: "PASSED",
        result: requireAdmin,
        description: "Intenta requerir acceso administrativo",
      });
    } catch (error: any) {
      results.tests.push({
        testNumber: 7,
        testName:
          "Require Admin Access (Should Pass or Fail Based on Permissions)",
        status: "EXPECTED_FAILURE",
        error: error.message,
        description: "Intenta requerir acceso administrativo",
      });
    }

    // Calcular resumen
    results.summary.total = results.tests.length;
    results.summary.passed = results.tests.filter(
      (t) => t.status === "PASSED",
    ).length;
    results.summary.failed = results.tests.filter(
      (t) => t.status === "FAILED",
    ).length;

    return results;
  },
});

/**
 * Get comprehensive test data for manual testing
 */
export const getTestingSuiteData = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Obtener datos de testing
    const cases = await ctx.db.query("cases").take(10);
    const users = await ctx.db.query("users").take(10);
    const teams = await ctx.db.query("teams").take(5);
    const existingAccess = await ctx.db.query("caseAccess").collect();

    return {
      currentUser: {
        _id: currentUser._id,
        name: currentUser.name,
        email: currentUser.email,
      },
      testData: {
        cases: cases.map((c) => ({
          _id: c._id,
          title: c.title,
          description: c.description,
          createdAt: c._creationTime,
        })),
        users: users.map((u) => ({
          _id: u._id,
          name: u.name,
          email: u.email,
        })),
        teams: teams.map((t) => ({
          _id: t._id,
          name: t.name,
          description: t.description,
        })),
        existingAccess: existingAccess.map((a) => ({
          _id: a._id,
          caseId: a.caseId,
          userId: a.userId,
          teamId: a.teamId,
          accessLevel: a.accessLevel,
          isActive: a.isActive,
        })),
      },
      accessLevels: {
        available: Object.values(ACCESS_LEVELS),
        description: {
          [ACCESS_LEVELS.BASIC]: "Acceso básico - solo lectura",
          [ACCESS_LEVELS.ADVANCED]: "Acceso avanzado - lectura y edición",
          [ACCESS_LEVELS.ADMIN]: "Acceso administrativo - control total",
        },
      },
      testingGuide: {
        step1: "Usa createTestAccessRecord para crear permisos de prueba",
        step2: "Usa runCompletePermissionsTest para probar permisos de un caso",
        step3: "Usa testPermissionHierarchy para probar jerarquía de permisos",
        step4: "Usa cleanupTestData para limpiar datos de prueba",
      },
    };
  },
});

/**
 * Create test access records with better error handling
 */
export const createTestAccessRecord = mutation({
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

    // Validación de parámetros
    if (!args.userId && !args.teamId) {
      throw new Error("Debe especificar userId o teamId");
    }

    if (args.userId && args.teamId) {
      throw new Error("No puede especificar tanto userId como teamId");
    }

    try {
      // Verificar si ya existe acceso
      let existingAccess = null;
      if (args.userId) {
        existingAccess = await ctx.db
          .query("caseAccess")
          .withIndex("by_case_and_user", (q) =>
            q.eq("caseId", args.caseId).eq("userId", args.userId!),
          )
          .filter((q) => q.eq(q.field("isActive"), true))
          .first();
      } else if (args.teamId) {
        existingAccess = await ctx.db
          .query("caseAccess")
          .withIndex("by_case_and_team", (q) =>
            q.eq("caseId", args.caseId).eq("teamId", args.teamId!),
          )
          .filter((q) => q.eq(q.field("isActive"), true))
          .first();
      }

      let accessId: any;

      if (existingAccess) {
        // Actualizar acceso existente
        await ctx.db.patch(existingAccess._id, {
          accessLevel: args.accessLevel,
          grantedBy: currentUser._id,
          grantedAt: Date.now(),
          notes: args.notes || `Updated by ${currentUser.name}`,
        });
        accessId = existingAccess._id;
      } else {
        // Crear nuevo acceso
        accessId = await ctx.db.insert("caseAccess", {
          caseId: args.caseId,
          userId: args.userId,
          teamId: args.teamId,
          accessLevel: args.accessLevel,
          grantedBy: currentUser._id,
          grantedAt: Date.now(),
          isActive: true,
          notes: args.notes || `Created by ${currentUser.name} for testing`,
        });
      }

      return {
        success: true,
        accessId,
        action: existingAccess ? "updated" : "created",
        message: `${existingAccess ? "Updated" : "Created"} ${args.accessLevel} access for ${
          args.userId ? "user" : "team"
        }`,
        details: {
          caseId: args.caseId,
          userId: args.userId,
          teamId: args.teamId,
          accessLevel: args.accessLevel,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        details: {
          caseId: args.caseId,
          userId: args.userId,
          teamId: args.teamId,
          accessLevel: args.accessLevel,
        },
      };
    }
  },
});

/**
 * Test permission hierarchy (basic < advanced < admin)
 */
export const testPermissionHierarchy = query({
  args: {
    caseId: v.id("cases"),
    testUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const testUserId = args.testUserId || currentUser._id;

    const results = {
      testInfo: {
        testUserId,
        caseId: args.caseId,
        description:
          "Prueba la jerarquía de permisos: basic < advanced < admin",
      },
      hierarchyTests: [] as any[],
    };

    // Obtener el nivel actual del usuario
    const currentAccess = await getNewAccessLevel(ctx, testUserId, args.caseId);

    // Test hierarchy based on current level
    const testCases = [
      { level: ACCESS_LEVELS.BASIC, description: "Acceso básico" },
      { level: ACCESS_LEVELS.ADVANCED, description: "Acceso avanzado" },
      { level: ACCESS_LEVELS.ADMIN, description: "Acceso administrativo" },
    ];

    for (const testCase of testCases) {
      try {
        const hasAccess = await checkNewCaseAccess(
          ctx,
          testUserId,
          args.caseId,
          testCase.level,
        );

        results.hierarchyTests.push({
          requiredLevel: testCase.level,
          description: testCase.description,
          userCurrentLevel: currentAccess.level,
          hasAccess: hasAccess.hasAccess,
          result: hasAccess,
          expected: currentAccess.level
            ? isLevelSufficient(currentAccess.level, testCase.level)
            : false,
        });
      } catch (error: any) {
        results.hierarchyTests.push({
          requiredLevel: testCase.level,
          description: testCase.description,
          error: error.message,
          hasAccess: false,
        });
      }
    }

    return results;
  },
});

/**
 * Helper function to check level hierarchy
 */
function isLevelSufficient(
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
 * Cleanup test data
 */
export const cleanupTestData = mutation({
  args: {
    keepRecentHours: v.optional(v.number()), // Keep data from last N hours
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const keepRecentMs = (args.keepRecentHours || 0) * 60 * 60 * 1000;
    const cutoffTime = Date.now() - keepRecentMs;

    const allAccess = await ctx.db.query("caseAccess").collect();
    let deletedCount = 0;

    for (const access of allAccess) {
      // Delete if it's old enough or if keepRecentHours is 0 (delete all)
      if (
        keepRecentMs === 0 ||
        (access.grantedAt && access.grantedAt < cutoffTime)
      ) {
        await ctx.db.delete(access._id);
        deletedCount++;
      }
    }

    return {
      success: true,
      deletedRecords: deletedCount,
      totalRecords: allAccess.length,
      keptRecords: allAccess.length - deletedCount,
      message: `Cleaned up ${deletedCount} test records`,
      cleanedBy: currentUser.name,
    };
  },
});

/**
 * Get detailed access report for a case
 */
export const getCaseAccessReport = query({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Get all access records for this case
    const caseAccess = await ctx.db
      .query("caseAccess")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Get case details
    const caseDetails = await ctx.db.get(args.caseId);

    const report = {
      case: {
        _id: args.caseId,
        title: caseDetails?.title,
        description: caseDetails?.description,
      },
      accessSummary: {
        totalUsers: 0,
        totalTeams: 0,
        byLevel: {
          basic: 0,
          advanced: 0,
          admin: 0,
        },
      },
      userAccess: [] as any[],
      teamAccess: [] as any[],
    };

    for (const access of caseAccess) {
      if (access.userId) {
        const user = await ctx.db.get(access.userId);
        report.userAccess.push({
          user: {
            _id: access.userId,
            name: user?.name,
            email: user?.email,
          },
          accessLevel: access.accessLevel,
          grantedAt: access.grantedAt,
          grantedBy: access.grantedBy,
          notes: access.notes,
        });
        report.accessSummary.totalUsers++;
      }

      if (access.teamId) {
        const team = await ctx.db.get(access.teamId);
        report.teamAccess.push({
          team: {
            _id: access.teamId,
            name: team?.name,
            description: team?.description,
          },
          accessLevel: access.accessLevel,
          grantedAt: access.grantedAt,
          grantedBy: access.grantedBy,
          notes: access.notes,
        });
        report.accessSummary.totalTeams++;
      }

      // Count by level
      report.accessSummary.byLevel[
        access.accessLevel as keyof typeof report.accessSummary.byLevel
      ]++;
    }

    return report;
  },
});
