import { Page } from "playwright";
import { logger } from "../../middleware/logging";

const CASE_HISTORY_SEARCH_URL = "https://scw.pjn.gov.ar/scw/consultaListaRelacionados.seam";

/**
 * Navigate from the current page to the case history search screen.
 * This assumes we're starting from a PJN authenticated page (e.g., home or search page).
 * If already on the search page, this is a no-op.
 */
export async function navigateToCaseSearch(page: Page): Promise<void> {
  const currentUrl = page.url();

  // If we're already on the search page, no navigation needed
  if (currentUrl.includes("consultaListaRelacionados.seam")) {
    logger.debug("Already on case search page", { url: currentUrl });
    return;
  }

  logger.debug("Navigating to case search page", { fromUrl: currentUrl });

  // Navigate directly to the search URL
  await page.goto(CASE_HISTORY_SEARCH_URL, {
    waitUntil: "networkidle",
    timeout: 30000,
  });

  logger.debug("Navigated to case search page", {
    url: page.url(),
  });
}
