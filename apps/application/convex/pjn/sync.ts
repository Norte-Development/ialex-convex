import { v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

/**
 * Sync notifications for a single user
 */
export const syncNotificationsForUser = internalAction({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<
    | { skipped: true; reason: "needs_reauth" | "no_account" | "auth_required" }
    | { success: true; eventsProcessed: number; stats: { fetchedPages: number; newEvents: number } }
  > => {
    const scraperUrl = process.env.PJN_SCRAPER_URL;
    if (!scraperUrl) {
      throw new Error("PJN_SCRAPER_URL environment variable is not set");
    }

    const serviceAuthSecret = process.env.SERVICE_AUTH_SECRET;
    if (!serviceAuthSecret) {
      throw new Error("SERVICE_AUTH_SECRET environment variable is not set");
    }

    // Get account info
    const account: Array<{
      accountId: string;
      userId: Id<"users">;
      username: string;
      lastSyncedAt: number | undefined;
      lastEventId: string | undefined;
      needsReauth: boolean | undefined;
    }> = await ctx.runQuery(internal.pjn.accounts.listActiveAccounts);
    const userAccount = account.find((a) => a.userId === args.userId);
    if (!userAccount || userAccount.needsReauth) {
      console.log(`Skipping sync for user ${args.userId}: no account or needs reauth`);
      return { skipped: true, reason: userAccount?.needsReauth ? "needs_reauth" : "no_account" };
    }

    // Prepare request
    const requestBody: {
      userId: string;
      since?: string;
      lastEventId?: string;
    } = {
      userId: args.userId as string,
    };

    if (userAccount.lastSyncedAt) {
      const sinceDate = new Date(userAccount.lastSyncedAt);
      requestBody.since = sinceDate.toISOString();
    }
    if (userAccount.lastEventId) {
      requestBody.lastEventId = userAccount.lastEventId;
    }

    try {
      // Call scraper service
      const response = await fetch(`${scraperUrl}/scrape/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Auth": serviceAuthSecret,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Scraper returned ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      if (result.status === "AUTH_REQUIRED") {
        // Mark account as needing reauth
        await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
          userId: args.userId,
          reason: result.reason || "Session expired",
        });
        return { skipped: true, reason: "auth_required" };
      }

      if (result.status === "ERROR") {
        throw new Error(result.error || "Unknown error from scraper");
      }

      if (result.status === "OK") {
        // Process events
        const events = result.events || [];
        let lastEventId: string | undefined;

        for (const event of events) {
          // Create activity log entry
          await ctx.runMutation(internal.pjn.sync.createActivityLogEntry, {
            userId: args.userId,
            event,
          });

          // Create or update document entry
          if (event.gcsPath) {
            await ctx.runMutation(internal.pjn.sync.createDocumentEntry, {
              userId: args.userId,
              event,
            });
          }

          lastEventId = event.pjnEventId;
        }

        // Update sync status
        await ctx.runMutation(internal.pjn.accounts.updateSyncStatus, {
          userId: args.userId,
          lastEventId,
          lastSyncedAt: Date.now(),
        });

        return {
          success: true,
          eventsProcessed: events.length,
          stats: result.stats,
        };
      }

      throw new Error(`Unexpected response status: ${result.status}`);
    } catch (error) {
      console.error(`Sync failed for user ${args.userId}:`, error);
      await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
        userId: args.userId,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  },
});

/**
 * Create activity log entry for a PJN event
 */
export const createActivityLogEntry = internalMutation({
  args: {
    userId: v.id("users"),
    event: v.object({
      pjnEventId: v.string(),
      fre: v.union(v.string(), v.null()),
      timestamp: v.string(),
      category: v.string(),
      description: v.string(),
      gcsPath: v.optional(v.string()),
      rawPayload: v.any(),
    }),
  },
  handler: async (ctx, args): Promise<void> => {
    // Try to find case by FRE
    let caseId: string | undefined;
    if (args.event.fre) {
      const caseMatch = await ctx.db
        .query("cases")
        .withIndex("by_fre", (q) => q.eq("fre", args.event.fre!))
        .first();
      if (caseMatch) {
        caseId = caseMatch._id;
      }
    }

    await ctx.db.insert("pjnActivityLog", {
      userId: args.userId,
      caseId: caseId as any,
      action: "pjn_notification_received",
      source: "PJN-Portal",
      pjnEventId: args.event.pjnEventId,
      metadata: {
        fre: args.event.fre,
        category: args.event.category,
        description: args.event.description,
        gcsPath: args.event.gcsPath,
        rawPayload: args.event.rawPayload,
      },
      timestamp: new Date(args.event.timestamp).getTime() || Date.now(),
    });
  },
});

/**
 * Create document entry for a PJN PDF
 */
export const createDocumentEntry = internalMutation({
  args: {
    userId: v.id("users"),
    event: v.object({
      pjnEventId: v.string(),
      fre: v.union(v.string(), v.null()),
      timestamp: v.string(),
      category: v.string(),
      description: v.string(),
      gcsPath: v.optional(v.string()),
      rawPayload: v.any(),
    }),
  },
  handler: async (ctx, args): Promise<void> => {
    if (!args.event.gcsPath) {
      return;
    }

    // Parse GCS path: gs://bucket/path/to/file.pdf
    const gcsMatch = args.event.gcsPath.match(/^gs:\/\/([^\/]+)\/(.+)$/);
    if (!gcsMatch) {
      console.error("Invalid GCS path format:", args.event.gcsPath);
      return;
    }

    const [, bucket, objectPath] = gcsMatch;

    // Try to find case by FRE
    let caseId: string | undefined;
    if (args.event.fre) {
      const caseMatch = await ctx.db
        .query("cases")
        .withIndex("by_fre", (q) => q.eq("fre", args.event.fre!))
        .first();
      if (caseMatch) {
        caseId = caseMatch._id;
      }
    }

    // If no case found, we still create the document but without caseId
    // It can be linked later when the case is created

    // Check if document already exists
    const existing = await ctx.db
      .query("documents")
      .withIndex("by_gcs_object", (q) => q.eq("gcsObject", objectPath))
      .first();

    if (existing) {
      // Document already exists, skip creation
      return;
    }

    // Create new document
    const documentId = await ctx.db.insert("documents", {
      title: `PJN Notification - ${args.event.pjnEventId}`,
      description: args.event.description,
      caseId: caseId as any,
      documentType: "court_filing",
      storageBackend: "gcs",
      gcsBucket: bucket,
      gcsObject: objectPath,
      originalFileName: `pjn-event-${args.event.pjnEventId}.pdf`,
      mimeType: "application/pdf",
      fileSize: 0, // Will be updated by document-processor
      createdBy: args.userId,
      processingStatus: "pending",
      // Store PJN metadata
      tags: ["PJN-Portal", args.event.category],
    });

    // Enqueue document for processing using the standard document pipeline
    await ctx.scheduler.runAfter(
      0,
      internal.functions.documentProcessing.processDocument,
      {
        documentId,
      },
    );
  },
});
