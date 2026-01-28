import { v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id, Doc } from "../_generated/dataModel";
import { extractIejpFromDetails, parseIejpValue } from "../utils/identifierParser";
import { pjnNotificationTemplate } from "../services/emailTemplates";

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
          const caseIdsToSync = new Set<Id<"cases">>();

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
            const notificationId = await ctx.runMutation(internal.notifications.createForUser, {
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
            
            // Send email notification if enabled
            if (notificationId) {
              const user = await ctx.runQuery(internal.functions.users.getUserByIdInternal, {
                userId: args.userId,
              });
              
              if (user) {
                const htmlBody = pjnNotificationTemplate(
                  event.fre,
                  event.category,
                  event.description || event.category || "Nueva notificación del portal PJN",
                  user.name,
                  activityLogResult?.caseId ? `/cases/${activityLogResult.caseId}` : undefined,
                );
                
                await ctx.runMutation(
                  internal.services.notificationService.sendNotificationIfEnabled,
                  {
                    userId: args.userId,
                    notificationType: "pjnNotification",
                    subject: event.fre
                      ? `Nueva notificación PJN - ${event.fre}`
                      : "Nueva notificación PJN",
                    htmlBody,
                  },
                );
              }
            }
            
            if (notificationId && activityLogResult?.caseId) {
              caseIdsToSync.add(activityLogResult.caseId);
            }

            lastEventId = event.pjnEventId;
          }

          // Update sync status
          await ctx.runMutation(internal.pjn.accounts.updateSyncStatus, {
            userId: args.userId,
            lastEventId,
            lastSyncedAt: Date.now(),
          });
          
          for (const caseId of caseIdsToSync) {
            await ctx.runMutation(internal.pjn.trigger.queueCaseHistorySyncForCase, {
              caseId,
              userId: args.userId,
              syncProfile: {
                maxMovements: 5,
                includeIntervinientes: false,
                includeVinculados: false,
              },
            });
          }

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
 * Shared helper to create or get a PJN document from GCS path.
 * Returns the documentId if successful, null otherwise.
 */
async function createOrGetPjnDocument(
  ctx: any, // Using any to avoid complex type inference issues with MutationCtx
  params: {
    gcsPath: string;
    caseId: Id<"cases">;
    userId: Id<"users">;
    title: string;
    description: string;
    originalFileName: string;
    tags: string[];
  },
): Promise<Id<"documents"> | null> {
  // Parse GCS path: gs://bucket/path/to/file.pdf
  const gcsMatch = params.gcsPath.match(/^gs:\/\/([^\/]+)\/(.+)$/);
  if (!gcsMatch) {
    console.error("Invalid GCS path format:", params.gcsPath);
    return null;
  }

  const [, bucket, objectPath] = gcsMatch;

  // Check if document already exists for THIS case (idempotency per case)
  // This allows the same GCS object to be referenced by multiple cases,
  // each with their own document row, while avoiding duplicates within a case.
  const existing = await ctx.db
    .query("documents")
    .withIndex("by_case_and_gcs_object", (q: any) =>
      q.eq("caseId", params.caseId).eq("gcsObject", objectPath)
    )
    .first();

  if (existing) {
    // Document already exists for this case, return existing ID
    return existing._id;
  }

  // Create new document
  const documentId = await ctx.db.insert("documents", {
    title: params.title,
    description: params.description,
    caseId: params.caseId,
    documentType: "court_filing",
    storageBackend: "gcs",
    gcsBucket: bucket,
    gcsObject: objectPath,
    originalFileName: params.originalFileName,
    mimeType: "application/pdf",
    fileSize: 0, // Will be updated by document-processor
    createdBy: params.userId,
    processingStatus: "pending",
    tags: params.tags,
  });

  // Enqueue document for processing using the standard document pipeline
  await ctx.scheduler.runAfter(
    0,
    internal.functions.documentProcessing.processDocument,
    {
      documentId,
    },
  );

  return documentId;
}

/**
 * Create document entry for a PJN PDF (from notifications)
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

    await createOrGetPjnDocument(ctx as any, {
      gcsPath: args.event.gcsPath,
      caseId,
      userId: args.userId,
      title: `PJN Notification - ${args.event.pjnEventId}`,
      description: args.event.description,
      originalFileName: `pjn-event-${args.event.pjnEventId}.pdf`,
      tags: ["PJN-Portal", args.event.category],
    });
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
 * Upsert an actuación entry into the caseActuaciones table.
 * Uses pjnMovementId + caseId for idempotency.
 * If the movement has a gcsPath, also creates/links the document
 * to ensure all PJN documents are available as first-class documents.
 */
export const upsertActuacion = internalMutation({
  args: {
    caseId: v.id("cases"),
    userId: v.id("users"),
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
    const movementDate = new Date(args.movement.date).getTime() || Date.now();

    const existing = await ctx.db
      .query("caseActuaciones")
      .withIndex("by_case_and_pjn_id", (q) =>
        q.eq("caseId", args.caseId).eq("pjnMovementId", args.movement.movementId)
      )
      .first();

    // If movement has a document (gcsPath), create or get the document
    // This ensures movements with documents are processed even if they
    // don't appear in docDigitales
    let documentId: Id<"documents"> | undefined = existing?.documentId;
    if (args.movement.gcsPath && !documentId) {
      const createdDocId = await createOrGetPjnDocument(ctx as any, {
        gcsPath: args.movement.gcsPath,
        caseId: args.caseId,
        userId: args.userId,
        title: args.movement.description || `PJN Movement - ${args.movement.movementId}`,
        description: args.movement.description,
        originalFileName: `pjn-movement-${args.movement.movementId}.pdf`,
        tags: ["PJN-Portal", "historical", args.movement.documentSource || "actuaciones"],
      });
      if (createdDocId) {
        documentId = createdDocId;
      }
    }

    const actuacionData = {
      caseId: args.caseId,
      fre: args.movement.fre ?? undefined,
      pjnMovementId: args.movement.movementId,
      movementDate,
      rawDate: args.movement.date,
      description: args.movement.description,
      hasDocument: args.movement.hasDocument,
      documentSource: args.movement.documentSource,
      docRef: args.movement.docRef ?? undefined,
      gcsPath: args.movement.gcsPath,
      documentId, // Set documentId as the canonical reference
      origin: "history_sync" as const,
      syncedFrom: "pjn" as const,
      syncedAt: Date.now(),
    };

    if (existing) {
      // Preserve existing documentId if we didn't create a new one
      const patchData = {
        ...actuacionData,
        documentId: documentId ?? existing.documentId,
      };
      await ctx.db.patch(existing._id, patchData);
    } else {
      await ctx.db.insert("caseActuaciones", actuacionData);
    }
  },
});

/**
 * Update an actuacion's gcsPath and create the associated document.
 * This is used when PDFs are downloaded in a separate step after the initial sync.
 * Returns the created documentId if successful.
 */
export const updateActuacionWithDocument = internalMutation({
  args: {
    actuacionId: v.id("caseActuaciones"),
    userId: v.id("users"),
    gcsPath: v.string(),
  },
  handler: async (ctx, args): Promise<{ documentId: Id<"documents"> | null }> => {
    const actuacion = await ctx.db.get(args.actuacionId);
    if (!actuacion) {
      console.error("Actuacion not found:", args.actuacionId);
      return { documentId: null };
    }

    // If already has a document, just update gcsPath
    if (actuacion.documentId) {
      await ctx.db.patch(args.actuacionId, {
        gcsPath: args.gcsPath,
      });
      return { documentId: actuacion.documentId };
    }

    // Create the document using the shared helper
    const documentId = await createOrGetPjnDocument(ctx as any, {
      gcsPath: args.gcsPath,
      caseId: actuacion.caseId,
      userId: args.userId,
      title: actuacion.description || `PJN Movement - ${actuacion.pjnMovementId}`,
      description: actuacion.description,
      originalFileName: `pjn-movement-${actuacion.pjnMovementId}.pdf`,
      tags: ["PJN-Portal", "historical", actuacion.documentSource || "actuaciones"],
    });

    // Update the actuacion with both gcsPath and documentId
    await ctx.db.patch(args.actuacionId, {
      gcsPath: args.gcsPath,
      documentId: documentId ?? undefined,
    });

    return { documentId };
  },
});

/**
 * Create or update a document entry for a PJN historical docket PDF and
 * record the corresponding activity log entry.
 * This ensures all PJN history documents become first-class documents
 * and are processed through the standard pipeline.
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

    // Create or get the document using shared helper
    // This ensures it's processed through the standard pipeline
    const documentId = await createOrGetPjnDocument(ctx as any, {
      gcsPath: document.gcsPath,
      caseId: args.caseId,
      userId: args.userId,
      title: document.description || `PJN Docket - ${document.docId}`,
      description: document.description,
      originalFileName: `pjn-doc-${document.docId}.pdf`,
      tags: ["PJN-Portal", "historical"],
    });

    if (!documentId) {
      // Failed to create document, still log activity
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
          error: "Failed to create document entry",
        },
        timestamp,
      });
      return;
    }

    // Link document to matching actuación(es) if docRef matches
    // The documentId is now the canonical reference for the document
    if (document.docRef) {
      const actuaciones = await ctx.db
        .query("caseActuaciones")
        .withIndex("by_case_and_date", (q) => q.eq("caseId", args.caseId))
        .collect();

      // Find all matching actuaciones (there could be multiple)
      const matchingActuaciones = actuaciones.filter(
        (a) => a.docRef === document.docRef,
      );

      // Update all matching actuaciones with documentId
      for (const actuacion of matchingActuaciones) {
        await ctx.db.patch(actuacion._id, {
          documentId,
          gcsPath: document.gcsPath ?? actuacion.gcsPath,
        });
      }
    }

    // Also try to match by GCS path if docRef didn't match
    // This handles cases where docRef might be missing but we have the same PDF
    const actuacionesByGcs = await ctx.db
      .query("caseActuaciones")
      .withIndex("by_case_and_date", (q) => q.eq("caseId", args.caseId))
      .collect();

    const matchingByGcs = actuacionesByGcs.filter(
      (a) => a.gcsPath === document.gcsPath && !a.documentId,
    );

    for (const actuacion of matchingByGcs) {
      await ctx.db.patch(actuacion._id, {
        documentId,
      });
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
        documentId, // Store documentId as the canonical reference
      },
      timestamp,
    });
  },
});

/**
 * Create participant entry from PJN Intervinientes tab.
 * Parses the I.E.J.P identifier from the details field and stores it in dedicated fields.
 * Returns the created participant ID for triggering client matching.
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
  handler: async (ctx, args): Promise<{ participantId: Id<"caseParticipants"> | null; isNew: boolean }> => {
    // Idempotency check
    const existing = await ctx.db
      .query("caseParticipants")
      .withIndex("by_case_and_pjn_id", (q) =>
        q.eq("caseId", args.caseId).eq("pjnParticipantId", args.participant.participantId),
      )
      .first();

    if (existing) {
      return { participantId: existing._id, isNew: false };
    }

    // Parse I.E.J.P from details field
    const iejpRaw = extractIejpFromDetails(args.participant.details);
    const parsedIdentifier = parseIejpValue(iejpRaw);

    const participantId = await ctx.db.insert("caseParticipants", {
      caseId: args.caseId,
      role: args.participant.role,
      name: args.participant.name,
      details: args.participant.details,
      // New parsed identifier fields
      iejp: iejpRaw ?? undefined,
      documentType: parsedIdentifier.isValid ? parsedIdentifier.type : undefined,
      documentNumber: parsedIdentifier.isValid ? parsedIdentifier.number : undefined,
      pjnParticipantId: args.participant.participantId,
      syncedFrom: "pjn",
      syncedAt: Date.now(),
      isActive: true,
    });

    return { participantId, isNew: true };
  },
});

/**
 * Trigger client matching for a newly synced participant.
 * Called after createParticipantEntry to attempt automatic linking.
 */
export const triggerParticipantMatching = internalMutation({
  args: {
    participantId: v.id("caseParticipants"),
    caseId: v.id("cases"),
  },
  handler: async (ctx, args): Promise<null> => {
    // Schedule the matching action to run asynchronously
    await ctx.scheduler.runAfter(0, internal.intervinientes.matching.matchParticipantToClient, {
      participantId: args.participantId,
      caseId: args.caseId,
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
      expedienteKey: v.string(),
      rawExpediente: v.string(),
      rawNumber: v.string(),
      courtCode: v.string(),
      fuero: v.string(),
      year: v.number(),
      relationshipType: v.string(),
      relatedCaratula: v.optional(v.string()),
      relatedCourt: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args): Promise<null> => {
    const { relatedCase } = args;

    const vinculadoKey = relatedCase.expedienteKey;

    const vinculadoMeta = {
      expedienteKey: relatedCase.expedienteKey,
      rawExpediente: relatedCase.rawExpediente,
      rawNumber: relatedCase.rawNumber,
      courtCode: relatedCase.courtCode,
      fuero: relatedCase.fuero,
      year: relatedCase.year,
      relationshipType: relatedCase.relationshipType,
      caratula: relatedCase.relatedCaratula,
      court: relatedCase.relatedCourt,
    } as const;

    // Try to find linked case in our DB by canonical expediente key (FRE)
    const linkedCase = await ctx.db
      .query("cases")
      .withIndex("by_fre", (q) => q.eq("fre", vinculadoKey))
      .first();

    // Upsert pjnVinculados entry for this related case
    const existingVinculado = await ctx.db
      .query("pjnVinculados")
      .withIndex("by_case_and_vinculadoKey", (q) =>
        q.eq("caseId", args.caseId).eq("vinculadoKey", vinculadoKey),
      )
      .first();

    if (existingVinculado) {
      const patch: Partial<Doc<"pjnVinculados">> = {
        vinculadoMeta,
        source: "pjn",
      };

      // Respect ignored status: never resurrect ignored vinculados
      if (existingVinculado.status !== "ignored") {
        if (linkedCase && !existingVinculado.linkedCaseId) {
          patch.linkedCaseId = linkedCase._id;
          patch.status = "linked";
        }
      }

      await ctx.db.patch(existingVinculado._id, patch);
    } else {
      await ctx.db.insert("pjnVinculados", {
        caseId: args.caseId,
        vinculadoKey,
        vinculadoMeta,
        linkedCaseId: linkedCase?._id,
        source: "pjn",
        status: linkedCase ? "linked" : "pending",
      });
    }

    // Idempotent insert/update into relatedCases table based on PJN relation id
    const existingRelated = await ctx.db
      .query("relatedCases")
      .withIndex("by_pjn_id", (q) =>
        q.eq("pjnRelationId", relatedCase.relationId),
      )
      .first();

    if (existingRelated) {
      // If we now have a linked case, propagate it to the existing relatedCases row
      if (linkedCase && !existingRelated.relatedCaseId) {
        await ctx.db.patch(existingRelated._id, {
          relatedCaseId: linkedCase._id,
        });
      }
      return null;
    }

    await ctx.db.insert("relatedCases", {
      caseId: args.caseId,
      relatedFre: vinculadoKey,
      relationshipType: relatedCase.relationshipType,
      relatedCaratula: relatedCase.relatedCaratula,
      relatedCourt: relatedCase.relatedCourt,
      pjnRelationId: relatedCase.relationId,
      relatedCaseId: linkedCase?._id,
      syncedFrom: "pjn",
      syncedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Internal mutation to log PJN activity.
 * Used by workflows and internal processes to track PJN operations.
 */
export const logPjnActivity = internalMutation({
  args: {
    userId: v.id("users"),
    caseId: v.optional(v.id("cases")),
    action: v.string(),
    source: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<null> => {
    await ctx.db.insert("pjnActivityLog", {
      userId: args.userId,
      caseId: args.caseId,
      action: args.action,
      source: args.source ?? "internal",
      metadata: args.metadata,
      timestamp: Date.now(),
    });
    return null;
  },
});
