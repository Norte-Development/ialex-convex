"use node";

/**
 * User Data Migration Orchestrator - Phase 2
 * 
 * Main function that orchestrates the complete data migration for a user.
 * Now uses workflow-based migration to avoid timeouts.
 * Migrates cases, clients, and documents from Firestore to Convex.
 */

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { UserMigrationResult } from "./types";

/**
 * Migrate all data for a single user using workflow
 * 
 * This is the main entry point for Phase 2 data migration.
 * Called when a user logs in and gives consent to migrate their data.
 * Now uses workflow to avoid timeout issues.
 */
export const migrateUserData = internalAction({
  args: { userId: v.id("users") },
  returns: v.any(), // UserMigrationResult
  handler: async (ctx, { userId }): Promise<UserMigrationResult> => {
    console.log(`Starting workflow-based data migration for user ${userId}`);
    
    // Delegate to the workflow-based migration
    return await ctx.runAction(
      internal.migrations.migrationWorkflow.migrateUserDataWorkflow,
      { userId }
    );
  }
});

