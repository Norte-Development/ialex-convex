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

/**
 * Request schema for searching PJN case history (consultaListaRelacionados.seam).
 *
 * Requires jurisdiction, caseNumber, and year to perform the search.
 */
export const scrapeCaseHistorySearchRequestSchema = z.object({
  userId: z.string(),
  jurisdiction: z.string(),
  caseNumber: z.string(),
  year: z.number().int(),
});

/**
 * Request schema for scraping detailed PJN case history for a specific expediente.
 *
 * This targets expediente.seam for a given FRE and optionally allows callers to
 * control which sections are scraped and soft limits for volume.
 */
export const scrapeCaseHistoryDetailsRequestSchema = z.object({
  userId: z.string(),
  fre: z.string(),
  includeMovements: z.boolean().optional(),
  includeDocuments: z.boolean().optional(),
  maxMovements: z.number().int().positive().optional(),
  maxDocuments: z.number().int().positive().optional(),
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
 * Normalized PJN case search result candidate from consultaListaRelacionados.seam.
 */
export interface NormalizedCaseCandidate {
  /**
   * Normalized FRE / claveExpediente identifier (e.g. "FRE-3852/2020/TO2").
   */
  fre: string;
  /**
   * Raw claveExpediente text as it appeared in the PJN UI (e.g. "FRE 3852/2020/TO2").
   */
  rawClaveExpediente?: string | null;
  /**
   * Jurisdiction code parsed from the claveExpediente, when available.
   */
  jurisdiction?: string | null;
  /**
   * Case number portion parsed from the claveExpediente (e.g. "3852/2020/TO2").
   */
  caseNumber?: string | null;
  /**
   * Case title / carátula as displayed by the portal.
   */
  caratula?: string | null;
  /**
   * Row index in the search results table, used for JSF form submission to navigate to expediente.seam.
   */
  rowIndex: number;
}

/**
 * Normalized movement entry from the Actuaciones table on expediente.seam.
 */
export interface NormalizedMovement {
  /**
   * Stable identifier for the movement used for idempotency.
   * Prefer a portal-provided ID when available; otherwise a deterministic hash.
   */
  movementId: string;
  /**
   * FRE associated with this movement, if it can be inferred.
   */
  fre: string | null;
  /**
   * Movement date/time as an ISO timestamp.
   */
  date: string;
  /**
   * Human-readable description of the actuación.
   */
  description: string;
  /**
   * Whether this movement has an associated document that can be downloaded.
   */
  hasDocument: boolean;
  /**
   * Source section where the document link was discovered.
   */
  documentSource?: "actuaciones" | "doc_digitales";
  /**
   * Optional reference string extracted from the DOM to later correlate with Doc. digitales.
   */
  docRef?: string | null;
  /**
   * GCS path where the associated PDF was uploaded, if any.
   */
  gcsPath?: string;
}

/**
 * Normalized digital document entry from the "Doc. digitales" tab
 * or inferred directly from Actuaciones rows.
 */
export interface NormalizedDigitalDocument {
  /**
   * Stable identifier for the document used for idempotency.
   * Prefer a portal-provided ID when available; otherwise a deterministic hash.
   */
  docId: string;
  /**
   * FRE associated with this document, if it can be inferred.
   */
  fre: string | null;
  /**
   * Document date as an ISO timestamp.
   */
  date: string;
  /**
   * Human-readable description or type of the document.
   */
  description: string;
  /**
   * Source section where the document originated.
   */
  source: "actuaciones" | "doc_digitales";
  /**
   * GCS path where the document PDF was uploaded, if any.
   */
  gcsPath?: string;
  /**
   * Optional reference string extracted from the DOM.
   */
  docRef?: string | null;
}

/**
 * Aggregate statistics for a case history scrape run.
 */
export interface CaseHistoryStats {
  movimientosCount: number;
  docsCount: number;
  downloadErrors: number;
  durationMs: number;
}

/**
 * Response payload for /scrape/case-history/search.
 */
export type CaseHistorySearchResponse =
  | {
      status: "OK";
      fre: string;
      /**
       * Selected PJN case identifier (cid) that will be used to call expediente.seam.
       * This may be null when multiple candidates exist and the caller must choose.
       */
      cid: string | null;
      candidates: NormalizedCaseCandidate[];
      /**
       * Additional metadata about the selected case, if any.
       */
      caseMetadata?: Record<string, unknown>;
    }
  | {
      status: "NOT_FOUND";
      fre: string;
      candidates: NormalizedCaseCandidate[];
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
 * Normalized participant from Intervinientes tab.
 */
export interface NormalizedParticipant {
  participantId: string;
  role: string;
  name: string;
  details?: string;
}

/**
 * Normalized appeal from Recursos tab.
 */
export interface NormalizedAppeal {
  appealId: string;
  appealType: string;
  filedDate?: string;
  status?: string;
  court?: string;
  description?: string;
}

/**
 * Normalized related case from Vinculados tab.
 */
export interface NormalizedRelatedCase {
  relationId: string;
  relatedFre: string;
  relationshipType: string;
  relatedCaratula?: string;
  relatedCourt?: string;
}

/**
 * Response payload for /scrape/case-history/details.
 */
export type CaseHistoryDetailsResponse =
  | {
      status: "OK";
      fre: string;
      cid: string;
      movimientos: NormalizedMovement[];
      docDigitales: NormalizedDigitalDocument[];
      intervinientes?: NormalizedParticipant[];
      recursos?: NormalizedAppeal[];
      vinculados?: NormalizedRelatedCase[];
      stats: CaseHistoryStats;
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
 * PDF processing result
 */
export interface PdfProcessingResult {
  eventId: string;
  success: boolean;
  gcsPath?: string;
  error?: string;
}

