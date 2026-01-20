import { Router, Request, Response } from "express";
import { SessionStore, SessionState } from "../lib/sessionStore";
import { PjnHttpClient } from "../lib/httpClient";
import { GcsStorage } from "../lib/storage";
import { scrapeEventsRequestSchema, type NormalizedEvent } from "../types/api";
import { refreshPjnTokens, isTokenExpired } from "../lib/pjnTokens";
import { logger } from "../middleware/logging";
import { config } from "../config";
import { parseClaveExpediente } from "../constants";

const router: Router = Router();
const sessionStore = new SessionStore();
const httpClient = new PjnHttpClient();
const gcsStorage = new GcsStorage();

/**
 * Ensure the session has a valid (non-expired) access token.
 * If the token is expired, attempt to refresh it using the refresh token.
 * Returns the updated session or null if refresh fails.
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

  logger.info("Access token expired, attempting refresh", {
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
      logger.error("Failed to save refreshed session", { userId });
    } else {
      logger.info("Session refreshed successfully", {
        userId,
        newExpiresAt: session.accessTokenExpiresAt,
      });
    }

    return session;
  } catch (error) {
    logger.error("Failed to refresh token", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Normalize a PJN event to our internal format
 *
 * Actual PJN response example:
 * {
 *   "id": 299230997,
 *   "fechaCreacion": 1764671464770,
 *   "fechaAccion": 1764671464767,
 *   "tipo": "cedula",
 *   "categoria": "judicial",
 *   "link": { "app": "pjn-scw", "url": "/consultaNovedad.seam?..." },
 *   "hasDocument": true,
 *   "payload": {
 *     "id": 128865748,
 *     "caratulaExpediente": "...",
 *     "claveExpediente": "FRE 3852/2020/TO2",
 *     "tipoEvento": "cedula",
 *     "fechaEnvio": 1764671464767,
 *     ...
 *   }
 * }
 */
function normalizeEvent(event: unknown): NormalizedEvent | null {
  try {
    const e = event as Record<string, unknown>;
    const payload = (e.payload ?? {}) as Record<string, unknown>;

    // Event ID: use top-level id, fall back to payload.id if needed
    const eventIdRaw = e.id ?? payload.id;
    const eventId = eventIdRaw != null ? String(eventIdRaw) : "";
    if (!eventId) {
      return null;
    }

    // FRE from payload.claveExpediente (e.g. "FRE 8380/2023/TO1/27")
    // Now supports all PJN jurisdictions (CSJ, CIV, CAF, FRE, etc.)
    let fre: string | null = null;
    const claveExpediente =
      typeof payload.claveExpediente === "string"
        ? payload.claveExpediente.trim()
        : "";

    if (claveExpediente) {
      const parsed = parseClaveExpediente(claveExpediente);
      if (parsed) {
        // Use the full identifier format: "FRE-3852/2020/TO2"
        fre = parsed.fullIdentifier;
      } else {
        // Fallback: use raw claveExpediente if parsing fails
        fre = claveExpediente;
      }
    }

    // Description from payload.caratulaExpediente
    const description =
      typeof payload.caratulaExpediente === "string"
        ? payload.caratulaExpediente.trim()
        : "";

    // Timestamp from fechaAccion / fechaCreacion / payload.fechaEnvio
    const rawTs =
      (e.fechaAccion as number | string | undefined) ??
      (e.fechaCreacion as number | string | undefined) ??
      (payload.fechaEnvio as number | string | undefined);

    let timestamp: string;
    if (typeof rawTs === "number") {
      timestamp = new Date(rawTs).toISOString();
    } else if (typeof rawTs === "string" && /^\d+$/.test(rawTs)) {
      timestamp = new Date(Number(rawTs)).toISOString();
    } else if (typeof rawTs === "string" && rawTs) {
      timestamp = rawTs;
    } else {
      timestamp = new Date().toISOString();
    }

    return {
      pjnEventId: eventId,
      fre,
      timestamp,
      category: String(e.categoria || e.category || "judicial"),
      description,
      pdfUrl: undefined,
      rawPayload: e,
    };
  } catch (error) {
    logger.warn("Failed to normalize event", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Check if an event is newer than the cutoff
 */
function isEventNew(
  event: NormalizedEvent,
  since?: string,
  lastEventId?: string
): boolean {
  if (lastEventId && event.pjnEventId === lastEventId) {
    return false; // We've reached the last known event
  }

  if (since) {
    const eventTime = new Date(event.timestamp).getTime();
    const sinceTime = new Date(since).getTime();
    return eventTime > sinceTime;
  }

  return true; // If no cutoff, assume all events are new
}

/**
 * POST /scrape/events
 * Scrape PJN events for a user
 */
router.post("/scrape/events", async (req: Request, res: Response) => {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  try {
    // Validate request
    const parsed = scrapeEventsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn("Invalid scrape events request", {
        requestId,
        errors: parsed.error.issues,
      });
      return res.status(400).json({
        status: "ERROR",
        error: "Invalid request",
        code: "VALIDATION_ERROR",
        details: parsed.error.issues,
      });
    }

    const { userId, since, lastEventId } = parsed.data;

    logger.info("Starting events scrape", {
      requestId,
      userId,
      since,
      lastEventId,
    });

    // Load session
    let session = await sessionStore.loadSession(userId);
    if (!session) {
      logger.warn("No session found for user", { requestId, userId });
      return res.json({
        status: "AUTH_REQUIRED",
        reason: "No session found. Please authenticate first.",
      });
    }

    // Ensure we have a valid access token (refresh if expired)
    session = await ensureValidToken(userId, session);
    if (!session) {
      logger.warn("Failed to ensure valid token for user", { requestId, userId });
      return res.json({
        status: "AUTH_REQUIRED",
        reason: "Session expired and could not be refreshed. Please re-authenticate.",
      });
    }

    // Fetch events with pagination
    const normalizedEvents: NormalizedEvent[] = [];
    let page = 0;
    let fetchedPages = 0;
    let hasMore = true;
    let authRequired = false;

    while (hasMore && fetchedPages < config.maxPagesPerSync) {
      try {
        const result = await httpClient.fetchEvents(
          page,
          config.eventsPageSize,
          session,
          {
            categoria: "judicial",
            // Remove fechaHasta for now to match the portal's own calls
            // fechaHasta: since ? undefined : new Date().toISOString(),
          },
        );

        // Normalize events
        for (const event of result.events) {
          const normalized = normalizeEvent(event);
          if (normalized && isEventNew(normalized, since, lastEventId)) {
            normalizedEvents.push(normalized);
          } else if (normalized && lastEventId && normalized.pjnEventId === lastEventId) {
            // Found the last known event, stop paginating
            hasMore = false;
            break;
          }
        }

        fetchedPages++;
        hasMore = result.hasMore && normalizedEvents.length > 0;
        page++;

        // If we found the lastEventId, stop
        if (lastEventId && normalizedEvents.some((e) => e.pjnEventId === lastEventId)) {
          hasMore = false;
        }
      } catch (error) {
        if (error instanceof Error && error.message === "AUTH_REQUIRED") {
          authRequired = true;
          break;
        }
        throw error;
      }
    }

    if (authRequired) {
      logger.warn("Auth required during scrape", { requestId, userId });
      return res.json({
        status: "AUTH_REQUIRED",
        reason: "Session expired or invalid",
      });
    }

    // Process PDFs for new events
    const pdfResults: Array<{ eventId: string; gcsPath?: string; error?: string }> = [];

    for (const event of normalizedEvents) {
      // Respect hasDocument flag from raw payload when available
      const raw = event.rawPayload as Record<string, unknown>;
      const hasDocumentFlag =
        typeof raw.hasDocument === "boolean" ? raw.hasDocument : true;

      if (!hasDocumentFlag || !event.pjnEventId) {
        continue;
      }

      try {
        // Check if PDF already exists (idempotency)
        const exists = await gcsStorage.pdfExists(userId, event.pjnEventId);
        if (exists) {
          logger.debug("PDF already exists, skipping", {
            requestId,
            userId,
            eventId: event.pjnEventId,
          });
          const gcsPath = `gs://${config.gcsDocumentsBucket}/pjn/${userId}/${event.pjnEventId}.pdf`;
          event.gcsPath = gcsPath;
          pdfResults.push({ eventId: event.pjnEventId, gcsPath });
          continue;
        }

        // Download PDF
        const pdfBuffer = await httpClient.downloadPdf(event.pjnEventId, session);
        if (!pdfBuffer) {
          pdfResults.push({
            eventId: event.pjnEventId,
            error: "Failed to download PDF",
          });
          continue;
        }

        // Upload to GCS
        const gcsPath = await gcsStorage.uploadPdf(userId, event.pjnEventId, pdfBuffer);
        event.gcsPath = gcsPath;
        pdfResults.push({ eventId: event.pjnEventId, gcsPath });

        // Notify document-processor (async, don't wait)
        // Note: We'll need Convex to provide callbackUrl and handle the signed URL
        // For now, we'll skip this and let Convex handle it after receiving the response
      } catch (error) {
        logger.error("Failed to process PDF for event", {
          requestId,
          userId,
          eventId: event.pjnEventId,
          error: error instanceof Error ? error.message : String(error),
        });
        pdfResults.push({
          eventId: event.pjnEventId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const duration = Date.now() - startTime;
    logger.info("Events scrape completed", {
      requestId,
      userId,
      fetchedPages,
      newEvents: normalizedEvents.length,
      pdfsProcessed: pdfResults.filter((r) => r.gcsPath).length,
      duration,
    });

    res.json({
      status: "OK",
      events: normalizedEvents,
      stats: {
        fetchedPages,
        newEvents: normalizedEvents.length,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("Events scrape failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration,
    });

    res.status(500).json({
      status: "ERROR",
      error: error instanceof Error ? error.message : "Unknown error",
      code: "SCRAPE_ERROR",
    });
  }
});

export default router;

