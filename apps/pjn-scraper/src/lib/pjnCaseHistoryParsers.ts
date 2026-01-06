import * as cheerio from "cheerio";
import { createHash } from "crypto";
import type {
  NormalizedCaseCandidate,
  NormalizedMovement,
  NormalizedDigitalDocument,
} from "../types/api";
import { parseClaveExpediente } from "../constants";

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
  const $ = cheerio.load(html);
  const candidates: NormalizedCaseCandidate[] = [];

  // Locate the search results table
  const table = $("#tablaConsultaLista\\:tablaConsultaForm\\:j_idt179\\:dataTable");
  if (table.length === 0) {
    throw new Error(
      "Search results table not found. The page structure may have changed."
    );
  }

  // Iterate over each row in the tbody
  const rows = table.find("tbody tr");
  if (rows.length === 0) {
    // No results found - return empty array
    return [];
  }

  rows.each((index, element) => {
    const $row = $(element);
    const $cells = $row.find("td.column");

    if ($cells.length < 5) {
      // Skip rows that don't have the expected column structure
      return;
    }

    // Column 0: Expediente (e.g., " FGR 000023/2026")
    const expedienteText = $cells.eq(0).text().trim();
    if (!expedienteText) {
      return;
    }

    // Column 1: Dependencia (court/jurisdiction name)
    const dependencia = $cells.eq(1).text().trim();

    // Column 2: Carátula (case title/description)
    const caratula = $cells.eq(2).text().trim();

    // Column 3: Situación (status)
    const situacion = $cells.eq(3).text().trim();

    // Column 4: Últ. Act. (last activity date)
    const ultimaActividad = $cells.eq(4).text().trim();

    // Extract rowIndex from the onclick attribute in the actions column
    // Pattern: dataTable:{N}:j_idt230 where N is the rowIndex
    let rowIndex: number | null = null;
    const onclickAttr = $row.find("a[onclick]").attr("onclick");
    if (onclickAttr) {
      const rowIndexMatch = onclickAttr.match(/dataTable:(\d+):j_idt230/);
      if (rowIndexMatch && rowIndexMatch[1]) {
        rowIndex = parseInt(rowIndexMatch[1], 10);
      }
    }

    if (rowIndex === null) {
      // Skip rows where we can't extract the rowIndex
      return;
    }

    // Parse the expediente to extract jurisdiction and case number
    const parsed = parseClaveExpediente(expedienteText);
    if (!parsed) {
      // If parsing fails, we can't create a valid candidate
      return;
    }

    // Create the normalized candidate
    const candidate: NormalizedCaseCandidate = {
      fre: parsed.fullIdentifier,
      rawClaveExpediente: expedienteText,
      jurisdiction: parsed.jurisdiction,
      caseNumber: parsed.caseNumber,
      caratula: caratula || null,
      rowIndex: rowIndex,
      rawHtml: $row.html() || null,
    };

    candidates.push(candidate);
  });

  return candidates;
}

/**
 * Parse a date string in DD/MM/YYYY format to ISO timestamp.
 */
function parseDate(dateStr: string): string {
  const parts = dateStr.trim().split("/");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
  }
  // Fallback: return current date if parsing fails
  return new Date().toISOString();
}

/**
 * Generate a stable hash ID from a string.
 */
function generateHashId(input: string): string {
  return createHash("sha256").update(input).digest("hex").substring(0, 16);
}

/**
 * Extract FRE from the HTML page if available.
 */
function extractFreFromHtml(html: string): string | null {
  const $ = cheerio.load(html);
  // Look for FRE in common locations: page title, headers, or specific elements
  const frePattern = /(FRE|FSM|CSS|FCT|FGR|FTU)\s*([0-9/]+)/i;
  
  // Try to find FRE in page title or headers
  const title = $("title").text();
  const titleMatch = title.match(frePattern);
  if (titleMatch) {
    return `${titleMatch[1].toUpperCase()}-${titleMatch[2]}`;
  }

  // Try to find in h1, h2 headers
  const headers = $("h1, h2").text();
  const headerMatch = headers.match(frePattern);
  if (headerMatch) {
    return `${headerMatch[1].toUpperCase()}-${headerMatch[2]}`;
  }

  return null;
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
export function parseActuacionesHtml(html: string, fre?: string | null): NormalizedMovement[] {
  const $ = cheerio.load(html);
  const movements: NormalizedMovement[] = [];

  // Try to extract FRE from HTML if not provided
  const extractedFre = fre || extractFreFromHtml(html);

  // Look for Actuaciones table - common JSF table patterns
  // Try multiple selectors for robustness
  const tableSelectors = [
    'table[id*="actuaciones" i]',
    'table[id*="movimientos" i]',
    'table[class*="dataTable"]',
    'table.rf-dg',
    'div[id*="actuaciones" i] table',
    'div[id*="movimientos" i] table',
  ];

  let table = $();
  for (const selector of tableSelectors) {
    table = $(selector).first();
    if (table.length > 0) {
      break;
    }
  }

  // If no table found, try to find any table with date-like columns
  if (table.length === 0) {
    // Look for tables with tbody containing rows
    const tables = $("table tbody tr");
    if (tables.length > 0) {
      // Use the first table that has rows
      table = tables.first().closest("table");
    }
  }

  if (table.length === 0) {
    // No table found - return empty array (might be a page without movements)
    return [];
  }

  // Find all rows in the table
  const rows = table.find("tbody tr, tr");
  
  rows.each((index, element) => {
    const $row = $(element);
    const $cells = $row.find("td");

    if ($cells.length < 2) {
      // Skip rows without enough cells
      return;
    }

    // Common patterns:
    // Column 0 or 1: Date (DD/MM/YYYY)
    // Column 1 or 2: Description
    // Last column or specific column: Document indicator/link

    let dateStr = "";
    let description = "";
    let hasDocument = false;
    let docRef: string | null = null;

    // Try to find date in first few columns
    for (let i = 0; i < Math.min(3, $cells.length); i++) {
      const cellText = $cells.eq(i).text().trim();
      // Check if it looks like a date (DD/MM/YYYY)
      if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(cellText)) {
        dateStr = cellText;
        // Description is likely in the next column
        if (i + 1 < $cells.length) {
          description = $cells.eq(i + 1).text().trim();
        }
        break;
      }
    }

    // If we didn't find a date pattern, try to extract from all cells
    if (!dateStr && $cells.length >= 2) {
      dateStr = $cells.eq(0).text().trim();
      description = $cells.eq(1).text().trim();
    }

    // Look for document indicators: download links, PDF icons, etc.
    const downloadLinks = $row.find('a[href*="pdf" i], a[href*="download" i], a[onclick*="download" i]');
    if (downloadLinks.length > 0) {
      hasDocument = true;
      // Extract docRef from link href or onclick
      const link = downloadLinks.first();
      const href = link.attr("href");
      const onclick = link.attr("onclick");
      docRef = href || onclick || null;
    }

    // Also check for PDF icons or document indicators in the row
    const pdfIndicators = $row.find('i[class*="pdf" i], i[class*="file" i], img[src*="pdf" i]');
    if (pdfIndicators.length > 0) {
      hasDocument = true;
    }

    // Check for text indicators like "Ver documento", "Descargar", etc.
    const rowText = $row.text().toLowerCase();
    if (rowText.includes("documento") || rowText.includes("descargar") || rowText.includes("pdf")) {
      hasDocument = true;
    }

    if (!description && !dateStr) {
      // Skip rows without meaningful content
      return;
    }

    // Parse date to ISO format
    const date = dateStr ? parseDate(dateStr) : new Date().toISOString();

    // Generate movementId: hash of (fre + date + description)
    const idInput = `${extractedFre || "unknown"}|${date}|${description}`;
    const movementId = generateHashId(idInput);

    const movement: NormalizedMovement = {
      movementId,
      fre: extractedFre,
      date,
      description: description || "Sin descripción",
      hasDocument,
      documentSource: "actuaciones",
      docRef,
      rawHtml: $row.html() || null,
    };

    movements.push(movement);
  });

  return movements;
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
  html: string,
  fre?: string | null
): NormalizedDigitalDocument[] {
  const $ = cheerio.load(html);
  const documents: NormalizedDigitalDocument[] = [];

  // Try to extract FRE from HTML if not provided
  const extractedFre = fre || extractFreFromHtml(html);

  // Look for Doc. digitales table - common JSF table patterns
  // Try multiple selectors for robustness
  const tableSelectors = [
    'table[id*="doc" i][id*="digital" i]',
    'table[id*="documentos" i]',
    'div[id*="doc" i][id*="digital" i] table',
    'div[id*="documentos" i] table',
    'table[class*="dataTable"]',
    'table.rf-dg',
  ];

  let table = $();
  for (const selector of tableSelectors) {
    table = $(selector).first();
    if (table.length > 0) {
      break;
    }
  }

  // If no table found, try to find any table with date-like columns
  if (table.length === 0) {
    // Look for tables with tbody containing rows
    const tables = $("table tbody tr");
    if (tables.length > 0) {
      // Use the first table that has rows
      table = tables.first().closest("table");
    }
  }

  if (table.length === 0) {
    // No table found - return empty array (might be a page without documents)
    return [];
  }

  // Find all rows in the table
  const rows = table.find("tbody tr, tr");
  
  rows.each((index, element) => {
    const $row = $(element);
    const $cells = $row.find("td");

    if ($cells.length < 2) {
      // Skip rows without enough cells
      return;
    }

    // Common patterns:
    // Column 0 or 1: Date (DD/MM/YYYY)
    // Column 1 or 2: Description/Type
    // Last column: Download link

    let dateStr = "";
    let description = "";
    let docRef: string | null = null;

    // Try to find date in first few columns
    for (let i = 0; i < Math.min(3, $cells.length); i++) {
      const cellText = $cells.eq(i).text().trim();
      // Check if it looks like a date (DD/MM/YYYY)
      if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(cellText)) {
        dateStr = cellText;
        // Description is likely in the next column
        if (i + 1 < $cells.length) {
          description = $cells.eq(i + 1).text().trim();
        }
        break;
      }
    }

    // If we didn't find a date pattern, try to extract from all cells
    if (!dateStr && $cells.length >= 2) {
      dateStr = $cells.eq(0).text().trim();
      description = $cells.eq(1).text().trim();
    }

    // Look for download links in the row
    const downloadLinks = $row.find('a[href*="pdf" i], a[href*="download" i], a[onclick*="download" i], a[href*="doc" i]');
    if (downloadLinks.length > 0) {
      const link = downloadLinks.first();
      const href = link.attr("href");
      const onclick = link.attr("onclick");
      docRef = href || onclick || null;

      // Extract any ID from the link or parent element
      const linkId = link.attr("id");
      if (linkId) {
        docRef = linkId;
      }
    }

    // Also check for form inputs or buttons that might trigger downloads
    const downloadButtons = $row.find('input[type="submit"][value*="descargar" i], button[onclick*="download" i]');
    if (downloadButtons.length > 0 && !docRef) {
      const button = downloadButtons.first();
      const onclick = button.attr("onclick");
      const name = button.attr("name");
      docRef = onclick || name || null;
    }

    if (!description && !dateStr) {
      // Skip rows without meaningful content
      return;
    }

    // Parse date to ISO format
    const date = dateStr ? parseDate(dateStr) : new Date().toISOString();

    // Generate docId: prefer docRef if available, otherwise hash
    let docId: string;
    if (docRef) {
      // Try to extract an ID from docRef, or use it directly
      const idMatch = docRef.match(/(\d+)/);
      if (idMatch) {
        docId = idMatch[1];
      } else {
        docId = generateHashId(docRef);
      }
    } else {
      // Generate hash from (fre + date + description)
      const idInput = `${extractedFre || "unknown"}|${date}|${description}`;
      docId = generateHashId(idInput);
    }

    const document: NormalizedDigitalDocument = {
      docId,
      fre: extractedFre,
      date,
      description: description || "Sin descripción",
      source: "doc_digitales",
      docRef,
      rawHtml: $row.html() || null,
    };

    documents.push(document);
  });

  return documents;
}

/**
 * Normalized participant entry from the Intervinientes tab.
 */
export interface NormalizedParticipant {
  participantId: string;
  role: string;
  name: string;
  details?: string;
}

/**
 * Parse the Intervinientes tab HTML into normalized participants.
 */
export function parseIntervinientesHtml(html: string): NormalizedParticipant[] {
  const $ = cheerio.load(html);
  const participants: NormalizedParticipant[] = [];

  const tableSelectors = [
    'table[id*="intervinientes" i]',
    'div[id*="intervinientes" i] table',
    'table[class*="dataTable"]',
  ];

  let table = $();
  for (const selector of tableSelectors) {
    table = $(selector).first();
    if (table.length > 0) break;
  }

  if (table.length === 0) return [];

  const rows = table.find("tbody tr, tr");
  rows.each((_, element) => {
    const $row = $(element);
    const $cells = $row.find("td");
    if ($cells.length < 2) return;

    const role = $cells.eq(0).text().trim();
    const name = $cells.eq(1).text().trim();
    const details = $cells.length > 2 ? $cells.eq(2).text().trim() : undefined;

    if (!role || !name) return;

    const participantId = generateHashId(`${role}|${name}|${details ?? ""}`);
    participants.push({ participantId, role, name, details: details || undefined });
  });

  return participants;
}

/**
 * Normalized appeal entry from the Recursos tab.
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
 * Parse the Recursos tab HTML into normalized appeals.
 */
export function parseRecursosHtml(html: string): NormalizedAppeal[] {
  const $ = cheerio.load(html);
  const appeals: NormalizedAppeal[] = [];

  const tableSelectors = [
    'table[id*="recursos" i]',
    'div[id*="recursos" i] table',
    'table[class*="dataTable"]',
  ];

  let table = $();
  for (const selector of tableSelectors) {
    table = $(selector).first();
    if (table.length > 0) break;
  }

  if (table.length === 0) return [];

  const rows = table.find("tbody tr, tr");
  rows.each((_, element) => {
    const $row = $(element);
    const $cells = $row.find("td");
    if ($cells.length < 2) return;

    const appealType = $cells.eq(0).text().trim();
    const filedDate = $cells.length > 1 ? $cells.eq(1).text().trim() : undefined;
    const status = $cells.length > 2 ? $cells.eq(2).text().trim() : undefined;
    const court = $cells.length > 3 ? $cells.eq(3).text().trim() : undefined;
    const description = $cells.length > 4 ? $cells.eq(4).text().trim() : undefined;

    if (!appealType) return;

    const appealId = generateHashId(`${appealType}|${filedDate ?? ""}|${status ?? ""}`);
    appeals.push({
      appealId,
      appealType,
      filedDate: filedDate || undefined,
      status: status || undefined,
      court: court || undefined,
      description: description || undefined,
    });
  });

  return appeals;
}

/**
 * Normalized related case entry from the Vinculados tab.
 */
export interface NormalizedRelatedCase {
  relationId: string;
  relatedFre: string;
  relationshipType: string;
  relatedCaratula?: string;
  relatedCourt?: string;
}

/**
 * Parse the Vinculados tab HTML into normalized related cases.
 */
export function parseVinculadosHtml(html: string): NormalizedRelatedCase[] {
  const $ = cheerio.load(html);
  const relatedCases: NormalizedRelatedCase[] = [];

  const tableSelectors = [
    'table[id*="vinculados" i]',
    'div[id*="vinculados" i] table',
    'table[class*="dataTable"]',
  ];

  let table = $();
  for (const selector of tableSelectors) {
    table = $(selector).first();
    if (table.length > 0) break;
  }

  if (table.length === 0) return [];

  const rows = table.find("tbody tr, tr");
  rows.each((_, element) => {
    const $row = $(element);
    const $cells = $row.find("td");
    if ($cells.length < 2) return;

    const relatedFre = $cells.eq(0).text().trim();
    const relationshipType = $cells.eq(1).text().trim();
    const relatedCaratula = $cells.length > 2 ? $cells.eq(2).text().trim() : undefined;
    const relatedCourt = $cells.length > 3 ? $cells.eq(3).text().trim() : undefined;

    if (!relatedFre || !relationshipType) return;

    const relationId = generateHashId(`${relatedFre}|${relationshipType}`);
    relatedCases.push({
      relationId,
      relatedFre,
      relationshipType,
      relatedCaratula: relatedCaratula || undefined,
      relatedCourt: relatedCourt || undefined,
    });
  });

  return relatedCases;
}
