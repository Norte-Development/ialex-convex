import { z } from "zod";

/**
 * API request/response types for the PJN scraper microservice
 */

// Request schemas
export const scrapeEventsRequestSchema = z.object({
  userId: z.string(),
  since: z.string().optional(), // ISO timestamp
  lastEventId: z.string().optional(),
});

export const reauthRequestSchema = z.object({
  userId: z.string(),
  username: z.string(),
  password: z.string(),
});

// Response types
export type ScrapeEventsResponse =
  | {
      status: "OK";
      events: NormalizedEvent[];
      stats: {
        fetchedPages: number;
        newEvents: number;
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

export type ReauthResponse =
  | {
      status: "OK";
      sessionSaved: boolean;
    }
  | {
      status: "AUTH_FAILED";
      reason: string;
    }
  | {
      status: "ERROR";
      error: string;
    };

/**
 * Normalized PJN event structure
 */
export interface NormalizedEvent {
  pjnEventId: string;
  fre: string | null; // FRE (expediente) extracted from event
  timestamp: string; // ISO timestamp
  category: string;
  description: string;
  pdfUrl?: string; // URL to download PDF if available
  gcsPath?: string; // GCS path after upload (set by scraper)
  rawPayload: Record<string, unknown>; // Original PJN event data
}

/**
 * PDF processing result
 */
export interface PdfProcessingResult {
  eventId: string;
  success: boolean;
  gcsPath?: string;
  error?: string;
}

