import { Page } from "playwright";
import { logger } from "../../middleware/logging";
import type { NormalizedCaseCandidate } from "../../types/api";
import type { NormalizedRelatedCase } from "../../types/api";
import type { DebugStorage } from "../debugStorage";
import { parseVinculadosHtml } from "../pjnCaseHistoryParsers";

const EXPEDIENTE_URL = "https://scw.pjn.gov.ar/scw/expediente.seam";

/**
 * Navigate from search results to expediente.seam by clicking the row action.
 * 
 * This function:
 * - Locates the row corresponding to the candidate in the search results table
 * - Clicks the "visualizar expediente" action button/link (the eye icon)
 * - Waits for navigation to expediente.seam
 * - Captures the HTML and extracts the cid from the URL
 */
export async function navigateToExpedientePlaywright(
  page: Page,
  candidate: NormalizedCaseCandidate,
  debugStorage?: DebugStorage
): Promise<{ expedienteHtml: string; cid: string }> {
  const { rowIndex, fre } = candidate;

  logger.debug("Navigating to expediente.seam via Playwright", {
    rowIndex,
    fre,
  });

  // The results table has a specific JSF ID pattern
  // Each row has a "visualizar expediente" link with the eye icon
  // The link ID follows the pattern: tablaConsultaLista:tablaConsultaForm:j_idt179:dataTable:{rowIndex}:j_idt230
  
  // First, try the specific JSF link pattern for the given rowIndex
  const specificLinkSelector = `a[onclick*="dataTable:${rowIndex}:j_idt230"]`;
  
  let rowFound = false;
  
  try {
    const specificLink = page.locator(specificLinkSelector).first();
    if (await specificLink.count() > 0) {
      logger.debug("Found specific JSF link for row", { rowIndex, fre });
      
      // Click and wait for navigation
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle", timeout: 30000 }),
        specificLink.click(),
      ]);
      rowFound = true;
    }
  } catch (err) {
    logger.debug("Specific JSF link not found, trying fallback", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (!rowFound) {
    // Fallback: locate the row in the results table and click the eye icon
    const tableSelector = 'table[id*="dataTable"]';
    
    try {
      const table = page.locator(tableSelector).first();
      const rows = table.locator("tbody tr");
      const rowCount = await rows.count();

      if (rowIndex >= 0 && rowIndex < rowCount) {
        const targetRow = rows.nth(rowIndex);

        // Find the action link/button in this row (the eye icon link)
        const actionSelectors = [
          'a.btn.btn-default.btn-sm',  // The eye icon button
          'a:has(i.fa-eye)',           // Link containing eye icon
          'a[onclick*="j_idt230"]',    // JSF action link
          'div.btn-group a.btn',       // Button group action
        ];

        for (const actionSelector of actionSelectors) {
          try {
            const action = targetRow.locator(actionSelector).first();
            if (await action.count() > 0) {
              logger.debug("Found action link in row", { 
                rowIndex, 
                fre,
                selector: actionSelector,
              });
              
              // Click and wait for navigation
              await Promise.all([
                page.waitForNavigation({ waitUntil: "networkidle", timeout: 30000 }),
                action.click(),
              ]);
              rowFound = true;
              break;
            }
          } catch {
            // Try next selector
          }
        }
      }
    } catch (err) {
      logger.warn("Table-based navigation failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (!rowFound) {
    throw new Error(`Could not find or click action for row ${rowIndex}`);
  }

  // Verify we're on the expediente page
  const currentUrl = page.url();
  if (!currentUrl.includes("expediente.seam")) {
    throw new Error(`Navigation did not reach expediente.seam. Current URL: ${currentUrl}`);
  }

  // Extract cid from URL
  const urlObj = new URL(currentUrl);
  const cid = urlObj.searchParams.get("cid") || "";

  // Capture the HTML
  const expedienteHtml = await page.content();

  logger.info("Successfully navigated to expediente.seam", {
    cid,
    url: currentUrl,
    htmlLength: expedienteHtml.length,
  });

  // Save expediente HTML to debug storage
  if (debugStorage) {
    const safeFre = fre.replace(/[/\\:]/g, "_");
    debugStorage.saveHtml(`${safeFre}_02_expediente`, expedienteHtml, {
      fre,
      cid,
      rowIndex,
    });
  }

  return {
    expedienteHtml,
    cid,
  };
}

/**
 * Load a tab by clicking it and waiting for content to render.
 * Returns the HTML after the tab is loaded.
 *
 * If readySelector is provided, waits for that selector to become visible
 * after clicking the tab; otherwise falls back to waiting for "networkidle".
 */
async function loadTabPlaywright(
  page: Page,
  tabName: string,
  tabSelectors: string[],
  debugStorage?: DebugStorage,
  debugFilename?: string,
  readySelector?: string,
): Promise<string> {
  logger.debug(`Loading ${tabName} tab`, {});

  // Find and click the tab
  let tabClicked = false;
  for (const selector of tabSelectors) {
    try {
      const tab = page.locator(selector).first();
      if (await tab.count() > 0) {
        await tab.click();
        tabClicked = true;
        break;
      }
    } catch {
      // Try next selector
    }
  }

  if (!tabClicked) {
    logger.warn(`Could not find ${tabName} tab, returning current page HTML`, {});
  } else if (readySelector) {
    // Wait for the specific tab content to be visible
    await page
      .waitForSelector(readySelector, { state: "visible", timeout: 15000 })
      .catch(() => {
        logger.warn(
          `Timed out waiting for ${tabName} tab content selector: ${readySelector}`,
          {},
        );
      });
  } else {
    // Fallback: wait for network activity to settle
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {
      // Ignore timeout, continue anyway
    });
  }

  // Capture the HTML
  const tabHtml = await page.content();

  // Save to debug storage if provided
  if (debugStorage && debugFilename) {
    debugStorage.saveHtml(debugFilename, tabHtml, {
      tabName,
    });
  }

  return tabHtml;
}

/**
 * Load the "Doc. digitales" tab.
 */
export async function loadDocDigitalesHtml(
  page: Page,
  debugStorage?: DebugStorage,
  fre?: string
): Promise<string> {
  const tabSelectors = [
    // RichFaces tab header cells for "Doc. digitales" / "Documentos digitales"
    'td.rf-tab-hdr-inact:has-text("Doc. digitales")',
    'td.rf-tab-hdr:has-text("Doc. digitales")',
    'td.rf-tab-hdr-inact:has-text("Documentos digitales")',
    'td.rf-tab-hdr:has-text("Documentos digitales")',
    // Fallbacks by id if needed (escape colons for CSS)
    '#expediente\\:j_idt???\\:header\\:inactive',
    '#expediente\\:j_idt???\\:header\\:active',
  ];

  const safeFre = fre ? fre.replace(/[/\\:]/g, "_") : "unknown";
  return loadTabPlaywright(
    page,
    "Doc. digitales",
    tabSelectors,
    debugStorage,
    `${safeFre}_03_doc_digitales`,
  );
}

/**
 * Load the "Intervinientes" tab.
 * If the page has navigated away from expediente.seam, re-navigate using the cid.
 */
export async function loadIntervinientesHtml(
  page: Page,
  debugStorage?: DebugStorage,
  fre?: string,
  cid?: string
): Promise<string> {
  const safeFre = fre ? fre.replace(/[/\\:]/g, "_") : "unknown";

  logger.debug("Loading Intervinientes tab", { fre, currentUrl: page.url() });

  // Check if we're still on expediente.seam, if not re-navigate
  const currentUrl = page.url();
  if (!currentUrl.includes("expediente.seam")) {
    if (!cid) {
      logger.warn("Page navigated away from expediente.seam and no cid available", {
        fre,
        currentUrl,
      });
      // Return current page HTML for debugging
      const html = await page.content();
      if (debugStorage) {
        debugStorage.saveHtml(`${safeFre}_04_intervinientes`, html, {
          fre,
          tabName: "Intervinientes",
          error: "Not on expediente.seam, no cid",
        });
      }
      return html;
    }

    logger.info("Re-navigating to expediente.seam", { fre, cid });
    await page.goto(`${EXPEDIENTE_URL}?cid=${cid}`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Verify we're now on expediente.seam
    const newUrl = page.url();
    if (!newUrl.includes("expediente.seam")) {
      logger.warn("Failed to re-navigate to expediente.seam", {
        fre,
        cid,
        newUrl,
      });
    }
  }

  // Locate the Intervinientes tab header within the expediente tab panel.
  const tabHeader = page
    .locator('#expediente\\:expedienteTab td.rf-tab-hdr')
    .filter({ hasText: "Intervinientes" })
    .first();

  const tabCount = await tabHeader.count();
  if (tabCount === 0) {
    logger.warn("Could not find Intervinientes tab header", { fre });
    const html = await page.content();
    if (debugStorage) {
      debugStorage.saveHtml(`${safeFre}_04_intervinientes`, html, {
        fre,
        tabName: "Intervinientes",
        error: "Tab header not found",
      });
    }
    return html;
  }

  await tabHeader.click();

  // Wait until the hidden value reflects that the Intervinientes tab is active.
  await page
    .waitForFunction(() => {
      const input = document.getElementById(
        "expediente:expedienteTab-value",
      ) as HTMLInputElement | null;
      return input?.value === "intervinientes";
    }, { timeout: 10000 })
    .catch(() => {
      logger.warn("Timeout waiting for Intervinientes tab to become active", { fre });
    });

  // Small delay to ensure content is rendered
  await page.waitForTimeout(500);

  const html = await page.content();

  if (debugStorage) {
    debugStorage.saveHtml(`${safeFre}_04_intervinientes`, html, {
      fre,
      tabName: "Intervinientes",
    });
  }

  return html;
}

/**
 * Load the "Recursos" tab.
 */
export async function loadRecursosHtml(
  page: Page,
  debugStorage?: DebugStorage,
  fre?: string
): Promise<string> {
  const tabSelectors = [
    // RichFaces tab header cells for "Recursos"
    'td.rf-tab-hdr-inact:has-text("Recursos")',
    'td.rf-tab-hdr:has-text("Recursos")',
    // Fallbacks by exact id based on observed markup
    '#expediente\\:j_idt519\\:header\\:inactive',
    '#expediente\\:j_idt519\\:header\\:active',
  ];

  const safeFre = fre ? fre.replace(/[/\\:]/g, "_") : "unknown";
  return loadTabPlaywright(
    page,
    "Recursos",
    tabSelectors,
    debugStorage,
    `${safeFre}_05_recursos`,
  );
}

/**
 * Load the "Vinculados" tab.
 * If the page has navigated away from expediente.seam, re-navigate using the cid.
 */
export async function loadVinculadosHtml(
  page: Page,
  debugStorage?: DebugStorage,
  fre?: string,
  cid?: string
): Promise<string> {
  const safeFre = fre ? fre.replace(/[/\\:]/g, "_") : "unknown";

  // Check if we're still on expediente.seam, if not re-navigate
  const currentUrl = page.url();
  if (!currentUrl.includes("expediente.seam") && cid) {
    logger.info("Re-navigating to expediente.seam for Vinculados tab", { fre, cid });
    await page.goto(`${EXPEDIENTE_URL}?cid=${cid}`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
  }

  const tabSelectors = [
    // RichFaces tab header cells for "Vinculados"
    'td.rf-tab-hdr:has-text("Vinculados")',
    'td.rf-tab-hdr-inact:has-text("Vinculados")',
    // Fallbacks by exact id based on observed markup
    '#expediente\\:j_idt348\\:header\\:inactive',
    '#expediente\\:j_idt348\\:header\\:active',
  ];

  return loadTabPlaywright(
    page,
    "Vinculados",
    tabSelectors,
    debugStorage,
    `${safeFre}_06_vinculados`,
    // Wait specifically for the Vinculados content table to be visible
    '#expediente\\:vinculadosTab table#expediente\\:connectedTable',
  );
}

function getSafeFre(fre?: string): string {
  return fre ? fre.replace(/[/\\:]/g, "_") : "unknown";
}

/**
 * Find the Vinculados pagination container within the Vinculados tab.
 * The paginator is a div containing `ul.pagination` with numbered page links.
 */
async function getVinculadosPaginatorUl(page: Page) {
  // The pagination ul is inside #expediente:vinculadosTab
  const root = page.locator("#expediente\\:vinculadosTab").first();

  // Find the ul.pagination inside the vinculados tab
  const paginator = root.locator("ul.pagination").first();
  if ((await paginator.count()) > 0) {
    return paginator;
  }

  // Fallback: try to find any ul.pagination in the page (in case structure varies)
  const globalPaginator = page.locator("#expediente\\:j_idt348 ul.pagination").first();
  if ((await globalPaginator.count()) > 0) {
    return globalPaginator;
  }

  return null;
}

/**
 * Get the current active page number from the Vinculados pagination.
 * Active page is marked with `li.active`.
 */
async function getVinculadosActivePageNumber(paginator: import("playwright").Locator): Promise<number | null> {
  const activeLi = paginator.locator("li.active").first();
  if ((await activeLi.count()) === 0) {
    return null;
  }

  // The page number is inside a span within the li
  const text = await activeLi.textContent().catch(() => null);
  const trimmed = text?.trim() ?? "";
  const pageNum = parseInt(trimmed, 10);
  
  return isNaN(pageNum) ? null : pageNum;
}

/**
 * Get all available page numbers from the Vinculados pagination.
 */
async function getVinculadosAllPageNumbers(paginator: import("playwright").Locator): Promise<number[]> {
  const pageNumbers: number[] = [];
  const allLis = paginator.locator("li");
  const count = await allLis.count();

  for (let i = 0; i < count; i++) {
    const li = allLis.nth(i);
    const text = await li.textContent().catch(() => "");
    const trimmed = text?.trim() ?? "";
    const num = parseInt(trimmed, 10);
    if (!isNaN(num)) {
      pageNumbers.push(num);
    }
  }

  return pageNumbers;
}

/**
 * Click on a specific page number in the Vinculados pagination.
 * Returns the locator for the link if found, null otherwise.
 */
async function getVinculadosPageLink(
  paginator: import("playwright").Locator,
  pageNumber: number,
) {
  // Find the li that contains this page number and is NOT active (i.e., has an <a> link)
  const allLis = paginator.locator("li:not(.active)");
  const count = await allLis.count();

  for (let i = 0; i < count; i++) {
    const li = allLis.nth(i);
    const text = await li.textContent().catch(() => "");
    const trimmed = text?.trim() ?? "";
    const num = parseInt(trimmed, 10);
    
    if (num === pageNumber) {
      // Return the <a> link inside this li
      const link = li.locator("a").first();
      if ((await link.count()) > 0) {
        return link;
      }
    }
  }

  return null;
}

/**
 * Scrape all pages of the Vinculados table by interacting with the pagination controls.
 *
 * This function:
 * - Ensures the Vinculados tab is active
 * - Parses the current page's Vinculados table
 * - Clicks through pagination links sequentially (page 1 → 2 → 3 → ...)
 * - Aggregates all related cases across pages
 * - De-duplicates by relationId to guard against overlapping pagination
 * 
 * Note: The Vinculados pagination does NOT have "Next/Previous" buttons like Actuaciones.
 * Instead, it only shows numbered page links (1, 2, 3...). We must click on specific
 * page numbers to navigate.
 */
export async function scrapeAllVinculadosPages(
  page: Page,
  fre: string,
  debugStorage?: DebugStorage,
  cid?: string,
): Promise<NormalizedRelatedCase[]> {
  const safeFre = getSafeFre(fre);
  const allRelatedCases: NormalizedRelatedCase[] = [];

  // Ensure the tab is active / content loaded.
  await loadVinculadosHtml(page, debugStorage, fre, cid);

  const maxPages = 50; // Safety limit
  let currentPage = 1;

  while (currentPage <= maxPages) {
    // Capture and parse current page
    const html = await page.content();

    debugStorage?.saveHtml(`${safeFre}_06_vinculados_page${currentPage}`, html, {
      fre,
      page: currentPage,
    });

    const pageRelated = parseVinculadosHtml(html);
    allRelatedCases.push(...pageRelated);

    logger.debug("Parsed Vinculados page", {
      fre,
      page: currentPage,
      foundOnPage: pageRelated.length,
      totalSoFar: allRelatedCases.length,
    });

    // Find the pagination container
    const paginator = await getVinculadosPaginatorUl(page);
    if (!paginator) {
      logger.debug("No pagination found for Vinculados, single page only", { fre });
      break;
    }

    // Get all available page numbers
    const allPageNumbers = await getVinculadosAllPageNumbers(paginator);
    const maxAvailablePage = Math.max(...allPageNumbers, 0);

    logger.debug("Vinculados pagination info", {
      fre,
      currentPage,
      availablePages: allPageNumbers,
      maxAvailablePage,
    });

    // Check if there's a next page
    const nextPageNum = currentPage + 1;
    if (nextPageNum > maxAvailablePage || !allPageNumbers.includes(nextPageNum)) {
      logger.debug("No more Vinculados pages available", { fre, currentPage, maxAvailablePage });
      break;
    }

    // Find and click the next page link
    const nextPageLink = await getVinculadosPageLink(paginator, nextPageNum);
    if (!nextPageLink) {
      logger.warn("Could not find link for next Vinculados page", { fre, nextPageNum });
      break;
    }

    try {
      // Wait for the active page to change after clicking
      const waitForPageChange = page.waitForFunction(
        (state: { expectedPage: number }) => {
          const activeLi = document.querySelector(
            "#expediente\\:vinculadosTab ul.pagination li.active, " +
            "#expediente\\:j_idt348 ul.pagination li.active"
          );
          if (!activeLi) return false;
          const text = activeLi.textContent?.trim() ?? "";
          const num = parseInt(text, 10);
          return num === state.expectedPage;
        },
        { expectedPage: nextPageNum },
        { timeout: 15000 },
      );

      await Promise.all([nextPageLink.click(), waitForPageChange]);

      // Small delay to ensure content is fully rendered
      await page.waitForTimeout(500);
      currentPage = nextPageNum;
    } catch (err) {
      logger.warn("Failed to navigate to next Vinculados page", {
        fre,
        currentPage,
        nextPageNum,
        error: err instanceof Error ? err.message : String(err),
      });
      break;
    }
  }

  // De-duplicate by relationId
  const uniqueById = new Map<string, NormalizedRelatedCase>();
  for (const item of allRelatedCases) {
    if (!uniqueById.has(item.relationId)) {
      uniqueById.set(item.relationId, item);
    }
  }

  logger.info("Completed Vinculados scraping", {
    fre,
    pagesScraped: currentPage,
    totalUnique: uniqueById.size,
  });

  return Array.from(uniqueById.values());
}
