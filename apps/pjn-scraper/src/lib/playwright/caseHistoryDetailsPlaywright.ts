import { Page } from "playwright";
import { logger } from "../../middleware/logging";
import type {
  NormalizedMovement,
  NormalizedDigitalDocument,
  CaseHistoryStats,
  CaseHistoryDetailsResponse,
} from "../../types/api";
import {
  parseActuacionesHtmlImproved,
  parseIntervinientesHtml,
  parseVinculadosHtml,
  type NormalizedParticipant,
  type NormalizedAppeal,
  type NormalizedRelatedCase,
} from "../pjnCaseHistoryParsers";
import { DebugStorage, createDebugSession } from "../debugStorage";
import { GcsStorage } from "../storage";
import { getPjnPageForUser, closePjnPage } from "./pjnPlaywrightSession";
import { performCaseHistorySearchPlaywright } from "./caseHistorySearchPlaywright";
import {
  navigateToExpedientePlaywright,
  loadIntervinientesHtml,
  loadVinculadosHtml,
} from "./caseHistoryExpedientePlaywright";
import type { SessionState } from "../sessionStore";
import fetch from "node-fetch";

/**
 * Options for scraping the full historical docket for a PJN expediente
 * using Playwright navigation.
 */
export interface CaseHistoryDetailsOptions {
  fre: string;
  userId: string;
  includeMovements?: boolean;
  includeDocuments?: boolean;
  maxMovements?: number;
  maxDocuments?: number;
  requestId?: string;
  debugStorage?: boolean | DebugStorage;
}

/**
 * Result of scraping the PJN expediente page.
 */
export interface CaseHistoryDetailsResult {
  fre: string;
  movimientos: NormalizedMovement[];
  docDigitales: NormalizedDigitalDocument[];
  intervinientes: NormalizedParticipant[];
  recursos: NormalizedAppeal[];
  vinculados: NormalizedRelatedCase[];
  stats: CaseHistoryStats;
  cid?: string;
}

/**
 * Parse FRE to extract jurisdiction, caseNumber, and year.
 */
function parseFre(fre: string): {
  jurisdiction: string;
  caseNumber: string;
  year: number;
} | null {
  const match = fre.match(/^([A-Z]+)-(\d+)\/(\d{4})/);
  if (match) {
    return {
      jurisdiction: match[1],
      caseNumber: match[2],
      year: parseInt(match[3], 10),
    };
  }
  return null;
}

/**
 * Download a PDF from a document reference and upload to GCS.
 * Uses cookies from the Playwright context.
 */
async function downloadAndUploadPdf(
  docRef: string | null,
  docId: string,
  userId: string,
  page: Page,
  storage: GcsStorage,
): Promise<string | null> {
  if (!docRef) {
    return null;
  }

  try {
    // Get cookies from the page context
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    // Construct download URL
    let downloadUrl = docRef;
    if (docRef.startsWith("javascript:") || docRef.includes("onclick")) {
      const urlMatch = docRef.match(/['"]([^'"]+\.pdf[^'"]*)['"]/i);
      if (urlMatch) {
        downloadUrl = urlMatch[1];
      } else {
        logger.warn("Could not extract URL from JavaScript reference", {
          docRef,
        });
        return null;
      }
    }

    // Resolve relative URLs
    if (downloadUrl.startsWith("/")) {
      downloadUrl = `https://scw.pjn.gov.ar${downloadUrl}`;
    } else if (!downloadUrl.startsWith("http")) {
      downloadUrl = `https://scw.pjn.gov.ar/scw/${downloadUrl}`;
    }

    const headers: Record<string, string> = {
      accept: "application/pdf,*/*",
      cookie: cookieHeader,
      referer: page.url(),
    };

    const response = await fetch(downloadUrl, {
      method: "GET",
      headers,
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location) {
        const redirectUrl = location.startsWith("http")
          ? location
          : `https://scw.pjn.gov.ar${location.startsWith("/") ? location : `/${location}`}`;

        const redirectResponse = await fetch(redirectUrl, {
          method: "GET",
          headers,
          redirect: "manual",
        });

        if (redirectResponse.ok) {
          const pdfBuffer = Buffer.from(await redirectResponse.arrayBuffer());
          return await storage.uploadPdf(userId, docId, pdfBuffer);
        }
      }
    } else if (response.ok) {
      const pdfBuffer = Buffer.from(await response.arrayBuffer());
      return await storage.uploadPdf(userId, docId, pdfBuffer);
    }

    logger.warn("Failed to download PDF", {
      docId,
      url: downloadUrl,
      status: response.status,
    });
    return null;
  } catch (error) {
    logger.error("Error downloading PDF", {
      docId,
      docRef,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Scrape all pages of the Actuaciones table by interacting with the pagination controls.
 * This function:
 * - Parses the current page's Actuaciones table.
 * - Finds all pagination links for additional pages.
 * - Clicks through each page, waiting for content to load.
 * - Aggregates all movements across all pages.
 * - Respects maxMovements limit if provided.
 */
async function scrapeAllActuacionesPages(
  page: Page,
  fre: string,
  maxMovements: number | undefined,
  debugStorage: DebugStorage | undefined,
  safeFre: string,
): Promise<NormalizedMovement[]> {
  const allMovements: NormalizedMovement[] = [];
  let currentPage = 1;

  while (true) {
    const html = await page.content();

    debugStorage?.saveHtml(
      `${safeFre}_02_actuaciones_page${currentPage}`,
      html,
      { fre, page: currentPage },
    );

    const pageMovements = parseActuacionesHtmlImproved(html, fre);
    allMovements.push(...pageMovements);

    const paginationContainer = page.locator(
      "#expediente\\:j_idt217\\:divPagesAct",
    );
    if ((await paginationContainer.count()) === 0) {
      break;
    }

    const nextPageArrow = paginationContainer.locator(
      "a#expediente\\:j_idt217\\:j_idt234",
    );

    const isNextDisabled = await nextPageArrow
      .evaluate((el) => {
        const parent = el.closest("li");
        return parent?.classList.contains("disabled") ?? false;
      })
      .catch(() => true);

    if (isNextDisabled) {
      break;
    }

    // Selector for the active page number inside the paginator
    const activePageNumberSelector =
      '#expediente\\:j_idt217\\:divPagesAct li.active span span';
    const activePageLocator = page.locator(activePageNumberSelector);
    const previousActivePageText = await activePageLocator
      .textContent()
      .then((text) => text?.trim() ?? null)
      .catch(() => null);

    try {
      const waitForPageChange =
        previousActivePageText !== null
          ? page.waitForFunction(
              (state: { selector: string; prev: string }) => {
                const el = document.querySelector(state.selector);
                if (!el) return false;
                const text = el.textContent?.trim() ?? "";
                return text.length > 0 && text !== state.prev;
              },
              {
                selector: activePageNumberSelector,
                prev: previousActivePageText,
              },
            )
          : page.waitForLoadState("networkidle", { timeout: 30000 });

      await Promise.all([nextPageArrow.click(), waitForPageChange]);
      currentPage++;
    } catch {
      break;
    }
  }

  // De-duplicate movements by movementId to guard against accidental
  // re-scrapes of the same page or overlapping pagination results.
  const uniqueById = new Map<string, NormalizedMovement>();
  for (const movement of allMovements) {
    if (!uniqueById.has(movement.movementId)) {
      uniqueById.set(movement.movementId, movement);
    }
  }

  const uniqueMovements = Array.from(uniqueById.values());
  if (maxMovements && uniqueMovements.length > maxMovements) {
    return uniqueMovements.slice(0, maxMovements);
  }

  return uniqueMovements;
}

/**
 * Scrape the full historical docket for a PJN expediente using Playwright
 * to navigate the UI and Cheerio to parse the HTML.
 */
export async function scrapeCaseHistoryDetailsPlaywright(
  session: SessionState,
  options: CaseHistoryDetailsOptions,
  storage: GcsStorage = new GcsStorage(),
): Promise<CaseHistoryDetailsResult> {
  const startTime = Date.now();
  const {
    fre,
    userId,
    includeMovements = true,
    includeDocuments = true,
    maxMovements,
    maxDocuments,
    requestId,
  } = options;

  // Default to 20 movimientos per run when not explicitly provided,
  // to keep scraper runs bounded during testing.
  const effectiveMaxMovements = maxMovements ?? 20;

  // Initialize debug storage
  let debugStorage: DebugStorage | undefined;
  if (options.debugStorage === true || options.debugStorage === undefined) {
    debugStorage = createDebugSession();
  } else if (options.debugStorage instanceof DebugStorage) {
    debugStorage = options.debugStorage;
  }

  const safeFre = fre.replace(/[/\\:]/g, "_");

  logger.info("Starting Playwright case history details scrape", {
    fre,
    userId,
    requestId,
    includeMovements,
    includeDocuments,
    debugSessionId: debugStorage?.getSessionId(),
    debugSessionDir: debugStorage?.getSessionDir(),
  });

  // Parse FRE to extract jurisdiction, caseNumber, year
  const parsed = parseFre(fre);
  if (!parsed) {
    const error = `Invalid FRE format: ${fre}. Expected format: "FRE-3852/2020"`;
    debugStorage?.saveJson(`${safeFre}_error`, { error, stage: "parse_fre" });
    throw new Error(error);
  }

  const { jurisdiction, caseNumber, year } = parsed;

  // Get Playwright page
  const { page, handle } = await getPjnPageForUser(session);

  try {
    // Step 1: Perform search to get candidates
    logger.debug("Step 1: Performing Playwright search", {
      fre,
      jurisdiction,
      caseNumber,
      year,
    });
    const searchResult = await performCaseHistorySearchPlaywright(page, {
      jurisdiction,
      caseNumber,
      year,
      requestId,
      debugStorage,
    });

    if (!searchResult.selectedCandidate) {
      const error = `No candidate found for FRE ${fre}. Cannot navigate to expediente page.`;
      debugStorage?.saveJson(`${safeFre}_error`, {
        error,
        stage: "search",
        candidates: searchResult.candidates,
      });
      throw new Error(error);
    }

    logger.debug("Search completed, selected candidate", {
      fre,
      rowIndex: searchResult.selectedCandidate.rowIndex,
      selectedFre: searchResult.selectedCandidate.fre,
    });

    // Step 2: Navigate to expediente.seam
    logger.debug("Step 2: Navigating to expediente.seam", {
      rowIndex: searchResult.selectedCandidate.rowIndex,
    });
    const { expedienteHtml, cid } = await navigateToExpedientePlaywright(
      page,
      searchResult.selectedCandidate,
      debugStorage,
    );

    // Step 3: Parse Actuaciones (all pages)
    let movimientos: NormalizedMovement[] = [];
    if (includeMovements) {
      logger.debug("Step 3: Parsing Actuaciones (all pages)", { fre });
      movimientos = await scrapeAllActuacionesPages(
        page,
        fre,
        effectiveMaxMovements,
        debugStorage,
        safeFre,
      );

      debugStorage?.saveJson(`${safeFre}_02_actuaciones`, movimientos, {
        fre,
        totalCount: movimientos.length,
      });
    }

    // Step 4: Doc. digitales scraping disabled (returning empty array)
    const docDigitales: NormalizedDigitalDocument[] = [];

    // Step 5: Load and parse Intervinientes tab
    logger.debug("Step 5: Loading Intervinientes tab", { fre });
    const intervinientesHtml = await loadIntervinientesHtml(
      page,
      debugStorage,
      fre,
    );
    const intervinientes = parseIntervinientesHtml(intervinientesHtml);
    debugStorage?.saveJson(`${safeFre}_04_intervinientes`, intervinientes, {
      fre,
      totalCount: intervinientes.length,
    });

    // Step 6: Recursos scraping disabled (returning empty array)
    const recursos: NormalizedAppeal[] = [];

    // Step 7: Load and parse Vinculados tab
    logger.debug("Step 7: Loading Vinculados tab", { fre });
    const vinculadosHtml = await loadVinculadosHtml(page, debugStorage, fre);
    const vinculados = parseVinculadosHtml(vinculadosHtml);
    debugStorage?.saveJson(`${safeFre}_06_vinculados`, vinculados, {
      fre,
      totalCount: vinculados.length,
    });

    // Step 8: Download PDFs and upload to GCS
    let downloadErrors = 0;

    // Download PDFs for documents with docRef
    for (const doc of docDigitales) {
      if (doc.docRef && !doc.gcsPath) {
        try {
          const gcsPath = await downloadAndUploadPdf(
            doc.docRef,
            doc.docId,
            userId,
            page,
            storage,
          );
          if (gcsPath) {
            doc.gcsPath = gcsPath;
          } else {
            downloadErrors++;
          }
        } catch (error) {
          logger.error("Error processing document PDF", {
            docId: doc.docId,
            error: error instanceof Error ? error.message : String(error),
          });
          downloadErrors++;
        }
      }
    }

    // Download PDFs for movements with docRef
    for (const movement of movimientos) {
      if (movement.docRef && movement.hasDocument && !movement.gcsPath) {
        try {
          const gcsPath = await downloadAndUploadPdf(
            movement.docRef,
            movement.movementId,
            userId,
            page,
            storage,
          );
          if (gcsPath) {
            movement.gcsPath = gcsPath;
          } else {
            downloadErrors++;
          }
        } catch (error) {
          logger.error("Error processing movement PDF", {
            movementId: movement.movementId,
            error: error instanceof Error ? error.message : String(error),
          });
          downloadErrors++;
        }
      }
    }

    const durationMs = Date.now() - startTime;

    const stats: CaseHistoryStats = {
      movimientosCount: movimientos.length,
      docsCount: docDigitales.length,
      downloadErrors,
      durationMs,
    };

    const result: CaseHistoryDetailsResult = {
      fre,
      movimientos,
      docDigitales,
      intervinientes,
      recursos,
      vinculados,
      stats,
      cid,
    };

    // Save final result to debug storage
    debugStorage?.saveJson(`${safeFre}_final_result`, result, {
      fre,
      userId,
      requestId,
      durationMs,
    });

    logger.info("Playwright case history details scrape completed", {
      fre,
      userId,
      requestId,
      stats,
      debugSessionId: debugStorage?.getSessionId(),
      debugSessionDir: debugStorage?.getSessionDir(),
    });

    return result;
  } finally {
    // Always close the page and browser handle
    await closePjnPage(page, handle);
  }
}

/**
 * Convert a CaseHistoryDetailsResult into the public CaseHistoryDetailsResponse shape.
 */
export function toCaseHistoryDetailsResponsePlaywright(
  result: CaseHistoryDetailsResult,
): CaseHistoryDetailsResponse {
  return {
    status: "OK",
    fre: result.fre,
    cid: result.cid ?? "",
    movimientos: result.movimientos,
    docDigitales: result.docDigitales,
    intervinientes: result.intervinientes,
    recursos: result.recursos,
    vinculados: result.vinculados,
    stats: result.stats,
  };
}
