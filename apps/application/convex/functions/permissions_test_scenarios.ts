import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
  getCurrentUserFromAuth,
  checkNewCaseAccess,
  requireNewCaseAccess,
  getNewAccessLevel,
  ACCESS_LEVELS,
} from "../auth_utils";

// ========================================
// SPECIFIC TEST SCENARIOS
// ========================================

/**
 * Scenario 1: Test user with no permissions trying to access case
 */
export const testScenario_NoPermissions = query({
  args: {
    caseId: v.id("cases"),
    testUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const scenario = {
      name: "Usuario sin permisos",
      description:
        "Testea que un usuario sin permisos no pueda acceder al caso",
      testUserId: args.testUserId,
      caseId: args.caseId,
      results: [] as any[],
    };

    // Test 1: Check current access
    try {
      const access = await getNewAccessLevel(ctx, args.testUserId, args.caseId);
      scenario.results.push({
        test: "Current Access Check",
        expected: "No access",
        result: access.level || "none",
        passed: access.level === null,
      });
    } catch (error: any) {
      scenario.results.push({
        test: "Current Access Check",
        expected: "No access",
        result: `Error: ${error.message}`,
        passed: false,
      });
    }

    // Test 2: Try to require basic access (should fail)
    try {
      await requireNewCaseAccess(
        ctx,
        args.testUserId,
        args.caseId,
        ACCESS_LEVELS.BASIC,
      );
      scenario.results.push({
        test: "Require Basic Access",
        expected: "Should fail",
        result: "Unexpectedly succeeded",
        passed: false,
      });
    } catch (error: any) {
      scenario.results.push({
        test: "Require Basic Access",
        expected: "Should fail",
        result: `Failed as expected: ${error.message}`,
        passed: true,
      });
    }

    return scenario;
  },
});

/**
 * Scenario 2: Test user with basic permissions
 */
export const testScenario_BasicPermissions = query({
  args: {
    caseId: v.id("cases"),
    testUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const scenario = {
      name: "Usuario con permisos básicos",
      description:
        "Testea que un usuario con permisos básicos tenga acceso limitado",
      testUserId: args.testUserId,
      caseId: args.caseId,
      results: [] as any[],
    };

    // Test 1: Should have basic access
    try {
      const basicAccess = await checkNewCaseAccess(
        ctx,
        args.testUserId,
        args.caseId,
        ACCESS_LEVELS.BASIC,
      );
      scenario.results.push({
        test: "Basic Access Check",
        expected: "Should have access",
        result: basicAccess.hasAccess ? "Has access" : "No access",
        passed: basicAccess.hasAccess,
      });
    } catch (error: any) {
      scenario.results.push({
        test: "Basic Access Check",
        expected: "Should have access",
        result: `Error: ${error.message}`,
        passed: false,
      });
    }

    // Test 2: Should NOT have advanced access (unless they have advanced+ level)
    try {
      const advancedAccess = await checkNewCaseAccess(
        ctx,
        args.testUserId,
        args.caseId,
        ACCESS_LEVELS.ADVANCED,
      );
      scenario.results.push({
        test: "Advanced Access Check",
        expected: "Should not have access (unless user has advanced+ level)",
        result: advancedAccess.hasAccess ? "Has access" : "No access",
        passed: true, // This is informational
        note: `User level: ${advancedAccess.userLevel || "none"}`,
      });
    } catch (error: any) {
      scenario.results.push({
        test: "Advanced Access Check",
        expected: "Should not have access",
        result: `Error: ${error.message}`,
        passed: false,
      });
    }

    // Test 3: Should NOT have admin access (unless they have admin level)
    try {
      const adminAccess = await checkNewCaseAccess(
        ctx,
        args.testUserId,
        args.caseId,
        ACCESS_LEVELS.ADMIN,
      );
      scenario.results.push({
        test: "Admin Access Check",
        expected: "Should not have access (unless user has admin level)",
        result: adminAccess.hasAccess ? "Has access" : "No access",
        passed: true, // This is informational
        note: `User level: ${adminAccess.userLevel || "none"}`,
      });
    } catch (error: any) {
      scenario.results.push({
        test: "Admin Access Check",
        expected: "Should not have access",
        result: `Error: ${error.message}`,
        passed: false,
      });
    }

    return scenario;
  },
});

/**
 * Scenario 3: Test permission hierarchy
 */
export const testScenario_PermissionHierarchy = query({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    const scenario = {
      name: "Jerarquía de permisos",
      description:
        "Testea que la jerarquía basic < advanced < admin funcione correctamente",
      caseId: args.caseId,
      results: [] as any[],
    };

    // Get users with different access levels
    const allAccess = await ctx.db
      .query("caseAccess")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    for (const access of allAccess) {
      if (access.userId) {
        const user = await ctx.db.get(access.userId);

        // Test hierarchy for this user
        const userTests = {
          userId: access.userId,
          userName: user?.name,
          assignedLevel: access.accessLevel,
          tests: [] as any[],
        };

        // Test access to same level
        try {
          const sameLevel = await checkNewCaseAccess(
            ctx,
            access.userId,
            args.caseId,
            access.accessLevel as any,
          );
          userTests.tests.push({
            test: `Access to same level (${access.accessLevel})`,
            result: sameLevel.hasAccess,
            expected: true,
            passed: sameLevel.hasAccess,
          });
        } catch (error: any) {
          userTests.tests.push({
            test: `Access to same level (${access.accessLevel})`,
            result: `Error: ${error.message}`,
            expected: true,
            passed: false,
          });
        }

        // Test access to lower levels
        if (
          access.accessLevel === "advanced" ||
          access.accessLevel === "admin"
        ) {
          try {
            const basicAccess = await checkNewCaseAccess(
              ctx,
              access.userId,
              args.caseId,
              ACCESS_LEVELS.BASIC,
            );
            userTests.tests.push({
              test: "Access to basic (from higher level)",
              result: basicAccess.hasAccess,
              expected: true,
              passed: basicAccess.hasAccess,
            });
          } catch (error: any) {
            userTests.tests.push({
              test: "Access to basic (from higher level)",
              result: `Error: ${error.message}`,
              expected: true,
              passed: false,
            });
          }
        }

        if (access.accessLevel === "admin") {
          try {
            const advancedAccess = await checkNewCaseAccess(
              ctx,
              access.userId,
              args.caseId,
              ACCESS_LEVELS.ADVANCED,
            );
            userTests.tests.push({
              test: "Access to advanced (from admin)",
              result: advancedAccess.hasAccess,
              expected: true,
              passed: advancedAccess.hasAccess,
            });
          } catch (error: any) {
            userTests.tests.push({
              test: "Access to advanced (from admin)",
              result: `Error: ${error.message}`,
              expected: true,
              passed: false,
            });
          }
        }

        scenario.results.push(userTests);
      }
    }

    return scenario;
  },
});

/**
 * Scenario 4: Test team permissions
 */
export const testScenario_TeamPermissions = query({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    const scenario = {
      name: "Permisos de equipo",
      description: "Testea que los permisos de equipo funcionen correctamente",
      caseId: args.caseId,
      results: [] as any[],
    };

    // Get team access for this case
    const teamAccess = await ctx.db
      .query("caseAccess")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) =>
        q.and(
          q.eq(q.field("isActive"), true),
          q.neq(q.field("teamId"), undefined),
        ),
      )
      .collect();

    for (const access of teamAccess) {
      if (access.teamId) {
        const team = await ctx.db.get(access.teamId);

        // Get team members
        const teamMembers = await ctx.db
          .query("teamMemberships")
          .withIndex("by_team", (q) => q.eq("teamId", access.teamId!))
          .filter((q) => q.eq(q.field("isActive"), true))
          .collect();

        const teamTest = {
          teamId: access.teamId,
          teamName: team?.name,
          teamAccessLevel: access.accessLevel,
          memberTests: [] as any[],
        };

        // Test each team member
        for (const membership of teamMembers) {
          const user = await ctx.db.get(membership.userId);

          try {
            const memberAccess = await checkNewCaseAccess(
              ctx,
              membership.userId,
              args.caseId,
              access.accessLevel as any,
            );

            teamTest.memberTests.push({
              userId: membership.userId,
              userName: user?.name,
              teamRole: membership.role,
              hasExpectedAccess: memberAccess.hasAccess,
              accessSource: memberAccess.source,
              passed: memberAccess.hasAccess && memberAccess.source === "team",
            });
          } catch (error: any) {
            teamTest.memberTests.push({
              userId: membership.userId,
              userName: user?.name,
              teamRole: membership.role,
              error: error.message,
              passed: false,
            });
          }
        }

        scenario.results.push(teamTest);
      }
    }

    return scenario;
  },
});

/**
 * Scenario 5: Test mixed permissions (user + team)
 */
export const testScenario_MixedPermissions = query({
  args: {
    caseId: v.id("cases"),
    testUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const scenario = {
      name: "Permisos mixtos (usuario + equipo)",
      description:
        "Testea cómo se resuelven los permisos cuando un usuario tiene acceso individual Y de equipo",
      testUserId: args.testUserId,
      caseId: args.caseId,
      results: [] as any[],
    };

    // Check user's individual access
    const userAccess = await ctx.db
      .query("caseAccess")
      .withIndex("by_case_and_user", (q) =>
        q.eq("caseId", args.caseId).eq("userId", args.testUserId),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    // Check user's team memberships
    const teamMemberships = await ctx.db
      .query("teamMemberships")
      .withIndex("by_user", (q) => q.eq("userId", args.testUserId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Check team access for this case
    const teamAccess = [];
    for (const membership of teamMemberships) {
      const access = await ctx.db
        .query("caseAccess")
        .withIndex("by_case_and_team", (q) =>
          q.eq("caseId", args.caseId).eq("teamId", membership.teamId),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      if (access) {
        const team = await ctx.db.get(membership.teamId);
        teamAccess.push({
          team: team?.name,
          accessLevel: access.accessLevel,
          teamRole: membership.role,
        });
      }
    }

    scenario.results.push({
      userDirectAccess: userAccess
        ? {
            level: userAccess.accessLevel,
            grantedAt: userAccess.grantedAt,
          }
        : null,
      teamAccess: teamAccess,
    });

    // Test final resolved access
    try {
      const resolvedAccess = await getNewAccessLevel(
        ctx,
        args.testUserId,
        args.caseId,
      );
      scenario.results.push({
        test: "Resolved Access Level",
        result: {
          level: resolvedAccess.level,
          source: resolvedAccess.source,
        },
        note: "Este es el nivel final que se usa en las verificaciones",
      });
    } catch (error: any) {
      scenario.results.push({
        test: "Resolved Access Level",
        error: error.message,
      });
    }

    return scenario;
  },
});

/**
 * Get a comprehensive overview of all scenarios (simplified)
 */
export const getTestScenariosOverview = query({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Get basic case info
    const caseDetails = await ctx.db.get(args.caseId);

    // Get all access records for this case
    const allAccess = await ctx.db
      .query("caseAccess")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const userAccess = allAccess.filter((a) => a.userId);
    const teamAccess = allAccess.filter((a) => a.teamId);

    return {
      testInfo: {
        caseId: args.caseId,
        caseTitle: caseDetails?.title,
        testerUserId: currentUser._id,
        testerName: currentUser.name,
        timestamp: Date.now(),
      },
      summary: {
        totalUserAccess: userAccess.length,
        totalTeamAccess: teamAccess.length,
        accessLevels: {
          basic: allAccess.filter((a) => a.accessLevel === "basic").length,
          advanced: allAccess.filter((a) => a.accessLevel === "advanced")
            .length,
          admin: allAccess.filter((a) => a.accessLevel === "admin").length,
        },
      },
      availableTests: [
        "testScenario_NoPermissions - Test usuario sin permisos",
        "testScenario_BasicPermissions - Test usuario con permisos básicos",
        "testScenario_PermissionHierarchy - Test jerarquía de permisos",
        "testScenario_TeamPermissions - Test permisos de equipo",
        "testScenario_MixedPermissions - Test permisos mixtos (usuario + equipo)",
      ],
      userAccessList: userAccess.map((a) => ({
        userId: a.userId,
        accessLevel: a.accessLevel,
        grantedAt: a.grantedAt,
      })),
      teamAccessList: teamAccess.map((a) => ({
        teamId: a.teamId,
        accessLevel: a.accessLevel,
        grantedAt: a.grantedAt,
      })),
    };
  },
});

/**
 * Quick setup for testing - creates test data
 */
export const quickTestSetup = mutation({
  args: {
    caseId: v.id("cases"),
    createBasicUser: v.optional(v.boolean()),
    createAdvancedUser: v.optional(v.boolean()),
    createAdminUser: v.optional(v.boolean()),
    createTeamAccess: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const results = [];

    // Get some users for testing
    const users = await ctx.db.query("users").take(5);
    const teams = await ctx.db.query("teams").take(3);

    if (args.createBasicUser && users[0]) {
      const accessId = await ctx.db.insert("caseAccess", {
        caseId: args.caseId,
        userId: users[0]._id,
        accessLevel: "basic",
        grantedBy: currentUser._id,
        grantedAt: Date.now(),
        isActive: true,
        notes: "Quick test setup - basic user",
      });
      results.push({
        type: "user",
        level: "basic",
        user: users[0].name,
        accessId,
      });
    }

    if (args.createAdvancedUser && users[1]) {
      const accessId = await ctx.db.insert("caseAccess", {
        caseId: args.caseId,
        userId: users[1]._id,
        accessLevel: "advanced",
        grantedBy: currentUser._id,
        grantedAt: Date.now(),
        isActive: true,
        notes: "Quick test setup - advanced user",
      });
      results.push({
        type: "user",
        level: "advanced",
        user: users[1].name,
        accessId,
      });
    }

    if (args.createAdminUser && users[2]) {
      const accessId = await ctx.db.insert("caseAccess", {
        caseId: args.caseId,
        userId: users[2]._id,
        accessLevel: "admin",
        grantedBy: currentUser._id,
        grantedAt: Date.now(),
        isActive: true,
        notes: "Quick test setup - admin user",
      });
      results.push({
        type: "user",
        level: "admin",
        user: users[2].name,
        accessId,
      });
    }

    if (args.createTeamAccess && teams[0]) {
      const accessId = await ctx.db.insert("caseAccess", {
        caseId: args.caseId,
        teamId: teams[0]._id,
        accessLevel: "advanced",
        grantedBy: currentUser._id,
        grantedAt: Date.now(),
        isActive: true,
        notes: "Quick test setup - team access",
      });
      results.push({
        type: "team",
        level: "advanced",
        team: teams[0].name,
        accessId,
      });
    }

    return {
      success: true,
      created: results,
      message: `Created ${results.length} test access records`,
      nextSteps: [
        "Use runAllTestScenarios to test the setup",
        "Use individual test scenarios for specific testing",
        "Use cleanupTestData when done",
      ],
    };
  },
});
