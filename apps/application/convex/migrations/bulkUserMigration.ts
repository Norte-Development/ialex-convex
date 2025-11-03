/**
 * Bulk User Migration (Phase 1.1.2)
 * 
 * This function migrates ALL users from Kinde to Clerk.
 * Only run this after testing with migrateTestUsers!
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  MIGRATION_BATCH_SIZE,
  MIGRATION_RETRY_ATTEMPTS,
  MIGRATION_RETRY_DELAY,
  validateMigrationEnvironment,
  logMigrationConfig,
} from "./constants";

interface MigrationDetail {
  email: string;
  status: string;
  clerkId?: string;
  convexUserId?: string;
  existingUserId?: string;
  error?: string;
}

export const migrateAllUsersToClerk = internalAction({
  args: {},
  returns: v.object({
    total: v.number(),
    success: v.number(),
    skipped: v.number(),
    errors: v.number(),
    details: v.array(
      v.object({
        email: v.string(),
        status: v.string(),
        clerkId: v.optional(v.string()),
        convexUserId: v.optional(v.string()),
        existingUserId: v.optional(v.string()),
        error: v.optional(v.string()),
      })
    ),
  }),
  handler: async (ctx): Promise<{
    total: number;
    success: number;
    skipped: number;
    errors: number;
    details: MigrationDetail[];
  }> => {
    // Validate environment
    const validation = validateMigrationEnvironment();
    if (!validation.isValid) {
      throw new Error(
        `Missing required environment variables: ${validation.missingVars.join(", ")}`
      );
    }

    logMigrationConfig();

    console.log("Starting bulk user migration from Kinde to Clerk...");

    // Get all users from Kinde
    const kindeUsers = await ctx.runAction(
      internal.migrations.kindeHelpers.getAllKindeUsers,
      {}
    );

    console.log(`Found ${kindeUsers.length} users to migrate`);

    const results: {
      total: number;
      success: number;
      skipped: number;
      errors: number;
      details: MigrationDetail[];
    } = {
      total: kindeUsers.length,
      success: 0,
      skipped: 0,
      errors: 0,
      details: [] as MigrationDetail[],
    };

    let processedCount = 0;

    for (const user of kindeUsers) {
      const kindeUser = user.data;
      const email = kindeUser.email;

      processedCount++;

      if (!email) {
        results.errors++;
        results.details.push({
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
          // Add migration metadata to existing user
          await ctx.runMutation(
            internal.migrations.helpers.addMigrationMetadata,
            {
              userId: existingUser._id,
              oldKindeId: user.id,
              migrationStatus: "pending",
            }
          );

          results.skipped++;
          results.details.push({
            email,
            status: "merged",
            existingUserId: existingUser._id,
          });

          console.log(`Merged existing user: ${email} (${processedCount}/${results.total})`);
          continue;
        }

        // Create Clerk user with retry logic
        let clerkUser;
        let retryCount = 0;

        while (retryCount < MIGRATION_RETRY_ATTEMPTS) {
          try {
            const firstName = kindeUser.first_name || "";
            const lastName = kindeUser.last_name || "";

            clerkUser = await ctx.runAction(
              internal.migrations.clerkHelpers.createClerkUser,
              {
                email,
                firstName,
                lastName,
                oldKindeId: user.id,
              }
            );

            break; // Success, exit retry loop
          } catch (error: any) {
            retryCount++;
            if (retryCount >= MIGRATION_RETRY_ATTEMPTS) {
              throw error; // Final attempt failed
            }
            console.log(
              `Retry ${retryCount}/${MIGRATION_RETRY_ATTEMPTS} for ${email}...`
            );
            await new Promise((resolve) => setTimeout(resolve, MIGRATION_RETRY_DELAY));
          }
        }

        if (!clerkUser) {
          throw new Error("Failed to create Clerk user after retries");
        }

        // Create Convex user
        const firstName = kindeUser.first_name || "";
        const lastName = kindeUser.last_name || "";

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

        results.success++;
        results.details.push({
          email,
          status: "created",
          clerkId: clerkUser.id,
          convexUserId,
        });

        console.log(`Migrated user: ${email} (${processedCount}/${results.total})`);
      } catch (error: any) {
        results.errors++;
        results.details.push({
          email,
          status: "error",
          error: error.message,
        });
        console.error(`Failed to migrate user ${email}:`, error);
      }

      // Log progress every 10 users
      if (processedCount % 10 === 0) {
        console.log(
          `Progress: ${processedCount}/${results.total} (${Math.round((processedCount / results.total) * 100)}%)`
        );
      }
    }

    console.log("Bulk migration completed:", {
      total: results.total,
      success: results.success,
      skipped: results.skipped,
      errors: results.errors,
    });

    return results;
  },
});

