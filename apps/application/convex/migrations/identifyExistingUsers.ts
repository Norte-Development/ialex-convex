/**
 * Identify Existing Users (Phase 1.0.1)
 * 
 * This function identifies users who exist in both Kinde and Convex
 * (current system) to detect conflicts before migration.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { validateMigrationEnvironment, logMigrationConfig } from "./constants";

export const identifyExistingUsers = internalAction({
  args: {},
  returns: v.object({
    kindeUserCount: v.number(),
    convexUserCount: v.number(),
    conflicts: v.array(v.string()),
    conflictCount: v.number(),
  }),
  handler: async (ctx): Promise<{
    kindeUserCount: number;
    convexUserCount: number;
    conflicts: string[];
    conflictCount: number;
  }> => {
    // Validate environment configuration
    const validation = validateMigrationEnvironment();
    if (!validation.isValid) {
      throw new Error(
        `Missing required environment variables: ${validation.missingVars.join(", ")}`
      );
    }

    // Log configuration (without sensitive data)
    logMigrationConfig();

    console.log("Starting to identify existing users...");

    // Get all users from Kinde
    const kindeUsers = await ctx.runAction(internal.migrations.kindeHelpers.getAllKindeUsers, {});

    const kindeEmails = new Set<string>();
    
    kindeUsers.forEach((user: any) => {
      if (user.data.email) {
        kindeEmails.add(user.data.email.toLowerCase());
      }
    });

    console.log(`Found ${kindeEmails.size} users in Kinde`);

    // Get all users from Convex (existing users)
    const convexUsers = await ctx.runQuery(internal.migrations.helpers.getAllUsers, {});
    const convexEmails = new Set<string>();
    
    convexUsers.forEach((user: { email: string }) => {
      convexEmails.add(user.email.toLowerCase());
    });

    console.log(`Found ${convexUsers.length} users in Convex`);

    // Find conflicts (users in both systems)
    const conflicts = Array.from(kindeEmails).filter((email) =>
      convexEmails.has(email)
    );

    console.log(`Found ${conflicts.length} email conflicts:`, conflicts);

    return {
      kindeUserCount: kindeUsers.length,
      convexUserCount: convexUsers.length,
      conflicts,
      conflictCount: conflicts.length,
    };
  },
});
