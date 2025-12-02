import { Router, Request, Response } from "express";
import { z } from "zod";
import { SessionStore } from "../lib/sessionStore";
import { PjnHttpClient } from "../lib/httpClient";
import { GcsStorage } from "../lib/storage";
import { scrapeEventsRequestSchema, type NormalizedEvent } from "../types/api";
import { logger } from "../middleware/logging";
import { config } from "../config";

const router: Router = Router();
const sessionStore = new SessionStore();
const httpClient = new PjnHttpClient();
const gcsStorage = new GcsStorage();

/**
 * Normalize a PJN event to our internal format
 */
function normalizeEvent(event: unknown): NormalizedEvent | null {
  try {
    const e = event as Record<string, unknown>;
    const eventId = String(e.id || e.eventId || "");
    if (!eventId) {
      return null;
    }

    // Extract FRE from description or a dedicated field
    let fre: string | null = null;
    const description = String(e.descripcion || e.description || "");
    const freMatch = description.match(/FRE\s+(\d+\/\d+\/\d+\/[A-Z0-9]+)/i);
    if (freMatch) {
      fre = freMatch[1];
    } else if (e.fre) {
      fre = String(e.fre);
    }

    return {
      pjnEventId: eventId,
      fre,
      timestamp: String(e.fecha || e.timestamp || new Date().toISOString()),
      category: String(e.categoria || e.category || "judicial"),
      description,
      pdfUrl: e.pdfUrl ? String(e.pdfUrl) : undefined,
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
    const session = await sessionStore.loadSession(userId);
    if (!session) {
      logger.warn("No session found for user", { requestId, userId });
      return res.json({
        status: "AUTH_REQUIRED",
        reason: "No session found. Please authenticate first.",
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
        const result = await httpClient.fetchEvents(page, config.eventsPageSize, session, {
          categoria: "judicial",
          fechaHasta: since ? undefined : new Date().toISOString(),
        });

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
      if (!event.pdfUrl && !event.pjnEventId) {
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

