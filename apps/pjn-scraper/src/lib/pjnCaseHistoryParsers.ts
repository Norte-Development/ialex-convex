import type {
  NormalizedCaseCandidate,
  NormalizedMovement,
  NormalizedDigitalDocument,
} from "../types/api";

/**
 * Parse the HTML contents of the PJN case search results table on
 * `consultaListaRelacionados.seam` into a list of normalized candidates.
 *
 * This function should:
 * - Locate the main results table and iterate each expediente row.
 * - Extract claveExpediente / FRE, carátula, jurisdiction, and any
 *   hidden `cid` or action parameters required to navigate to
 *   `expediente.seam`.
 * - Normalize the FRE using the same conventions as the rest of the
 *   PJN integration (e.g. "FRE 3852/2020/TO2" → "FRE-3852/2020/TO2").
 * - Produce `NormalizedCaseCandidate` objects for each row, preserving
 *   the original raw strings for debugging where useful.
 *
 * NOTE: This parser should be resilient to minor markup changes and
 * should fail with clear errors when the overall structure breaks.
 */
export function parseCaseSearchResultsHtml(
  html: string
): NormalizedCaseCandidate[] {
  // Implementation will be added in a follow-up step.
  throw new Error("Not implemented: parseCaseSearchResultsHtml");
}

/**
 * Parse the HTML for the Actuaciones table on `expediente.seam` into
 * a list of normalized movimientos.
 *
 * This function should:
 * - Identify the table or container that lists movements.
 * - Extract the movement date/time, description text, and any flags
 *   or indicators that a downloadable document is present.
 * - Derive a stable `movementId` for idempotency (using a portal
 *   identifier when available, or a deterministic hash of FRE +
 *   date + description).
 * - Capture any document reference tokens (e.g. JSF component IDs or
 *   link query parameters) that can later be matched up with digital
 *   documents.
 * - Return `NormalizedMovement` entries with raw HTML snippets when
 *   helpful for debugging.
 */
export function parseActuacionesHtml(html: string): NormalizedMovement[] {
  // Implementation will be added in a follow-up step.
  throw new Error("Not implemented: parseActuacionesHtml");
}

/**
 * Parse the HTML for the "Doc. digitales" tab on `expediente.seam`
 * into a list of normalized digital documents.
 *
 * This function should:
 * - Locate the digital documents table or list container.
 * - Extract the document date, description/type, and any author/office
 *   metadata that can be preserved in the description.
 * - Derive a stable `docId` for idempotency, preferring any portal-
 *   provided identifiers from the DOM or download URLs.
 * - Extract a reference to the underlying download action (e.g. URL,
 *   JSF form/action parameters) so higher-level code can initiate
 *   the actual PDF download.
 * - Return `NormalizedDigitalDocument` entries with raw HTML
 *   snippets when useful for troubleshooting scraping breakages.
 */
export function parseDocDigitalesHtml(
  html: string
): NormalizedDigitalDocument[] {
  // Implementation will be added in a follow-up step.
  throw new Error("Not implemented: parseDocDigitalesHtml");
}

