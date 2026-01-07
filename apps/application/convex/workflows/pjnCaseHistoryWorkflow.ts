
import { v } from "convex/values";
import { WorkflowManager } from "@convex-dev/workflow";
import { components, internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

const MAX_RETRY_ATTEMPTS = 3;

const workflow = new WorkflowManager(components.workflow);

type SyncResult =
  | {
      status: "completed";
      movimientosSynced: number;
      documentsSynced: number;
      participantsSynced: number;
      appealsSynced: number;
      relatedCasesSynced: number;
    }
  | {
      status: "failed";
      error: string;
    }
  | {
      status: "auth_required";
      reason: string;
    };

/**
 * PJN Case History Sync Workflow
 * 
 * This workflow orchestrates the long-running sync of PJN case history data.
 * It manages progress tracking, error handling, and retry logic.
 */
export const startPjnCaseHistorySync = workflow.define({
  args: {
    caseId: v.id("cases"),
    userId: v.id("users"),
    jobId: v.id("pjnCaseHistorySyncJobs"),
  },
  handler: async (step, args): Promise<SyncResult> => {
    const { caseId, userId, jobId } = args;

    try {
      // Update job status to "running" and set phase to "connecting"
      await step.runMutation(internal.pjn.caseHistoryJobs.updateJobProgress, {
        jobId,
        status: "running",
        phase: "connecting",
        progressPercent: 0,
      });

      // Phase 1: Connecting (0-10%)
      await step.runMutation(internal.pjn.caseHistoryJobs.updateJobProgress, {
        jobId,
        phase: "fetching_history",
        progressPercent: 10,
      });

      // Call the existing syncCaseHistoryForCase action to perform the actual sync
      // This action handles authentication, scraping, and returns structured results
      const syncResult = await step.runAction(
        internal.pjn.caseHistory.syncCaseHistoryForCaseInternal,
        {
          caseId,
          userId,
          jobId,
        }
      );

      // Handle the sync result
      if (syncResult.status === "AUTH_REQUIRED") {
        await step.runMutation(internal.pjn.caseHistoryJobs.updateJobProgress, {
          jobId,
          status: "auth_required",
          errorMessage: syncResult.reason,
          progressPercent: 0,
        });

        return {
          status: "auth_required" as const,
          reason: syncResult.reason,
        };
      }

      if (syncResult.status === "ERROR") {
        // Update job status to failed
        await step.runMutation(internal.pjn.caseHistoryJobs.updateJobProgress, {
          jobId,
          status: "failed",
          errorMessage: syncResult.error,
          progressPercent: 0,
        });

        return {
          status: "failed" as const,
          error: syncResult.error,
        };
      }

      // Sync succeeded
      if (syncResult.status === "OK") {
        // Phase 5: Finalizing (90-100%)
        await step.runMutation(internal.pjn.caseHistoryJobs.updateJobProgress, {
          jobId,
          phase: "finalizing",
          progressPercent: 90,
        });

        // Update job with final stats
        await step.runMutation(internal.pjn.caseHistoryJobs.updateJobProgress, {
          jobId,
          status: "completed",
          progressPercent: 100,
          movimientosProcessed: syncResult.movimientosSynced,
          documentsProcessed: syncResult.documentsSynced,
          participantsProcessed: syncResult.participantsSynced,
          appealsProcessed: syncResult.appealsSynced,
          relatedCasesProcessed: syncResult.relatedCasesSynced,
        });

        // Log successful sync to PJN activity log
        await step.runMutation(internal.pjn.sync.logPjnActivity, {
          userId,
          caseId,
          action: "pjn_case_history_sync_completed",
          metadata: {
            movimientosSynced: syncResult.movimientosSynced,
            documentsSynced: syncResult.documentsSynced,
            participantsSynced: syncResult.participantsSynced,
            appealsSynced: syncResult.appealsSynced,
            relatedCasesSynced: syncResult.relatedCasesSynced,
            jobId: jobId as string,
          },
        });

        return {
          status: "completed" as const,
          movimientosSynced: syncResult.movimientosSynced,
          documentsSynced: syncResult.documentsSynced,
          participantsSynced: syncResult.participantsSynced,
          appealsSynced: syncResult.appealsSynced,
          relatedCasesSynced: syncResult.relatedCasesSynced,
        };
      }

      // Unexpected status
      throw new Error(`Unexpected sync result status: ${(syncResult as { status: string }).status}`);
    } catch (error) {
      console.error(`Workflow error for case ${String(caseId)}:`, error);

      await step.runMutation(internal.pjn.caseHistoryJobs.updateJobProgress, {
        jobId,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown workflow error",
      });

      return {
        status: "failed" as const,
        error: error instanceof Error ? error.message : "Unknown workflow error",
      };
    }
  },
});

/**
 * Starter function to initiate the PJN case history sync workflow.
 * This is called by the scheduler from the trigger mutation.
 */
export const startWorkflow = internalAction({
  args: {
    caseId: v.id("cases"),
    userId: v.id("users"),
    jobId: v.id("pjnCaseHistorySyncJobs"),
  },
  handler: async (ctx, args): Promise<null> => {
    await workflow.start(
      ctx,
      internal.workflows.pjnCaseHistoryWorkflow.startPjnCaseHistorySync,
      {
        caseId: args.caseId,
        userId: args.userId,
        jobId: args.jobId,
      }
    );
    return null;
  },
});
