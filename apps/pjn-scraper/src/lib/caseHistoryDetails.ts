import { logger } from "../middleware/logging";
import { config } from "../config";
import type { SessionState } from "./sessionStore";
import { GcsStorage } from "./storage";
import type {
  NormalizedMovement,
  NormalizedDigitalDocument,
  CaseHistoryStats,
  CaseHistoryDetailsResponse,
} from "../types/api";

/**
 * Options for scraping the full historical docket for a PJN expediente
 * from `expediente.seam`.
 */
export interface CaseHistoryDetailsOptions {
  /**
   * Normalized FRE / claveExpediente identifier for the case.
   */
  fre: string;
  /**
   * Internal PJN case identifier used as the `cid` query parameter
   * when navigating to `expediente.seam`.
   */
  cid: string;
  /**
   * Identifier of the iAlex user on whose behalf we are scraping.
   * Used primarily for storage path partitioning and observability.
   */
  userId: string;
  /**
   * Whether to scrape the Actuaciones table.
   * Defaults to `true` when omitted.
   */
  includeMovements?: boolean;
  /**
   * Whether to scrape the "Doc. digitales" tab.
   * Defaults to `true` when omitted.
   */
  includeDocuments?: boolean;
  /**
   * Soft limit for the maximum number of movimientos to ingest.
   */
  maxMovements?: number;
  /**
   * Soft limit for the maximum number of digital documents to download.
   */
  maxDocuments?: number;
  /**
   * Optional request identifier for structured logging.
   */
  requestId?: string;
}

/**
 * Result of scraping the PJN expediente page, independent of HTTP
 * transport concerns.
 *
 * This structure is designed to be directly consumed by Convex or
 * transformed into a `CaseHistoryDetailsResponse` by route handlers.
 */
export interface CaseHistoryDetailsResult {
  fre: string;
  cid: string;
  movimientos: NormalizedMovement[];
  docDigitales: NormalizedDigitalDocument[];
  stats: CaseHistoryStats;
}

/**
 * Scrape the full historical docket (movimientos and digital documents)
 * for a PJN expediente using the portal UI (`expediente.seam`).
 *
 * This function is responsible for:
 * - Creating a Playwright browser/context from the provided `SessionState`,
 *   reusing existing PJN cookies and headers.
 * - Navigating to `expediente.seam?cid={cid}` and waiting for the page
 *   to stabilize.
 * - Scraping and normalizing the Actuaciones table into `NormalizedMovement`
 *   entries, including any hints about associated documents.
 * - Loading and scraping the "Doc. digitales" tab, normalizing rows into
 *   `NormalizedDigitalDocument` entries.
 * - Downloading PDFs for movements/docs that expose a download action and
 *   uploading them to GCS via `GcsStorage`, populating `gcsPath` fields.
 * - Respecting `maxMovements` / `maxDocuments` soft limits and continuing
 *   gracefully when individual downloads fail.
 * - Producing aggregate `CaseHistoryStats` with counts, error totals, and
 *   an approximate duration.
 *
 * NOTE: The concrete Playwright, DOM querying, and PDF download logic are
 * not implemented yet; this is a typed placeholder to be implemented in
 * a follow-up step.
 */
export async function scrapeCaseHistoryDetails(
  session: SessionState,
  options: CaseHistoryDetailsOptions,
  storage: GcsStorage = new GcsStorage()
): Promise<CaseHistoryDetailsResult> {
  // Placeholder implementation: document intended behavior via JSDoc.
  logger.debug("scrapeCaseHistoryDetails called (placeholder)", {
    hasCookies: Boolean(session.cookies?.length),
    options,
    gcsBucket: config.gcsDocumentsBucket,
  });

  // `storage` is currently unused in the placeholder, but will be used
  // for uploading PDFs in the concrete implementation.
  void storage;

  throw new Error("Not implemented: scrapeCaseHistoryDetails");
}

/**
 * Convert a low-level `CaseHistoryDetailsResult` into the public
 * `CaseHistoryDetailsResponse` shape used by the HTTP router.
 *
 * Route handlers can use this helper to encapsulate the mapping between
 * internal scraping results and the API contract returned to Convex.
 *
 * This helper should:
 * - Map the normalized movimientos and documents directly to the response.
 * - Attach the aggregate `stats` object.
 * - Always return a `"OK"` variant; error conditions are handled at the
 *   route/scraper level before calling this helper.
 *
 * NOTE: This is a pure transformation and must not perform any I/O.
 */
export function toCaseHistoryDetailsResponse(
  result: CaseHistoryDetailsResult
): CaseHistoryDetailsResponse {
  // Placeholder implementation: document intended behavior via JSDoc.
  logger.debug("toCaseHistoryDetailsResponse called (placeholder)", {
    movimientosCount: result.movimientos.length,
    docsCount: result.docDigitales.length,
  });

  throw new Error("Not implemented: toCaseHistoryDetailsResponse");
}

