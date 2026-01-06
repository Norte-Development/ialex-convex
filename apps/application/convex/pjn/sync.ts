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

    const serviceAuthSecret = process.env.EXPEDIENTES_SCRAPER_SECRET;
    if (!serviceAuthSecret) {
      throw new Error("EXPEDIENTES_SCRAPER_SECRET environment variable is not set");
    }

    const attemptAutomaticReauth = async (): Promise<
      "ok" | "auth_failed" | "error" | "no_credentials"
    > => {
      // Get decrypted credentials
      const credentials = await ctx.runQuery(internal.pjn.accounts.getDecryptedPassword, {
        userId: args.userId,
      });

      if (!credentials) {
        console.log(
          `No stored credentials found for user ${args.userId}, manual reauth required`,
        );
        return "no_credentials";
      }

      try {
        const reauthResponse = await fetch(`${scraperUrl}/reauth`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Service-Auth": serviceAuthSecret,
          },
          body: JSON.stringify({
            userId: args.userId as string,
            username: credentials.username,
            password: credentials.password,
          }),
        });

        if (!reauthResponse.ok) {
          const errorText = await reauthResponse.text();
          console.error(
            `Reauth failed for user ${args.userId}: ${reauthResponse.status} - ${errorText}`,
          );
          await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
            userId: args.userId,
            reason: `Scraper returned ${reauthResponse.status}`,
          });
          return "error";
        }

        const reauthResult = (await reauthResponse.json()) as {
          status: string;
          reason?: string;
          error?: string;
        };

        if (reauthResult.status === "AUTH_FAILED") {
          const reason =
            reauthResult.reason && typeof reauthResult.reason === "string"
              ? reauthResult.reason
              : "Invalid credentials";

          console.log(
            `Automatic reauth failed for user ${args.userId}: ${reason}`,
          );
          await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
            userId: args.userId,
            reason,
          });
          return "auth_failed";
        }

        if (reauthResult.status === "ERROR") {
          const errorMessage =
            reauthResult.error && typeof reauthResult.error === "string"
              ? reauthResult.error
              : "Unknown error";

          console.error(
            `Reauth error for user ${args.userId}: ${errorMessage}`,
          );
          await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
            userId: args.userId,
            reason: errorMessage,
          });
          return "error";
        }

        if (reauthResult.status === "OK") {
          console.log(`Automatic reauth succeeded for user ${args.userId}`);
          await ctx.runMutation(internal.pjn.accounts.clearNeedsReauth, {
            userId: args.userId,
          });
          return "ok";
        }

        console.warn(
          `Unexpected reauth status for user ${args.userId}: ${reauthResult.status}`,
        );
        await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
          userId: args.userId,
          reason: `Unexpected reauth status: ${reauthResult.status}`,
        });
        return "error";
      } catch (error) {
        console.error(`Reauth request failed for user ${args.userId}:`, error);
        await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
          userId: args.userId,
          reason:
            error instanceof Error ? error.message : "Automatic reauth failed",
        });
        return "error";
      }
    };

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
    
    if (!userAccount) {
      console.log(`Skipping sync for user ${args.userId}: no account`);
      return { skipped: true, reason: "no_account" };
    }

    // If account is already marked as needing reauth, attempt automatic reauth using stored credentials
    if (userAccount.needsReauth) {
      console.log(`Attempting automatic reauth for user ${args.userId}`);
      const reauthResult = await attemptAutomaticReauth();
      if (reauthResult !== "ok") {
        // Reauth with stored credentials failed or is not possible, require manual reauth
        return { skipped: true, reason: "needs_reauth" };
      }
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
      const fetchAndProcessEvents = async (): Promise<{
        kind: "ok" | "auth_required";
        eventsProcessed?: number;
        stats?: { fetchedPages: number; newEvents: number };
      }> => {
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
          return { kind: "auth_required" };
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
            const activityLogResult = await ctx.runMutation(
              internal.pjn.sync.createActivityLogEntry,
              {
                userId: args.userId,
                event,
              },
            );

            // Create or update document entry
            if (event.gcsPath) {
              await ctx.runMutation(internal.pjn.sync.createDocumentEntry, {
                userId: args.userId,
                event,
              });
            }

            // Create user-facing notification for this PJN event
            await ctx.runMutation(internal.notifications.createForUser, {
              userId: args.userId,
              kind: "pjn_notification",
              title: event.fre
                ? `Nueva notificación PJN - ${event.fre}`
                : "Nueva notificación PJN",
              bodyPreview:
                event.description ||
                event.category ||
                "Nueva notificación del portal PJN",
              source: "PJN-Portal",
              caseId: activityLogResult?.caseId,
              pjnEventId: event.pjnEventId,
              linkTarget: activityLogResult?.caseId
                ? `/cases/${activityLogResult.caseId}`
                : undefined,
            });

            lastEventId = event.pjnEventId;
          }

          // Update sync status
          await ctx.runMutation(internal.pjn.accounts.updateSyncStatus, {
            userId: args.userId,
            lastEventId,
            lastSyncedAt: Date.now(),
          });

          return {
            kind: "ok",
            eventsProcessed: events.length,
            stats: result.stats,
          };
        }

        throw new Error(`Unexpected response status: ${result.status}`);
      };

      // First attempt to fetch and process events with the current session
      let eventsResult = await fetchAndProcessEvents();

      if (eventsResult.kind === "auth_required") {
        // Session is expired or invalid. Attempt automatic reauth using stored credentials.
        console.log(
          `Session expired or invalid for user ${args.userId}, attempting automatic reauth before skipping`,
        );

        const reauthResult = await attemptAutomaticReauth();

        if (reauthResult !== "ok") {
          // Automatic reauth failed (invalid credentials, error, or missing credentials).
          // At this point the account is already marked as needsReauth inside attemptAutomaticReauth.
          return { skipped: true, reason: "auth_required" };
        }

        // Reauth succeeded; retry fetching and processing events once
        eventsResult = await fetchAndProcessEvents();

        if (eventsResult.kind === "auth_required") {
          // Still auth required after a successful reauth; treat as needsReauth and skip.
          await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
            userId: args.userId,
            reason: "Session still invalid after automatic reauth",
          });
          return { skipped: true, reason: "auth_required" };
        }
      }

      return {
        success: true,
        eventsProcessed: eventsResult.eventsProcessed ?? 0,
        stats: eventsResult.stats ?? { fetchedPages: 0, newEvents: 0 },
      };
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
 * Returns the caseId if found, for use in notification creation
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
  handler: async (ctx, args): Promise<{ caseId: Id<"cases"> | undefined }> => {
    // Try to find case by FRE
    let caseId: Id<"cases"> | undefined;
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

    return { caseId };
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

    if (!caseId) {
      console.log(
        "Skipping PJN document creation because no matching case was found for event",
        {
          userId: args.userId,
          pjnEventId: args.event.pjnEventId,
          fre: args.event.fre,
        },
      );
      return;
    }

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

/**
 * Create activity log entry for a PJN docket movement (historical case history).
 * Uses the already-known caseId from the sync action for reliable association.
 */
export const createDocketMovementEntry = internalMutation({
  args: {
    userId: v.id("users"),
    caseId: v.id("cases"),
    movement: v.object({
      movementId: v.string(),
      fre: v.union(v.string(), v.null()),
      date: v.string(),
      description: v.string(),
      hasDocument: v.boolean(),
      documentSource: v.optional(
        v.union(v.literal("actuaciones"), v.literal("doc_digitales")),
      ),
      docRef: v.optional(v.union(v.string(), v.null())),
      gcsPath: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args): Promise<void> => {
    const timestamp =
      new Date(args.movement.date).getTime() || Date.now();

    await ctx.db.insert("pjnActivityLog", {
      userId: args.userId,
      caseId: args.caseId as any,
      action: "pjn_docket_movement",
      source: "PJN-Portal",
      pjnMovementId: args.movement.movementId,
      metadata: {
        fre: args.movement.fre,
        date: args.movement.date,
        description: args.movement.description,
        hasDocument: args.movement.hasDocument,
        documentSource: args.movement.documentSource,
        docRef: args.movement.docRef,
        gcsPath: args.movement.gcsPath,
      },
      timestamp,
    });
  },
});

/**
 * Create or update a document entry for a PJN historical docket PDF and
 * record the corresponding activity log entry.
 */
export const createHistoricalDocumentEntry = internalMutation({
  args: {
    userId: v.id("users"),
    caseId: v.id("cases"),
    document: v.object({
      docId: v.string(),
      fre: v.union(v.string(), v.null()),
      date: v.string(),
      description: v.string(),
      source: v.union(
        v.literal("actuaciones"),
        v.literal("doc_digitales"),
      ),
      gcsPath: v.optional(v.string()),
      docRef: v.optional(v.union(v.string(), v.null())),
    }),
  },
  handler: async (ctx, args): Promise<void> => {
    const { document } = args;

    const timestamp =
      new Date(document.date).getTime() || Date.now();

    // If there is no stored PDF for this document, we still want an
    // activity log entry but we cannot create a file-backed document.
    if (!document.gcsPath) {
      await ctx.db.insert("pjnActivityLog", {
        userId: args.userId,
        caseId: args.caseId as any,
        action: "pjn_historical_document",
        source: "PJN-Portal",
        pjnMovementId: document.docId,
        metadata: {
          fre: document.fre,
          date: document.date,
          description: document.description,
          source: document.source,
          docRef: document.docRef,
          gcsPath: document.gcsPath,
        },
        timestamp,
      });
      return;
    }

    // Parse GCS path: gs://bucket/path/to/file.pdf
    const gcsMatch = document.gcsPath.match(/^gs:\/\/([^\/]+)\/(.+)$/);
    if (!gcsMatch) {
      console.error(
        "Invalid GCS path format for historical document:",
        document.gcsPath,
      );
      return;
    }

    const [, bucket, objectPath] = gcsMatch;

    // Idempotency: check if a document already exists for this GCS object.
    const existing = await ctx.db
      .query("documents")
      .withIndex("by_gcs_object", (q) => q.eq("gcsObject", objectPath))
      .first();

    let documentId: Id<"documents">;
    if (existing) {
      documentId = existing._id;
    } else {
      documentId = await ctx.db.insert("documents", {
        title: document.description || `PJN Docket - ${document.docId}`,
        description: document.description,
        caseId: args.caseId as any,
        documentType: "court_filing",
        storageBackend: "gcs",
        gcsBucket: bucket,
        gcsObject: objectPath,
        originalFileName: `pjn-doc-${document.docId}.pdf`,
        mimeType: "application/pdf",
        fileSize: 0, // Will be updated by document-processor
        createdBy: args.userId,
        processingStatus: "pending",
        tags: ["PJN-Portal", "historical"],
      });

      // Enqueue document for processing using the standard document pipeline
      await ctx.scheduler.runAfter(
        0,
        internal.functions.documentProcessing.processDocument,
        {
          documentId,
        },
      );
    }

    // Record the corresponding activity log entry
    await ctx.db.insert("pjnActivityLog", {
      userId: args.userId,
      caseId: args.caseId as any,
      action: "pjn_historical_document",
      source: "PJN-Portal",
      pjnMovementId: document.docId,
      metadata: {
        fre: document.fre,
        date: document.date,
        description: document.description,
        source: document.source,
        gcsPath: document.gcsPath,
        docRef: document.docRef,
        documentId,
      },
      timestamp,
    });
  },
});

/**
 * Create participant entry from PJN Intervinientes tab.
 */
export const createParticipantEntry = internalMutation({
  args: {
    caseId: v.id("cases"),
    participant: v.object({
      participantId: v.string(),
      role: v.string(),
      name: v.string(),
      details: v.optional(v.string()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    // Idempotency check
    const existing = await ctx.db
      .query("caseParticipants")
      .withIndex("by_pjn_id", (q) => q.eq("pjnParticipantId", args.participant.participantId))
      .first();

    if (existing) return null;

    await ctx.db.insert("caseParticipants", {
      caseId: args.caseId,
      role: args.participant.role,
      name: args.participant.name,
      details: args.participant.details,
      pjnParticipantId: args.participant.participantId,
      syncedFrom: "pjn",
      syncedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Create appeal entry from PJN Recursos tab.
 */
export const createAppealEntry = internalMutation({
  args: {
    caseId: v.id("cases"),
    appeal: v.object({
      appealId: v.string(),
      appealType: v.string(),
      filedDate: v.optional(v.string()),
      status: v.optional(v.string()),
      court: v.optional(v.string()),
      description: v.optional(v.string()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    // Idempotency check
    const existing = await ctx.db
      .query("caseAppeals")
      .withIndex("by_pjn_id", (q) => q.eq("pjnAppealId", args.appeal.appealId))
      .first();

    if (existing) return null;

    await ctx.db.insert("caseAppeals", {
      caseId: args.caseId,
      appealType: args.appeal.appealType,
      filedDate: args.appeal.filedDate,
      status: args.appeal.status,
      court: args.appeal.court,
      description: args.appeal.description,
      pjnAppealId: args.appeal.appealId,
      syncedFrom: "pjn",
      syncedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Create related case entry from PJN Vinculados tab.
 */
export const createRelatedCaseEntry = internalMutation({
  args: {
    caseId: v.id("cases"),
    relatedCase: v.object({
      relationId: v.string(),
      relatedFre: v.string(),
      relationshipType: v.string(),
      relatedCaratula: v.optional(v.string()),
      relatedCourt: v.optional(v.string()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    // Idempotency check
    const existing = await ctx.db
      .query("relatedCases")
      .withIndex("by_pjn_id", (q) => q.eq("pjnRelationId", args.relatedCase.relationId))
      .first();

    if (existing) return null;

    // Try to find linked case in our DB
    const linkedCase = await ctx.db
      .query("cases")
      .withIndex("by_fre", (q) => q.eq("fre", args.relatedCase.relatedFre))
      .first();

    await ctx.db.insert("relatedCases", {
      caseId: args.caseId,
      relatedFre: args.relatedCase.relatedFre,
      relationshipType: args.relatedCase.relationshipType,
      relatedCaratula: args.relatedCase.relatedCaratula,
      relatedCourt: args.relatedCase.relatedCourt,
      pjnRelationId: args.relatedCase.relationId,
      relatedCaseId: linkedCase?._id,
      syncedFrom: "pjn",
      syncedAt: Date.now(),
    });
    return null;
  },
});
