import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

/**
 * Response type from the scraper's case history search endpoint
 */
type CaseHistorySearchResponse =
  | {
      status: "OK";
      fre: string;
      cid: string | null;
      candidates: Array<{
        fre: string;
        rawClaveExpediente?: string | null;
        jurisdiction?: string | null;
        caseNumber?: string | null;
        caratula?: string | null;
        cid: string;
        rawHtml?: string | null;
      }>;
      caseMetadata?: Record<string, unknown>;
    }
  | {
      status: "NOT_FOUND";
      fre: string;
      candidates: Array<unknown>;
    }
  | {
      status: "AUTH_REQUIRED";
      reason: string;
      details?: Record<string, unknown>;
    }
  | {
      status: "ERROR";
      error: string;
      code?: string;
    };

type NormalizedMovement = {
  movementId: string;
  fre: string | null;
  date: string;
  description: string;
  hasDocument: boolean;
  documentSource?: "actuaciones" | "doc_digitales";
  docRef?: string | null;
  gcsPath?: string;
};

type NormalizedDigitalDocument = {
  docId: string;
  fre: string | null;
  date: string;
  description: string;
  source: "actuaciones" | "doc_digitales";
  gcsPath?: string;
  docRef?: string | null;
};

type NormalizedParticipant = {
  participantId: string;
  role: string;
  name: string;
  details?: string;
};

type NormalizedAppeal = {
  appealId: string;
  appealType: string;
  filedDate?: string;
  status?: string;
  court?: string;
  description?: string;
};

type NormalizedRelatedCase = {
  relationId: string;
  expedienteKey: string;
  rawExpediente: string;
  rawNumber: string;
  courtCode: string;
  fuero: string;
  year: number;
  relationshipType: string;
  relatedCaratula?: string;
  relatedCourt?: string;
};

type CaseHistoryDetailsResponse =
  | {
      status: "OK";
      fre: string;
      cid: string;
      movimientos: NormalizedMovement[];
      docDigitales: NormalizedDigitalDocument[];
      intervinientes?: NormalizedParticipant[];
      recursos?: NormalizedAppeal[];
      vinculados?: NormalizedRelatedCase[];
      stats: {
        movimientosCount: number;
        docsCount: number;
        downloadErrors: number;
        durationMs: number;
      };
    }
  | {
      status: "AUTH_REQUIRED";
      reason: string;
      details?: Record<string, unknown>;
    }
  | {
      status: "ERROR";
      error: string;
      code?: string;
    };

/**
 * Public action: Search PJN case history using the scraper service.
 *
 * This action calls the PJN scraper microservice to search for cases
 * in the consultaListaRelacionados.seam portal.
 */
export const searchCaseHistory = action({
  args: {
    jurisdiction: v.string(),
    caseNumber: v.string(),
    year: v.number(),
  },
  handler: async (
    ctx,
    args
  ): Promise<
    | {
        status: "OK";
        fre: string;
        cid: string | null;
        candidates: Array<any>;
        caseMetadata?: any;
      }
    | {
        status: "NOT_FOUND";
        fre: string;
        candidates: Array<any>;
      }
    | {
        status: "AUTH_REQUIRED";
        reason: string;
        details?: any;
      }
    | {
        status: "ERROR";
        error: string;
        code?: string;
      }
  > => {
    const scraperUrl = process.env.PJN_SCRAPER_URL;
    if (!scraperUrl) {
      throw new Error("PJN_SCRAPER_URL environment variable is not set");
    }

    const serviceAuthSecret = process.env.EXPEDIENTES_SCRAPER_SECRET;
    if (!serviceAuthSecret) {
      throw new Error("EXPEDIENTES_SCRAPER_SECRET environment variable is not set");
    }

    // Get current user ID
    const currentUser = await ctx.runQuery(api.functions.users.getCurrentUser, {});
    if (!currentUser?._id) {
      throw new Error("User not found");
    }

    const userId = currentUser._id;

    // Helper function to attempt automatic reauth using stored credentials
    const attemptAutomaticReauth = async (): Promise<
      "ok" | "auth_failed" | "error" | "no_credentials"
    > => {
      // Get decrypted credentials
      const credentials = await ctx.runQuery(internal.pjn.accounts.getDecryptedPassword, {
        userId,
      });

      if (!credentials) {
        console.log(
          `No stored credentials found for user ${userId}, manual reauth required`,
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
            userId: userId as string,
            username: credentials.username,
            password: credentials.password,
          }),
        });

        if (!reauthResponse.ok) {
          const errorText = await reauthResponse.text();
          console.error(
            `Reauth failed for user ${userId}: ${reauthResponse.status} - ${errorText}`,
          );
          await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
            userId,
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

          console.log(`Automatic reauth failed for user ${userId}: ${reason}`);
          await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
            userId,
            reason,
          });
          return "auth_failed";
        }

        if (reauthResult.status === "ERROR") {
          const errorMessage =
            reauthResult.error && typeof reauthResult.error === "string"
              ? reauthResult.error
              : "Unknown error";

          console.error(`Reauth error for user ${userId}: ${errorMessage}`);
          await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
            userId,
            reason: errorMessage,
          });
          return "error";
        }

        if (reauthResult.status === "OK") {
          console.log(`Automatic reauth succeeded for user ${userId}`);
          await ctx.runMutation(internal.pjn.accounts.clearNeedsReauth, {
            userId,
          });
          return "ok";
        }

        console.warn(
          `Unexpected reauth status for user ${userId}: ${reauthResult.status}`,
        );
        await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
          userId,
          reason: `Unexpected reauth status: ${reauthResult.status}`,
        });
        return "error";
      } catch (error) {
        console.error(`Reauth request failed for user ${userId}:`, error);
        await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
          userId,
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
    const userAccount = account.find((a) => a.userId === userId);

    if (!userAccount) {
      return {
        status: "AUTH_REQUIRED" as const,
        reason: "No PJN account found. Please connect your PJN account first.",
      };
    }

    // If account is already marked as needing reauth, attempt automatic reauth using stored credentials
    if (userAccount.needsReauth) {
      console.log(`Attempting automatic reauth for user ${userId}`);
      const reauthResult = await attemptAutomaticReauth();
      if (reauthResult !== "ok") {
        // Reauth with stored credentials failed or is not possible, require manual reauth
        return {
          status: "AUTH_REQUIRED" as const,
          reason:
            reauthResult === "no_credentials"
              ? "No stored credentials found. Please reconnect your PJN account."
              : "Session expired and could not be refreshed. Please reconnect your PJN account.",
        };
      }
    }

    // Prepare request body
    const requestBody: {
      userId: string;
      jurisdiction: string;
      caseNumber: string;
      year: number;
    } = {
      userId: userId as string,
      jurisdiction: args.jurisdiction,
      caseNumber: args.caseNumber,
      year: args.year,
    };

    try {
      // Helper function to perform the search request
      const performSearch = async (): Promise<CaseHistorySearchResponse> => {
        const response = await fetch(`${scraperUrl}/scrape/case-history/search`, {
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

        const result = (await response.json()) as CaseHistorySearchResponse;
        return result;
      };

      // First attempt to search with the current session
      let searchResult = await performSearch();

      if (searchResult.status === "AUTH_REQUIRED") {
        // Session is expired or invalid. Attempt automatic reauth using stored credentials.
        console.log(
          `Session expired or invalid for user ${userId}, attempting automatic reauth`,
        );

        const reauthResult = await attemptAutomaticReauth();

        if (reauthResult !== "ok") {
          // Automatic reauth failed (invalid credentials, error, or missing credentials).
          // At this point the account is already marked as needsReauth inside attemptAutomaticReauth.
          return {
            status: "AUTH_REQUIRED" as const,
            reason:
              reauthResult === "no_credentials"
                ? "No stored credentials found. Please reconnect your PJN account."
                : "Session expired and could not be refreshed. Please reconnect your PJN account.",
          };
        }

        // Reauth succeeded; retry search once
        searchResult = await performSearch();

        if (searchResult.status === "AUTH_REQUIRED") {
          // Still auth required after a successful reauth; treat as needsReauth.
          await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
            userId,
            reason: "Session still invalid after automatic reauth",
          });
          return {
            status: "AUTH_REQUIRED" as const,
            reason: "Session still invalid after automatic reauth. Please reconnect your PJN account.",
          };
        }
      }

      // Return the result
      return searchResult;
    } catch (error) {
      console.error(`Case history search failed for user ${userId}:`, error);
      await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
        userId,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
      return {
        status: "ERROR" as const,
        error: error instanceof Error ? error.message : "Unknown error",
        code: "SCRAPE_ERROR",
      };
    }
  },
});

/**
 * Public action: Sync full PJN case history for a specific case.
 *
 * This action:
 * - Validates access to the case
 * - Uses the case's FRE to call the scraper details endpoint
 * - Ingests movimientos and historical documents into Convex
 * - Updates the case's lastPjnHistorySyncAt timestamp
 */
export const syncCaseHistoryForCase = action({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (
    ctx,
    args
  ): Promise<
    | {
        status: "OK";
        movimientosSynced: number;
        documentsSynced: number;
        participantsSynced: number;
        appealsSynced: number;
        relatedCasesSynced: number;
        stats: {
          movimientosCount: number;
          docsCount: number;
          downloadErrors: number;
          durationMs: number;
        };
        lastSyncAt: number;
      }
    | {
        status: "AUTH_REQUIRED";
        reason: string;
        details?: any;
      }
    | {
        status: "ERROR";
        error: string;
        code?: string;
      }
  > => {
    const scraperUrl = process.env.PJN_SCRAPER_URL;
    if (!scraperUrl) {
      throw new Error("PJN_SCRAPER_URL environment variable is not set");
    }

    const serviceAuthSecret = process.env.EXPEDIENTES_SCRAPER_SECRET;
    if (!serviceAuthSecret) {
      throw new Error("EXPEDIENTES_SCRAPER_SECRET environment variable is not set");
    }

    // Get current user and ensure they have advanced access to the case
    const currentUser = await ctx.runQuery(api.functions.users.getCurrentUser, {});
    if (!currentUser?._id) {
      throw new Error("User not found");
    }

    const userId = currentUser._id;

    // Ensure the user has at least advanced access to the case via the
    // centralized access control helper (runs as an internal query).
    const access = await ctx.runQuery(
      internal.auth_utils.internalCheckNewCaseAccess,
      {
        userId,
        caseId: args.caseId,
        requiredLevel: "advanced",
      },
    );

    if (!access.hasAccess) {
      return {
        status: "ERROR" as const,
        error: "No tienes permisos para sincronizar este caso.",
        code: "FORBIDDEN",
      };
    }

    // Load the case via the existing cases query so that all DB access happens
    // inside queries/mutations, not directly from this action.
    const caseDoc = await ctx.runQuery(
      api.functions.cases.getCaseById,
      {
        caseId: args.caseId,
      },
    );

    if (!caseDoc.fre) {
      return {
        status: "ERROR" as const,
        error:
          "El caso no tiene FRE configurado. Agrega el FRE en los datos del caso antes de sincronizar.",
        code: "MISSING_FRE",
      };
    }

    const fre: string = caseDoc.fre;
    const incrementalMovementsLimit = 5;
    const initialSyncMovementsLimit = 50;
    const maxMovements = caseDoc.lastPjnHistorySyncAt
      ? incrementalMovementsLimit
      : initialSyncMovementsLimit;

    // Helper function to attempt automatic reauth using stored credentials
    const attemptAutomaticReauth = async (): Promise<
      "ok" | "auth_failed" | "error" | "no_credentials"
    > => {
      // Get decrypted credentials
      const credentials = await ctx.runQuery(
        internal.pjn.accounts.getDecryptedPassword,
        {
          userId,
        },
      );

      if (!credentials) {
        console.log(
          `No stored credentials found for user ${userId}, manual reauth required`,
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
            userId: userId as string,
            username: credentials.username,
            password: credentials.password,
          }),
        });

        if (!reauthResponse.ok) {
          const errorText = await reauthResponse.text();
          console.error(
            `Reauth failed for user ${userId}: ${reauthResponse.status} - ${errorText}`,
          );
          await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
            userId,
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

          console.log(`Automatic reauth failed for user ${userId}: ${reason}`);
          await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
            userId,
            reason,
          });
          return "auth_failed";
        }

        if (reauthResult.status === "ERROR") {
          const errorMessage =
            reauthResult.error && typeof reauthResult.error === "string"
              ? reauthResult.error
              : "Unknown error";

          console.error(`Reauth error for user ${userId}: ${errorMessage}`);
          await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
            userId,
            reason: errorMessage,
          });
          return "error";
        }

        if (reauthResult.status === "OK") {
          console.log(`Automatic reauth succeeded for user ${userId}`);
          await ctx.runMutation(internal.pjn.accounts.clearNeedsReauth, {
            userId,
          });
          return "ok";
        }

        console.warn(
          `Unexpected reauth status for user ${userId}: ${reauthResult.status}`,
        );
        await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
          userId,
          reason: `Unexpected reauth status: ${reauthResult.status}`,
        });
        return "error";
      } catch (error) {
        console.error(`Reauth request failed for user ${userId}:`, error);
        await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
          userId,
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
    const userAccount = account.find((a) => a.userId === userId);

    if (!userAccount) {
      return {
        status: "AUTH_REQUIRED" as const,
        reason: "No PJN account found. Please connect your PJN account first.",
      };
    }

    // If account is already marked as needing reauth, attempt automatic reauth using stored credentials
    if (userAccount.needsReauth) {
      console.log(`Attempting automatic reauth for user ${userId}`);
      const reauthResult = await attemptAutomaticReauth();
      if (reauthResult !== "ok") {
        // Reauth with stored credentials failed or is not possible, require manual reauth
        return {
          status: "AUTH_REQUIRED" as const,
          reason:
            reauthResult === "no_credentials"
              ? "No stored credentials found. Please reconnect your PJN account."
              : "Session expired and could not be refreshed. Please reconnect your PJN account.",
        };
      }
    }

    const requestBody: {
      userId: string;
      fre: string;
      includeMovements?: boolean;
      includeDocuments?: boolean;
      includeIntervinientes?: boolean;
      includeVinculados?: boolean;
      maxMovements?: number;
      maxDocuments?: number;
      downloadPdfs?: boolean;
    } = {
      userId: userId as string,
      fre,
      includeMovements: true,
      includeDocuments: true,
      // Skip PDF downloads during history sync - PDFs are synced separately
      downloadPdfs: false,
    };
    if (maxMovements !== undefined) {
      requestBody.maxMovements = maxMovements;
    }

    try {
      // Helper function to perform the details request
      const performDetails = async (): Promise<CaseHistoryDetailsResponse> => {
        const response = await fetch(
          `${scraperUrl}/scrape/case-history/details`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Service-Auth": serviceAuthSecret,
            },
            body: JSON.stringify(requestBody),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Scraper returned ${response.status}: ${errorText}`);
        }

        const result =
          (await response.json()) as CaseHistoryDetailsResponse;
        return result;
      };

      // First attempt to fetch details with the current session
      let detailsResult = await performDetails();

      if (detailsResult.status === "AUTH_REQUIRED") {
        // Session is expired or invalid. Attempt automatic reauth using stored credentials.
        console.log(
          `Session expired or invalid for user ${userId}, attempting automatic reauth for details sync`,
        );

        const reauthResult = await attemptAutomaticReauth();

        if (reauthResult !== "ok") {
          // Automatic reauth failed (invalid credentials, error, or missing credentials).
          // At this point the account is already marked as needsReauth inside attemptAutomaticReauth.
          return {
            status: "AUTH_REQUIRED" as const,
            reason:
              reauthResult === "no_credentials"
                ? "No stored credentials found. Please reconnect your PJN account."
                : "Session expired and could not be refreshed. Please reconnect your PJN account.",
          };
        }

        // Reauth succeeded; retry details once
        detailsResult = await performDetails();

        if (detailsResult.status === "AUTH_REQUIRED") {
          // Still auth required after a successful reauth; treat as needsReauth.
          await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
            userId,
            reason: "Session still invalid after automatic reauth",
          });
          return {
            status: "AUTH_REQUIRED" as const,
            reason:
              "Session still invalid after automatic reauth. Please reconnect your PJN account.",
          };
        }
      }

      if (detailsResult.status === "ERROR") {
        return {
          status: "ERROR" as const,
          error: detailsResult.error,
          code: detailsResult.code,
        };
      }

      if (detailsResult.status !== "OK") {
        return {
          status: "ERROR" as const,
          error: "Unexpected response from scraper",
          code: "SCRAPER_UNEXPECTED_RESPONSE",
        };
      }

      const movimientos: NormalizedMovement[] =
        detailsResult.movimientos ?? [];
      const docDigitales: NormalizedDigitalDocument[] =
        detailsResult.docDigitales ?? [];

      // Ingest movimientos
      for (const movement of movimientos) {
        await ctx.runMutation(internal.pjn.sync.upsertActuacion, {
          userId,
          caseId: args.caseId,
          movement,
        });
        await ctx.runMutation(internal.pjn.sync.createDocketMovementEntry, {
          userId,
          caseId: args.caseId,
          movement,
        });
      }

      // Ingest historical documents
      for (const document of docDigitales) {
        await ctx.runMutation(
          internal.pjn.sync.createHistoricalDocumentEntry,
          {
            userId,
            caseId: args.caseId,
            document,
          },
        );
      }

      // Ingest participants
      const intervinientes = detailsResult.intervinientes ?? [];
      for (const participant of intervinientes) {
        const result = await ctx.runMutation(internal.pjn.sync.createParticipantEntry, {
          caseId: args.caseId,
          participant,
        });
        
        // Trigger matching for new participants
        if (result.isNew && result.participantId) {
          await ctx.runMutation(internal.pjn.sync.triggerParticipantMatching, {
            participantId: result.participantId,
            caseId: args.caseId,
          });
        }
      }

      // Ingest appeals
      const recursos = detailsResult.recursos ?? [];
      for (const appeal of recursos) {
        await ctx.runMutation(internal.pjn.sync.createAppealEntry, {
          caseId: args.caseId,
          appeal,
        });
      }

      // Ingest related cases
      const vinculados = detailsResult.vinculados ?? [];
      for (const relatedCase of vinculados) {
        await ctx.runMutation(internal.pjn.sync.createRelatedCaseEntry, {
          caseId: args.caseId,
          relatedCase,
        });
      }

      // Auto-link PJN vinculados to existing workspace cases using FRE
      await ctx.runMutation(internal.pjn.vinculados.processForCase, {
        caseId: args.caseId,
      });

      const lastSyncAt = Date.now();
      await ctx.runMutation(
        internal.pjn.caseHistory.setLastPjnHistorySyncAt,
        {
          caseId: args.caseId,
          lastSyncAt,
        },
      );

      return {
        status: "OK" as const,
        movimientosSynced: movimientos.length,
        documentsSynced: docDigitales.length,
        participantsSynced: intervinientes.length,
        appealsSynced: recursos.length,
        relatedCasesSynced: vinculados.length,
        stats: {
          movimientosCount: detailsResult.stats.movimientosCount,
          docsCount: detailsResult.stats.docsCount,
          downloadErrors: detailsResult.stats.downloadErrors,
          durationMs: detailsResult.stats.durationMs,
        },
        lastSyncAt,
      };
    } catch (error) {
      console.error(
        `Case history sync failed for user ${userId} and case ${String(
          args.caseId,
        )}:`,
        error,
      );
      await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
        userId,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
      return {
        status: "ERROR" as const,
        error: error instanceof Error ? error.message : "Unknown error",
        code: "SCRAPE_ERROR",
      };
    }
  },
});

/**
 * Internal action version of syncCaseHistoryForCase that can be called from workflows.
 * This includes progress tracking for the job.
 */
export const syncCaseHistoryForCaseInternal = internalAction({
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
  handler: async (
    ctx,
    args
  ): Promise<
    | {
        status: "OK";
        movimientosSynced: number;
        documentsSynced: number;
        participantsSynced: number;
        appealsSynced: number;
        relatedCasesSynced: number;
        stats: {
          movimientosCount: number;
          docsCount: number;
          downloadErrors: number;
          durationMs: number;
        };
        lastSyncAt: number;
      }
    | {
        status: "AUTH_REQUIRED";
        reason: string;
        details?: any;
      }
    | {
        status: "ERROR";
        error: string;
        code?: string;
      }
  > => {
    const scraperUrl = process.env.PJN_SCRAPER_URL;
    if (!scraperUrl) {
      throw new Error("PJN_SCRAPER_URL environment variable is not set");
    }

    const serviceAuthSecret = process.env.EXPEDIENTES_SCRAPER_SECRET;
    if (!serviceAuthSecret) {
      throw new Error("EXPEDIENTES_SCRAPER_SECRET environment variable is not set");
    }

    const { caseId, userId, jobId } = args;

    // Load the case directly from the database (we're already in an internal action)
    const caseDoc = await ctx.runQuery(internal.functions.cases.getCaseByIdInternal, {
      caseId,
    });

    if (!caseDoc) {
      return {
        status: "ERROR" as const,
        error: "Case not found",
        code: "CASE_NOT_FOUND",
      };
    }

    if (!caseDoc.fre) {
      return {
        status: "ERROR" as const,
        error:
          "El caso no tiene FRE configurado. Agrega el FRE en los datos del caso antes de sincronizar.",
        code: "MISSING_FRE",
      };
    }

    const fre: string = caseDoc.fre;
    const incrementalMovementsLimit = 5;
    const initialSyncMovementsLimit = 50;
    const maxMovements =
      args.syncProfile?.maxMovements ??
      (caseDoc.lastPjnHistorySyncAt ? incrementalMovementsLimit : initialSyncMovementsLimit);

    // Helper function to attempt automatic reauth using stored credentials
    const attemptAutomaticReauth = async (): Promise<
      "ok" | "auth_failed" | "error" | "no_credentials"
    > => {
      const credentials = await ctx.runQuery(
        internal.pjn.accounts.getDecryptedPassword,
        { userId }
      );

      if (!credentials) {
        console.log(
          `No stored credentials found for user ${String(userId)}, manual reauth required`
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
            userId: userId as string,
            username: credentials.username,
            password: credentials.password,
          }),
        });

        if (!reauthResponse.ok) {
          const errorText = await reauthResponse.text();
          console.error(
            `Reauth failed for user ${String(userId)}: ${reauthResponse.status} - ${errorText}`
          );
          await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
            userId,
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

          console.log(`Automatic reauth failed for user ${String(userId)}: ${reason}`);
          await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
            userId,
            reason,
          });
          return "auth_failed";
        }

        if (reauthResult.status === "ERROR") {
          const errorMessage =
            reauthResult.error && typeof reauthResult.error === "string"
              ? reauthResult.error
              : "Unknown error";

          console.error(`Reauth error for user ${String(userId)}: ${errorMessage}`);
          await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
            userId,
            reason: errorMessage,
          });
          return "error";
        }

        if (reauthResult.status === "OK") {
          console.log(`Automatic reauth succeeded for user ${String(userId)}`);
          await ctx.runMutation(internal.pjn.accounts.clearNeedsReauth, {
            userId,
          });
          return "ok";
        }

        console.warn(
          `Unexpected reauth status for user ${String(userId)}: ${reauthResult.status}`
        );
        await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
          userId,
          reason: `Unexpected reauth status: ${reauthResult.status}`,
        });
        return "error";
      } catch (error) {
        console.error(`Reauth request failed for user ${String(userId)}:`, error);
        await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
          userId,
          reason: error instanceof Error ? error.message : "Automatic reauth failed",
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
    const userAccount = account.find((a) => a.userId === userId);

    if (!userAccount) {
      return {
        status: "AUTH_REQUIRED" as const,
        reason: "No PJN account found. Please connect your PJN account first.",
      };
    }

    // If account needs reauth, attempt automatic reauth
    if (userAccount.needsReauth) {
      console.log(`Attempting automatic reauth for user ${String(userId)}`);
      const reauthResult = await attemptAutomaticReauth();
      if (reauthResult !== "ok") {
        return {
          status: "AUTH_REQUIRED" as const,
          reason:
            reauthResult === "no_credentials"
              ? "No stored credentials found. Please reconnect your PJN account."
              : "Session expired and could not be refreshed. Please reconnect your PJN account.",
        };
      }
    }

    const requestBody: {
      userId: string;
      fre: string;
      includeMovements?: boolean;
      includeDocuments?: boolean;
      includeIntervinientes?: boolean;
      includeVinculados?: boolean;
      maxMovements?: number;
      maxDocuments?: number;
      downloadPdfs?: boolean;
    } = {
      userId: userId as string,
      fre,
      includeMovements: true,
      includeDocuments: true,
      // Skip PDF downloads during history sync - PDFs are synced separately
      downloadPdfs: false,
    };
    if (maxMovements !== undefined) {
      requestBody.maxMovements = maxMovements;
    }
    if (args.syncProfile?.includeIntervinientes !== undefined) {
      requestBody.includeIntervinientes = args.syncProfile.includeIntervinientes;
    }
    if (args.syncProfile?.includeVinculados !== undefined) {
      requestBody.includeVinculados = args.syncProfile.includeVinculados;
    }

    try {
      // Update progress: fetching history (10-30%)
      await ctx.runMutation(internal.pjn.caseHistoryJobs.updateJobProgress, {
        jobId,
        phase: "fetching_history",
        progressPercent: 20,
      });

      // Helper function to perform the details request
      const performDetails = async (): Promise<CaseHistoryDetailsResponse> => {
        const response = await fetch(`${scraperUrl}/scrape/case-history/details`, {
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

        const result = (await response.json()) as CaseHistoryDetailsResponse;
        return result;
      };

      // First attempt to fetch details with the current session
      let detailsResult = await performDetails();

      if (detailsResult.status === "AUTH_REQUIRED") {
        console.log(
          `Session expired or invalid for user ${String(userId)}, attempting automatic reauth for details sync`
        );

        const reauthResult = await attemptAutomaticReauth();

        if (reauthResult !== "ok") {
          return {
            status: "AUTH_REQUIRED" as const,
            reason:
              reauthResult === "no_credentials"
                ? "No stored credentials found. Please reconnect your PJN account."
                : "Session expired and could not be refreshed. Please reconnect your PJN account.",
          };
        }

        // Reauth succeeded; retry details once
        detailsResult = await performDetails();

        if (detailsResult.status === "AUTH_REQUIRED") {
          await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
            userId,
            reason: "Session still invalid after automatic reauth",
          });
          return {
            status: "AUTH_REQUIRED" as const,
            reason:
              "Session still invalid after automatic reauth. Please reconnect your PJN account.",
          };
        }
      }

      if (detailsResult.status === "ERROR") {
        return {
          status: "ERROR" as const,
          error: detailsResult.error,
          code: detailsResult.code,
        };
      }

      if (detailsResult.status !== "OK") {
        return {
          status: "ERROR" as const,
          error: "Unexpected response from scraper",
          code: "SCRAPER_UNEXPECTED_RESPONSE",
        };
      }

      const movimientos: NormalizedMovement[] = detailsResult.movimientos ?? [];
      const docDigitales: NormalizedDigitalDocument[] =
        detailsResult.docDigitales ?? [];

      // Update progress: ingesting movements (30-60%)
      await ctx.runMutation(internal.pjn.caseHistoryJobs.updateJobProgress, {
        jobId,
        phase: "ingesting_movements",
        progressPercent: 40,
      });

      // Ingest movimientos
      // Note: upsertActuacion already handles creating documents for movements
      // that have gcsPath, so we don't need to call createHistoricalDocumentEntry separately
      for (const movement of movimientos) {
        await ctx.runMutation(internal.pjn.sync.upsertActuacion, {
          userId,
          caseId,
          movement,
        });
        await ctx.runMutation(internal.pjn.sync.createDocketMovementEntry, {
          userId,
          caseId,
          movement,
        });
      }

      // Update progress: ingesting documents (60-80%)
      await ctx.runMutation(internal.pjn.caseHistoryJobs.updateJobProgress, {
        jobId,
        phase: "ingesting_documents",
        progressPercent: 70,
      });

      // Ingest historical documents
      for (const document of docDigitales) {
        await ctx.runMutation(internal.pjn.sync.createHistoricalDocumentEntry, {
          userId,
          caseId,
          document,
        });
      }

      // Ingest participants
      const intervinientes = detailsResult.intervinientes ?? [];
      for (const participant of intervinientes) {
        const result = await ctx.runMutation(internal.pjn.sync.createParticipantEntry, {
          caseId,
          participant,
        });
        
        // Trigger matching for new participants
        if (result.isNew && result.participantId) {
          await ctx.runMutation(internal.pjn.sync.triggerParticipantMatching, {
            participantId: result.participantId,
            caseId,
          });
        }
      }

      // Ingest appeals
      const recursos = detailsResult.recursos ?? [];
      for (const appeal of recursos) {
        await ctx.runMutation(internal.pjn.sync.createAppealEntry, {
          caseId,
          appeal,
        });
      }

      // Ingest related cases
      const vinculados = detailsResult.vinculados ?? [];
      for (const relatedCase of vinculados) {
        await ctx.runMutation(internal.pjn.sync.createRelatedCaseEntry, {
          caseId,
          relatedCase,
        });
      }

      // Auto-link PJN vinculados to existing workspace cases using FRE
      await ctx.runMutation(internal.pjn.vinculados.processForCase, {
        caseId,
      });

      const lastSyncAt = Date.now();
      await ctx.runMutation(internal.pjn.caseHistory.setLastPjnHistorySyncAt, {
        caseId,
        lastSyncAt,
      });

      return {
        status: "OK" as const,
        movimientosSynced: movimientos.length,
        documentsSynced: docDigitales.length,
        participantsSynced: intervinientes.length,
        appealsSynced: recursos.length,
        relatedCasesSynced: vinculados.length,
        stats: {
          movimientosCount: detailsResult.stats.movimientosCount,
          docsCount: detailsResult.stats.docsCount,
          downloadErrors: detailsResult.stats.downloadErrors,
          durationMs: detailsResult.stats.durationMs,
        },
        lastSyncAt,
      };
    } catch (error) {
      console.error(
        `Case history sync failed for user ${String(userId)} and case ${String(caseId)}:`,
        error
      );
      await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
        userId,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
      return {
        status: "ERROR" as const,
        error: error instanceof Error ? error.message : "Unknown error",
        code: "SCRAPE_ERROR",
      };
    }
  },
});

/**
 * Internal mutation to update lastPjnHistorySyncAt for a case.
 * This keeps all direct DB writes in mutation contexts.
 */
export const setLastPjnHistorySyncAt = internalMutation({
  args: {
    caseId: v.id("cases"),
    lastSyncAt: v.number(),
  },
  handler: async (ctx, args): Promise<null> => {
    await ctx.db.patch(args.caseId, {
      lastPjnHistorySyncAt: args.lastSyncAt,
    });
    return null;
  },
});

/**
 * Internal query to list actuaciones for a case, ordered by movementDate.
 */
export const listActuacionesForCase = internalQuery({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args): Promise<Array<{
    _id: Id<"caseActuaciones">;
    caseId: Id<"cases">;
    fre?: string;
    pjnMovementId: string;
    movementDate: number;
    rawDate?: string;
    description: string;
    hasDocument: boolean;
    documentSource?: "actuaciones" | "doc_digitales";
    docRef?: string;
    gcsPath?: string;
    documentId?: Id<"documents">;
    origin: "history_sync" | "notification";
    syncedFrom: "pjn";
    syncedAt: number;
  }>> => {
    const actuaciones = await ctx.db
      .query("caseActuaciones")
      .withIndex("by_case_and_date", (q) => q.eq("caseId", args.caseId))
      .collect();

    return actuaciones.sort((a, b) => b.movementDate - a.movementDate);
  },
});

/**
 * Internal query to list actuaciones with pending PDF downloads.
 * Returns actuaciones that have a docRef but no gcsPath.
 */
export const listActuacionesPendingPdfDownload = internalQuery({
  args: {
    caseId: v.id("cases"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Array<{
    _id: Id<"caseActuaciones">;
    pjnMovementId: string;
    docRef: string;
  }>> => {
    const actuaciones = await ctx.db
      .query("caseActuaciones")
      .withIndex("by_case_and_date", (q) => q.eq("caseId", args.caseId))
      .collect();

    // Filter to only those with docRef but no gcsPath
    const pending = actuaciones
      .filter((a) => a.docRef && !a.gcsPath && a.hasDocument)
      .map((a) => ({
        _id: a._id,
        pjnMovementId: a.pjnMovementId,
        docRef: a.docRef!,
      }));

    if (args.limit && pending.length > args.limit) {
      return pending.slice(0, args.limit);
    }
    return pending;
  },
});

/**
 * Response type from the scraper's download-pdfs endpoint.
 */
type CaseHistoryDownloadPdfsResponse =
  | {
      status: "OK";
      fre: string;
      results: Array<{
        kind: "movement" | "doc";
        id: string;
        success: boolean;
        gcsPath?: string;
        error?: string;
      }>;
      stats: {
        total: number;
        succeeded: number;
        failed: number;
        durationMs: number;
      };
    }
  | {
      status: "AUTH_REQUIRED";
      reason: string;
      details?: Record<string, unknown>;
    }
  | {
      status: "ERROR";
      error: string;
      code?: string;
    };

/**
 * Internal action to sync PDFs for a case.
 * 
 * This downloads PDFs for actuaciones that have a docRef but no gcsPath,
 * updating the records with the resulting GCS paths.
 */
export const syncPdfsForCaseInternal = internalAction({
  args: {
    caseId: v.id("cases"),
    userId: v.id("users"),
    /** Maximum number of PDFs to download in this batch */
    batchSize: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<
    | {
        status: "OK";
        downloaded: number;
        failed: number;
        remaining: number;
        durationMs: number;
      }
    | {
        status: "AUTH_REQUIRED";
        reason: string;
      }
    | {
        status: "ERROR";
        error: string;
        code?: string;
      }
  > => {
    const scraperUrl = process.env.PJN_SCRAPER_URL;
    if (!scraperUrl) {
      throw new Error("PJN_SCRAPER_URL environment variable is not set");
    }

    const serviceAuthSecret = process.env.EXPEDIENTES_SCRAPER_SECRET;
    if (!serviceAuthSecret) {
      throw new Error("EXPEDIENTES_SCRAPER_SECRET environment variable is not set");
    }

    const { caseId, userId, batchSize = 10 } = args;

    // Get the case to get its FRE
    const caseDoc = await ctx.runQuery(internal.functions.cases.getCaseByIdInternal, {
      caseId,
    });

    if (!caseDoc) {
      return {
        status: "ERROR" as const,
        error: "Case not found",
        code: "CASE_NOT_FOUND",
      };
    }

    if (!caseDoc.fre) {
      return {
        status: "ERROR" as const,
        error: "Case has no FRE configured",
        code: "MISSING_FRE",
      };
    }

    const fre: string = caseDoc.fre;

    // Get actuaciones pending PDF download
    const pendingActuaciones = await ctx.runQuery(
      internal.pjn.caseHistory.listActuacionesPendingPdfDownload,
      {
        caseId,
        limit: batchSize,
      }
    );

    if (pendingActuaciones.length === 0) {
      return {
        status: "OK" as const,
        downloaded: 0,
        failed: 0,
        remaining: 0,
        durationMs: 0,
      };
    }

    // Build request items
    const items = pendingActuaciones.map((a) => ({
      kind: "movement" as const,
      id: a.pjnMovementId,
      docRef: a.docRef,
    }));

    const requestBody = {
      userId: userId as string,
      fre,
      items,
    };

    const startTime = Date.now();

    try {
      const response = await fetch(`${scraperUrl}/scrape/case-history/download-pdfs`, {
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

      const result = (await response.json()) as CaseHistoryDownloadPdfsResponse;

      if (result.status === "AUTH_REQUIRED") {
        await ctx.runMutation(internal.pjn.accounts.markNeedsReauth, {
          userId,
          reason: result.reason,
        });
        return {
          status: "AUTH_REQUIRED" as const,
          reason: result.reason,
        };
      }

      if (result.status === "ERROR") {
        return {
          status: "ERROR" as const,
          error: result.error,
          code: result.code,
        };
      }

      // Update actuaciones with the gcsPath results and create documents
      let downloaded = 0;
      let failed = 0;

      for (const item of result.results) {
        if (item.kind === "movement" && item.success && item.gcsPath) {
          // Find the actuacion by pjnMovementId
          const actuacion = pendingActuaciones.find(
            (a) => a.pjnMovementId === item.id
          );
          if (actuacion) {
            // Update actuacion and create document entry
            await ctx.runMutation(internal.pjn.sync.updateActuacionWithDocument, {
              actuacionId: actuacion._id,
              userId,
              gcsPath: item.gcsPath,
            });
            downloaded++;
          }
        } else if (!item.success) {
          failed++;
        }
      }

      // Get remaining count
      const allPending = await ctx.runQuery(
        internal.pjn.caseHistory.listActuacionesPendingPdfDownload,
        {
          caseId,
        }
      );
      const remaining = allPending.length;

      const durationMs = Date.now() - startTime;

      return {
        status: "OK" as const,
        downloaded,
        failed,
        remaining,
        durationMs,
      };
    } catch (error) {
      console.error(
        `PDF sync failed for user ${String(userId)} and case ${String(caseId)}:`,
        error
      );
      return {
        status: "ERROR" as const,
        error: error instanceof Error ? error.message : "Unknown error",
        code: "SCRAPE_ERROR",
      };
    }
  },
});

