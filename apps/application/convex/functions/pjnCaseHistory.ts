import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { getCurrentUserFromAuth, requireNewCaseAccess } from "../auth_utils";

/**
 * Public query to get the current PJN case history sync status for a case.
 * 
 * Returns the latest sync job for the case, or null if no sync has been initiated.
 * Requires at least "basic" access to the case.
 */
export const getCaseHistorySyncStatus = query({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args): Promise<{
    _id: Id<"pjnCaseHistorySyncJobs">;
    caseId: Id<"cases">;
    userId: Id<"users">;
    status: "queued" | "running" | "completed" | "failed" | "auth_required";
    phase?: "connecting" | "fetching_history" | "ingesting_movements" | "ingesting_documents" | "finalizing";
    progressPercent?: number;
    errorMessage?: string;
    movimientosProcessed?: number;
    documentsProcessed?: number;
    participantsProcessed?: number;
    appealsProcessed?: number;
    relatedCasesProcessed?: number;
    durationMs?: number;
    retryAttempt?: number;
    createdAt: number;
    startedAt?: number;
    finishedAt?: number;
    lastUpdatedAt: number;
  } | null> => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Ensure user has at least basic access to the case
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");
    
    // Fetch the latest job for this case
    const job = await ctx.runQuery(internal.pjn.caseHistoryJobs.getLatestJobForCase, {
      caseId: args.caseId,
    });
    
    return job;
  },
});

/**
 * Public mutation to retry a failed or auth-required PJN case history sync.
 * 
 * This queues a new sync job for the case. Requires "advanced" access to the case.
 */
export const retryCaseHistorySync = mutation({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (
    ctx,
    args
  ): Promise<
    | { success: boolean; jobId: Id<"pjnCaseHistorySyncJobs"> }
    | { success: boolean; error: string }
  > => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Ensure user has advanced access to retry sync
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "advanced");
    
    // Get the case to verify FRE exists
    const caseDoc = await ctx.db.get(args.caseId);
    if (!caseDoc) {
      return {
        success: false,
        error: "Case not found",
      };
    }
    
    if (!caseDoc.fre) {
      return {
        success: false,
        error: "Case has no FRE configured. Please add an FRE before syncing.",
      };
    }
    
    // Queue a new sync job
    const result = await ctx.runMutation(internal.pjn.trigger.queueCaseHistorySyncForCase, {
      caseId: args.caseId,
      userId: currentUser._id,
    });
    
    if ("skipped" in result) {
      return {
        success: false,
        error: result.reason,
      };
    }
    
    return {
      success: true,
      jobId: result.jobId,
    };
  },
});
