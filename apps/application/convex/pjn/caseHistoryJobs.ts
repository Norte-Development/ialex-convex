import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Internal mutation to create a new PJN case history sync job.
 * Returns the job ID or null if a job is already running/queued for this case.
 */
export const createJob = internalMutation({
  args: {
    caseId: v.id("cases"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<Id<"pjnCaseHistorySyncJobs"> | null> => {
    // Check if there's already a running or queued job for this case
    const existingJob = await ctx.db
      .query("pjnCaseHistorySyncJobs")
      .withIndex("by_case_and_status", (q) => q.eq("caseId", args.caseId))
      .filter((q) =>
        q.or(q.eq(q.field("status"), "queued"), q.eq(q.field("status"), "running"))
      )
      .first();

    if (existingJob) {
      console.log(
        `Job already exists for case ${String(args.caseId)} with status ${existingJob.status}`
      );
      return null; // Idempotency: don't create duplicate jobs
    }

    const now = Date.now();
    const jobId = await ctx.db.insert("pjnCaseHistorySyncJobs", {
      caseId: args.caseId,
      userId: args.userId,
      status: "queued",
      progressPercent: 0,
      retryAttempt: 0,
      createdAt: now,
      lastUpdatedAt: now,
    });

    console.log(`Created PJN sync job ${String(jobId)} for case ${String(args.caseId)}`);
    return jobId;
  },
});

/**
 * Internal mutation to update job progress and status.
 */
export const updateJobProgress = internalMutation({
  args: {
    jobId: v.id("pjnCaseHistorySyncJobs"),
    status: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("auth_required")
      )
    ),
    phase: v.optional(
      v.union(
        v.literal("connecting"),
        v.literal("fetching_history"),
        v.literal("ingesting_movements"),
        v.literal("ingesting_documents"),
        v.literal("finalizing")
      )
    ),
    progressPercent: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    movimientosProcessed: v.optional(v.number()),
    documentsProcessed: v.optional(v.number()),
    participantsProcessed: v.optional(v.number()),
    appealsProcessed: v.optional(v.number()),
    relatedCasesProcessed: v.optional(v.number()),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<null> => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      console.warn(`Job ${String(args.jobId)} not found for update`);
      return null;
    }

    const updates: Record<string, unknown> = {
      lastUpdatedAt: Date.now(),
    };

    if (args.status !== undefined) {
      updates.status = args.status;
      
      // Set timestamps based on status
      if (args.status === "running" && !job.startedAt) {
        updates.startedAt = Date.now();
      }
      
      if (
        args.status === "completed" ||
        args.status === "failed" ||
        args.status === "auth_required"
      ) {
        updates.finishedAt = Date.now();
        
        // Calculate duration if we have a start time
        if (job.startedAt) {
          updates.durationMs = Date.now() - job.startedAt;
        }
      }
    }

    if (args.phase !== undefined) updates.phase = args.phase;
    if (args.progressPercent !== undefined) updates.progressPercent = args.progressPercent;
    if (args.errorMessage !== undefined) updates.errorMessage = args.errorMessage;
    if (args.movimientosProcessed !== undefined)
      updates.movimientosProcessed = args.movimientosProcessed;
    if (args.documentsProcessed !== undefined)
      updates.documentsProcessed = args.documentsProcessed;
    if (args.participantsProcessed !== undefined)
      updates.participantsProcessed = args.participantsProcessed;
    if (args.appealsProcessed !== undefined)
      updates.appealsProcessed = args.appealsProcessed;
    if (args.relatedCasesProcessed !== undefined)
      updates.relatedCasesProcessed = args.relatedCasesProcessed;
    if (args.durationMs !== undefined) updates.durationMs = args.durationMs;

    await ctx.db.patch(args.jobId, updates);
    
    console.log(
      `Updated job ${String(args.jobId)}: status=${args.status ?? job.status}, phase=${args.phase}, progress=${args.progressPercent}%`
    );
    
    return null;
  },
});

/**
 * Internal query to get the latest sync job for a case.
 */
export const getLatestJobForCase = internalQuery({
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
    // Get all jobs for this case, sorted by creation time (newest first)
    const jobs = await ctx.db
      .query("pjnCaseHistorySyncJobs")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .order("desc")
      .take(1);

    return jobs[0] ?? null;
  },
});

/**
 * Internal mutation to increment retry attempt counter for a job.
 */
export const incrementRetryAttempt = internalMutation({
  args: {
    jobId: v.id("pjnCaseHistorySyncJobs"),
  },
  handler: async (ctx, args): Promise<number> => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error(`Job ${String(args.jobId)} not found`);
    }

    const newRetryCount = (job.retryAttempt ?? 0) + 1;
    
    await ctx.db.patch(args.jobId, {
      retryAttempt: newRetryCount,
      lastUpdatedAt: Date.now(),
    });

    return newRetryCount;
  },
});
