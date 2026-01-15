import { Page } from "playwright";
import { logger } from "../../middleware/logging";
import type { NormalizedCaseCandidate } from "../../types/api";
import type { DebugStorage } from "../debugStorage";

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
 */
export async function loadIntervinientesHtml(
  page: Page,
  debugStorage?: DebugStorage,
  fre?: string
): Promise<string> {
  const safeFre = fre ? fre.replace(/[/\\:]/g, "_") : "unknown";

  logger.debug("Clicking Intervinientes tab", { fre });

  // Locate the Intervinientes tab header within the expediente tab panel.
  const tabHeader = page
    .locator('#expediente\\:expedienteTab td.rf-tab-hdr')
    .filter({ hasText: "Intervinientes" })
    .first();

  await tabHeader.click();

  // Wait until the hidden value reflects that the Intervinientes tab is active.
  await page
    .waitForFunction(() => {
      const input = document.getElementById(
        "expediente:expedienteTab-value",
      ) as HTMLInputElement | null;
      return input?.value === "intervinientes";
    })
    .catch(() => {
      // If this fails, we'll still capture HTML for debugging.
      return null;
    });

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
 */
export async function loadVinculadosHtml(
  page: Page,
  debugStorage?: DebugStorage,
  fre?: string
): Promise<string> {
  const tabSelectors = [
    // RichFaces tab header cells for "Vinculados"
    'td.rf-tab-hdr:has-text("Vinculados")',
    'td.rf-tab-hdr-inact:has-text("Vinculados")',
    // Fallbacks by exact id based on observed markup
    '#expediente\\:j_idt348\\:header\\:inactive',
    '#expediente\\:j_idt348\\:header\\:active',
  ];

  const safeFre = fre ? fre.replace(/[/\\:]/g, "_") : "unknown";
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
