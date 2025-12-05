import { v } from "convex/values";
import { action } from "../_generated/server";
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
  returns: v.union(
    v.object({
      status: v.literal("OK"),
      fre: v.string(),
      cid: v.union(v.string(), v.null()),
      candidates: v.array(v.any()),
      caseMetadata: v.optional(v.any()),
    }),
    v.object({
      status: v.literal("NOT_FOUND"),
      fre: v.string(),
      candidates: v.array(v.any()),
    }),
    v.object({
      status: v.literal("AUTH_REQUIRED"),
      reason: v.string(),
      details: v.optional(v.any()),
    }),
    v.object({
      status: v.literal("ERROR"),
      error: v.string(),
      code: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
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
