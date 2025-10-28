/**
 * Handle Email Conflicts (Phase 1.0.2)
 * 
 * This function resolves conflicts when users exist in both Kinde and Convex
 * by either merging data or creating alternative accounts.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { CONFLICT_RESOLUTION_STRATEGIES } from "./constants";

interface KindeUser {
  id: string;
  email: string;
  given_name?: string;
  family_name?: string;
  firstName?: string;
  lastName?: string;
}

interface ConvexUser {
  _id: any;
  email: string;
  name: string;
  clerkId: string;
}

export const handleEmailConflicts = internalAction({
  args: {},
  returns: v.object({
    totalConflicts: v.number(),
    merged: v.number(),
    alternativeCreated: v.number(),
    skipped: v.number(),
    errors: v.number(),
    details: v.array(
      v.object({
        email: v.string(),
        strategy: v.string(),
        status: v.string(),
        error: v.optional(v.string()),
      })
    ),
  }),
  handler: async (ctx): Promise<{
    totalConflicts: number;
    merged: number;
    alternativeCreated: number;
    skipped: number;
    errors: number;
    details: Array<{
      email: string;
      strategy: string;
      status: string;
      error?: string;
    }>;
  }> => {
    console.log("Starting to handle email conflicts...");

    // Get conflicts
    const conflictData = await ctx.runAction(
      internal.migrations.identifyExistingUsers.identifyExistingUsers,
      {}
    );

    const results = {
      totalConflicts: conflictData.conflictCount,
      merged: 0,
      alternativeCreated: 0,
      skipped: 0,
      errors: 0,
      details: [] as Array<{
        email: string;
        strategy: string;
        status: string;
        error?: string;
      }>,
    };

    for (const email of conflictData.conflicts) {
      try {
        // Get Kinde user from Firestore
        const kindeUserDoc = await ctx.runAction(
          internal.migrations.firebaseHelpers.getFirestoreUserByEmail,
          { email }
        );

        if (!kindeUserDoc) {
          results.skipped++;
          results.details.push({
            email,
            strategy: CONFLICT_RESOLUTION_STRATEGIES.SKIP,
            status: "skipped",
            error: "Kinde user not found",
          });
          continue;
        }

        const kindeUserData = kindeUserDoc.data;
        const kindeUser: KindeUser = {
          id: kindeUserDoc.id,
          email: kindeUserData.email,
          given_name: kindeUserData.given_name,
          family_name: kindeUserData.family_name,
          firstName: kindeUserData.firstName,
          lastName: kindeUserData.lastName,
        };

        // Get Convex user
        const convexUser = await ctx.runQuery(internal.migrations.helpers.getByEmail, {
          email,
        });

        if (!convexUser) {
          results.skipped++;
          results.details.push({
            email,
            strategy: CONFLICT_RESOLUTION_STRATEGIES.SKIP,
            status: "skipped",
            error: "Convex user not found",
          });
          continue;
        }

        // Decide strategy: merge or create alternative
        const shouldMerge = await shouldMergeUsers(ctx, kindeUser, convexUser);

        if (shouldMerge) {
          // Strategy: Merge
          await mergeUserData(ctx, kindeUser, convexUser);
          results.merged++;
          results.details.push({
            email,
            strategy: CONFLICT_RESOLUTION_STRATEGIES.MERGE,
            status: "success",
          });
        } else {
          // Strategy: Alternative email (not implemented in Phase 1)
          // For now, we'll just merge all conflicts
          await mergeUserData(ctx, kindeUser, convexUser);
          results.merged++;
          results.details.push({
            email,
            strategy: CONFLICT_RESOLUTION_STRATEGIES.MERGE,
            status: "success",
          });
        }
      } catch (error: any) {
        results.errors++;
        results.details.push({
          email,
          strategy: "unknown",
          status: "error",
          error: error.message,
        });
        console.error(`Failed to handle conflict for ${email}:`, error);
      }
    }

    console.log("Conflict handling completed:", results);
    return results;
  },
});

/**
 * Determine if users should be merged
 * Currently always returns true for simplicity
 */
async function shouldMergeUsers(
  ctx: any,
  kindeUser: KindeUser,
  convexUser: ConvexUser
): Promise<boolean> {
  // Get Convex user data count
  const convexUserData = await ctx.runQuery(
    internal.migrations.helpers.getUserDataCount,
    { userId: convexUser._id }
  );

  // If Convex user has no data, merge
  if (convexUserData.totalCount === 0) {
    return true;
  }

  // For Phase 1, always merge
  // In a production scenario, you might want more sophisticated logic
  return true;
}

/**
 * Merge Kinde user data with existing Convex user
 */
async function mergeUserData(
  ctx: any,
  kindeUser: KindeUser,
  convexUser: ConvexUser
): Promise<void> {
  // Add migration metadata to existing Convex user
  await ctx.runMutation(internal.migrations.helpers.addMigrationMetadata, {
    userId: convexUser._id,
    oldKindeId: kindeUser.id,
    migrationStatus: "pending",
  });

  console.log(
    `Merged Kinde user ${kindeUser.email} with existing Convex user ${convexUser._id}`
  );
}
