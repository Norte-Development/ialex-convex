
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
    syncProfile: v.optional(
      v.object({
        maxMovements: v.optional(v.number()),
        includeIntervinientes: v.optional(v.boolean()),
        includeVinculados: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (step, args): Promise<SyncResult> => {
    const { caseId, userId, jobId, syncProfile } = args;

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
          syncProfile,
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
        // Phase 5: Download PDFs (80-90%)
        await step.runMutation(internal.pjn.caseHistoryJobs.updateJobProgress, {
          jobId,
          phase: "downloading_pdfs",
          progressPercent: 80,
        });

        // Download PDFs in batches
        const PDF_BATCH_SIZE = 5;
        const MAX_PDF_BATCHES = 10; // Limit to prevent infinite loops
        let pdfsDownloaded = 0;
        let pdfsFailed = 0;
        let batchCount = 0;
        
        // eslint-disable-next-line no-constant-condition
        while (batchCount < MAX_PDF_BATCHES) {
          batchCount++;
          
          const pdfResult = await step.runAction(
            internal.pjn.caseHistory.syncPdfsForCaseInternal,
            {
              caseId,
              userId,
              batchSize: PDF_BATCH_SIZE,
            }
          );

          if (pdfResult.status === "OK") {
            pdfsDownloaded += pdfResult.downloaded;
            pdfsFailed += pdfResult.failed;

            // If no more PDFs to download, we're done
            if (pdfResult.remaining === 0) {
              break;
            }

            // Update progress based on remaining PDFs
            const progressIncrement = Math.min(
              (pdfResult.downloaded / (pdfResult.downloaded + pdfResult.remaining)) * 10,
              10
            );
            await step.runMutation(internal.pjn.caseHistoryJobs.updateJobProgress, {
              jobId,
              progressPercent: Math.min(80 + progressIncrement, 90),
            });
          } else {
            // PDF sync failed or needs auth - log but don't fail the entire workflow
            console.warn(
              `PDF sync batch ${batchCount} failed for case ${String(caseId)}:`,
              pdfResult.status === "ERROR" ? pdfResult.error : pdfResult.reason
            );
            break;
          }
        }

        console.log(
          `PDF sync completed for case ${String(caseId)}: ${pdfsDownloaded} downloaded, ${pdfsFailed} failed, ${batchCount} batches`
        );

        // Phase 6: Finalizing (90-100%)
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
          documentsProcessed: syncResult.documentsSynced + pdfsDownloaded,
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
            pdfsDownloaded,
            pdfsFailed,
            participantsSynced: syncResult.participantsSynced,
            appealsSynced: syncResult.appealsSynced,
            relatedCasesSynced: syncResult.relatedCasesSynced,
            jobId: jobId as string,
          },
        });

        return {
          status: "completed" as const,
          movimientosSynced: syncResult.movimientosSynced,
          documentsSynced: syncResult.documentsSynced + pdfsDownloaded,
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
    syncProfile: v.optional(
      v.object({
        maxMovements: v.optional(v.number()),
        includeIntervinientes: v.optional(v.boolean()),
        includeVinculados: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (ctx, args): Promise<null> => {
    await workflow.start(
      ctx,
      internal.workflows.pjnCaseHistoryWorkflow.startPjnCaseHistorySync,
      {
        caseId: args.caseId,
        userId: args.userId,
        jobId: args.jobId,
        syncProfile: args.syncProfile,
      }
    );
    return null;
  },
});
