import { Router, Request, Response } from "express";
import { SessionStore, SessionState } from "../lib/sessionStore";
import {
  scrapeCaseHistorySearchRequestSchema,
  scrapeCaseHistoryDetailsRequestSchema,
  type CaseHistorySearchResponse,
  type CaseHistoryDetailsResponse,
} from "../types/api";
import { logger } from "../middleware/logging";
import {
  performCaseHistorySearchPlaywright,
} from "../lib/playwright/caseHistorySearchPlaywright";
import {
  scrapeCaseHistoryDetailsPlaywright,
  toCaseHistoryDetailsResponsePlaywright,
} from "../lib/playwright/caseHistoryDetailsPlaywright";
import { getPjnPageForUser, closePjnPage } from "../lib/playwright/pjnPlaywrightSession";
import { toCaseHistorySearchResponse } from "../lib/caseHistorySearch";
import { refreshPjnTokens, isTokenExpired } from "../lib/pjnTokens";

const router: Router = Router();
const sessionStore = new SessionStore();

/**
 * Ensure the session has a valid (non-expired) access token.
 * If the token is expired, attempt to refresh it using the refresh token.
 * Returns the updated session or null if refresh fails.
 *
 * NOTE: This mirrors the logic used in the events route so that
 * case-history searches benefit from the same token refresh behavior.
 */
async function ensureValidToken(
  userId: string,
  session: SessionState
): Promise<SessionState | null> {
  // If no access token or no expiry info, we can't validate
  if (!session.accessToken || !session.accessTokenExpiresAt) {
    logger.warn("Session missing access token or expiry info", { userId });
    return null;
  }

  // Check if token is expired (with 60 second buffer)
  if (!isTokenExpired(session.accessTokenExpiresAt, 60)) {
    // Token is still valid
    return session;
  }

  // Token is expired, try to refresh
  if (!session.refreshToken) {
    logger.warn("Session has expired token but no refresh token", { userId });
    return null;
  }

  logger.info("Access token expired, attempting refresh (case history)", {
    userId,
    accessTokenExpiresAt: session.accessTokenExpiresAt,
  });

  try {
    const tokens = await refreshPjnTokens({
      refreshToken: session.refreshToken,
      cookies: session.cookies,
    });

    // Update session with new tokens
    session.accessToken = tokens.accessToken;
    session.refreshToken = tokens.refreshToken;
    session.accessTokenExpiresAt = new Date(
      Date.now() + tokens.expiresIn * 1000
    ).toISOString();

    // Update Authorization header
    session.headers = {
      ...(session.headers ?? {}),
      Authorization: `Bearer ${tokens.accessToken}`,
    };

    // Save updated session
    const saved = await sessionStore.saveSession(userId, session);
    if (!saved) {
      logger.error("Failed to save refreshed session (case history)", {
        userId,
      });
    } else {
      logger.info("Session refreshed successfully (case history)", {
        userId,
        newExpiresAt: session.accessTokenExpiresAt,
      });
    }

    return session;
  } catch (error) {
    logger.error("Failed to refresh token (case history)", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * POST /scrape/case-history/search
 *
 * Lightweight endpoint to exercise the PJN case history search HTTP
 * call. This is primarily intended for manual/testing usage while the
 * HTML parsing and full normalization pipeline are being implemented.
 */
router.post(
  "/scrape/case-history/search",
  async (req: Request, res: Response) => {
    const requestId = `req-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    try {
      const parsed = scrapeCaseHistorySearchRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        logger.warn("Invalid case history search request", {
          requestId,
          errors: parsed.error.issues,
        });
        return res.status(400).json({
          status: "ERROR",
          error: "Invalid request",
          code: "VALIDATION_ERROR",
          // details: parsed.error.issues,
        } satisfies CaseHistorySearchResponse);
      }

      const { userId, jurisdiction, caseNumber, year } = parsed.data;
      const fre = `${jurisdiction}-${caseNumber}/${year}`;

      logger.info("Starting case history search", {
        requestId,
        userId,
        fre,
        jurisdiction,
        caseNumber,
        year,
      });

      let session = await sessionStore.loadSession(userId);
      if (!session) {
        logger.warn("No session found for user (case history search)", {
          requestId,
          userId,
        });
        return res.json({
          status: "AUTH_REQUIRED",
          reason: "No session found. Please authenticate first.",
        } satisfies CaseHistorySearchResponse);
      }

      // Ensure we have a valid access token (refresh if expired),
      // mirroring the events route behavior.
      session = await ensureValidToken(userId, session);
      if (!session) {
        logger.warn(
          "Failed to ensure valid token for user (case history search)",
          {
            requestId,
            userId,
          }
        );
        return res.json({
          status: "AUTH_REQUIRED",
          reason:
            "Session expired and could not be refreshed. Please re-authenticate.",
        } satisfies CaseHistorySearchResponse);
      }

      try {
        // Get Playwright page for the session
        const { page, handle } = await getPjnPageForUser(session);
        
        try {
          const result = await performCaseHistorySearchPlaywright(page, {
            jurisdiction,
            caseNumber,
            year,
            requestId,
          });

          // Convert to response format (reusing existing helper)
          const response = toCaseHistorySearchResponse(result);
        logger.info("Case history search completed", {
          requestId,
          userId,
          fre,
          status: response.status,
          candidateCount: result.candidates.length,
          hasSelected: Boolean(result.selectedCandidate),
        });

          return res.json(response);
        } finally {
          // Always close the page and browser handle
          await closePjnPage(page, handle);
        }
      } catch (error) {
        if (error instanceof Error && error.message === "AUTH_REQUIRED") {
          logger.warn("Auth required during case history search", {
            requestId,
            userId,
          });
          return res.json({
            status: "AUTH_REQUIRED",
            reason: "Session expired or invalid",
          } satisfies CaseHistorySearchResponse);
        }

        logger.error("Case history search failed", {
          requestId,
          userId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        return res.status(500).json({
          status: "ERROR",
          error: error instanceof Error ? error.message : "Unknown error",
          code: "SCRAPE_ERROR",
        } satisfies CaseHistorySearchResponse);
      }
    } catch (error) {
      logger.error("Unhandled error in case history search route", {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return res.status(500).json({
        status: "ERROR",
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      } satisfies CaseHistorySearchResponse);
    }
  }
);

/**
 * POST /scrape/case-history/details
 *
 * Endpoint to scrape the full PJN case history (movimientos + Doc. digitales)
 * for a given FRE using the expediente.seam portal.
 *
 * Mirrors the auth/session handling of the search endpoint, including token
 * refresh and AUTH_REQUIRED signalling back to Convex.
 */
router.post(
  "/scrape/case-history/details",
  async (req: Request, res: Response) => {
    const requestId = `req-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    try {
      const parsed = scrapeCaseHistoryDetailsRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        logger.warn("Invalid case history details request", {
          requestId,
          errors: parsed.error.issues,
        });
        return res.status(400).json({
          status: "ERROR",
          error: "Invalid request",
          code: "VALIDATION_ERROR",
        } satisfies CaseHistoryDetailsResponse);
      }

      const {
        userId,
        fre,
        includeMovements,
        includeDocuments,
        includeIntervinientes,
        includeVinculados,
        maxMovements,
        maxDocuments,
      } = parsed.data;

      logger.info("Starting case history details scrape", {
        requestId,
        userId,
        fre,
      });

      let session = await sessionStore.loadSession(userId);
      if (!session) {
        logger.warn("No session found for user (case history details)", {
          requestId,
          userId,
        });
        return res.json({
          status: "AUTH_REQUIRED",
          reason: "No session found. Please authenticate first.",
        } satisfies CaseHistoryDetailsResponse);
      }

      // Ensure we have a valid access token (refresh if expired),
      // mirroring the events and search route behavior.
      session = await ensureValidToken(userId, session);
      if (!session) {
        logger.warn(
          "Failed to ensure valid token for user (case history details)",
          {
            requestId,
            userId,
          }
        );
        return res.json({
          status: "AUTH_REQUIRED",
          reason:
            "Session expired and could not be refreshed. Please re-authenticate.",
        } satisfies CaseHistoryDetailsResponse);
      }

      try {
        const result = await scrapeCaseHistoryDetailsPlaywright(session, {
          fre,
          userId,
          includeMovements,
          includeDocuments,
          includeIntervinientes,
          includeVinculados,
          maxMovements,
          maxDocuments,
          requestId,
          debugStorage: false,
        });

        const response = toCaseHistoryDetailsResponsePlaywright(result);

        logger.info("Case history details scrape completed", {
          requestId,
          userId,
          fre,
          stats: result.stats,
        });

        return res.json(response);
      } catch (error) {
        if (error instanceof Error && error.message === "AUTH_REQUIRED") {
          logger.warn("Auth required during case history details scrape", {
            requestId,
            userId,
          });
          return res.json({
            status: "AUTH_REQUIRED",
            reason: "Session expired or invalid",
          } satisfies CaseHistoryDetailsResponse);
        }

        logger.error("Case history details scrape failed", {
          requestId,
          userId,
          fre,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        return res.status(500).json({
          status: "ERROR",
          error: error instanceof Error ? error.message : "Unknown error",
          code: "SCRAPE_ERROR",
        } satisfies CaseHistoryDetailsResponse);
      }
    } catch (error) {
      logger.error("Unhandled error in case history details route", {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return res.status(500).json({
        status: "ERROR",
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      } satisfies CaseHistoryDetailsResponse);
    }
  }
);

export default router;

