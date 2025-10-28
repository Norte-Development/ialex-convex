/**
 * Migrate Test Users (Phase 1.1.1)
 * 
 * This function migrates a small batch of users from Kinde to Clerk for testing.
 * Always run this before the full migration to ensure everything works correctly.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { 
  MIGRATION_TEST_LIMIT,
  validateMigrationEnvironment,
  logMigrationConfig
} from "./constants";

interface MigrationResult {
  email: string;
  status: string;
  clerkId?: string;
  convexUserId?: string;
  existingUserId?: string;
  reason?: string;
  error?: string;
}

export const migrateTestUsers = internalAction({
  args: { 
    limit: v.optional(v.number()) 
  },
  returns: v.object({
    total: v.number(),
    success: v.number(),
    skipped: v.number(),
    errors: v.number(),
    results: v.array(
      v.object({
        email: v.string(),
        status: v.string(),
        clerkId: v.optional(v.string()),
        convexUserId: v.optional(v.string()),
        existingUserId: v.optional(v.string()),
        reason: v.optional(v.string()),
        error: v.optional(v.string()),
      })
    ),
  }),
  handler: async (ctx, args): Promise<{
    total: number;
    success: number;
    skipped: number;
    errors: number;
    results: MigrationResult[];
  }> => {
    // Validate environment
    const validation = validateMigrationEnvironment();
    if (!validation.isValid) {
      throw new Error(
        `Missing required environment variables: ${validation.missingVars.join(", ")}`
      );
    }

    logMigrationConfig();

    const limit = args.limit || MIGRATION_TEST_LIMIT;
    
    console.log(`Starting test migration with limit: ${limit}`);

    // Get limited number of users from Kinde
    const kindeUsers: any[] = await ctx.runAction(
      internal.migrations.kindeHelpers.getKindeUsersByLimit,
      { limit }
    );

    const results: MigrationResult[] = [];
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const user of kindeUsers) {
      const kindeUser = user.data;
      const email = kindeUser.email;

      if (!email) {
        errorCount++;
        results.push({
          email: "unknown",
          status: "error",
          error: "User has no email",
        });
        continue;
      }

      try {
        // Check if user already exists in Convex
        const existingUser = await ctx.runQuery(
          internal.migrations.helpers.getByEmail,
          { email }
        );

        if (existingUser) {
          skippedCount++;
          results.push({
            email,
            status: "skipped",
            reason: "User already exists in Convex",
            existingUserId: existingUser._id,
          });
          continue;
        }

        // Create Clerk user
        const firstName = kindeUser.first_name || "";
        const lastName = kindeUser.last_name || "";

        const clerkUser = await ctx.runAction(
          internal.migrations.clerkHelpers.createClerkUser,
          {
            email,
            firstName,
            lastName,
            oldKindeId: user.id,
          }
        );

        // Create Convex user
        const convexUserId = await ctx.runMutation(
          internal.migrations.helpers.createMigrationStub,
          {
            clerkId: clerkUser.id,
            name: `${firstName} ${lastName}`.trim() || email,
            email,
            isActive: true,
            isOnboardingComplete: false,
            migration: {
              status: "pending",
              oldKindeId: user.id,
              consentGiven: false,
            },
          }
        );

        successCount++;
        results.push({
          email,
          status: "success",
          clerkId: clerkUser.id,
          convexUserId,
        });

        console.log(`Successfully migrated test user: ${email}`);
      } catch (error: any) {
        errorCount++;
        results.push({
          email,
          status: "error",
          error: error.message,
        });
        console.error(`Failed to migrate test user ${email}:`, error);
      }
    }

    const summary = {
      total: kindeUsers.length,
      success: successCount,
      skipped: skippedCount,
      errors: errorCount,
      results,
    };

    console.log("Test migration completed:", summary);
    return summary;
  },
});

