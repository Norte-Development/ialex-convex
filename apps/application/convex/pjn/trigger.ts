import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

/**
 * Internal mutation to queue a PJN case history sync for a case.
 * 
 * This is called when a case's FRE field is created or updated.
 * It creates/updates a job row and schedules the workflow to run.
 * 
 * Implements idempotency: won't create a new job if one is already queued/running.
 */
export const queueCaseHistorySyncForCase = internalMutation({
  args: {
    caseId: v.id("cases"),
    userId: v.id("users"),
    syncProfile: v.optional(
      v.object({
        maxMovements: v.optional(v.number()),
        includeIntervinientes: v.optional(v.boolean()),
        includeVinculados: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (
    ctx,
    args
  ): Promise<
    | { jobId: Id<"pjnCaseHistorySyncJobs">; created: boolean }
    | { skipped: true; reason: string }
  > => {
    // Get the case to verify FRE exists
    const caseDoc = await ctx.db.get(args.caseId);
    if (!caseDoc) {
      return {
        skipped: true as const,
        reason: "Case not found",
      };
    }

    if (!caseDoc.fre) {
      return {
        skipped: true as const,
        reason: "Case has no FRE",
      };
    }

    // Try to create a job (this will return null if one already exists)
    const jobId = await ctx.runMutation(internal.pjn.caseHistoryJobs.createJob, {
      caseId: args.caseId,
      userId: args.userId,
    });

    if (!jobId) {
      // Job already exists and is running/queued
      return {
        skipped: true as const,
        reason: "Sync job already queued or running for this case",
      };
    }

    // Schedule the workflow to start immediately
    await ctx.scheduler.runAfter(
      0,
      internal.workflows.pjnCaseHistoryWorkflow.startWorkflow,
      {
        caseId: args.caseId,
        userId: args.userId,
        jobId,
        syncProfile: args.syncProfile,
      }
    );

    console.log(
      `Queued PJN case history sync for case ${String(args.caseId)}, job ${String(jobId)}`
    );

    return {
      jobId,
      created: true,
    };
  },
});
