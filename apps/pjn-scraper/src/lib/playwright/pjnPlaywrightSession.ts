import { chromium, Browser, BrowserContext, Page } from "playwright";
import { logger } from "../../middleware/logging";
import type { SessionState } from "../sessionStore";
import { createScrapingBrowserFromSession, closeScrapingBrowser, type ScrapingBrowserHandle } from "../scrapingBrowser";
import { config } from "../../config";

const CASE_HISTORY_SEARCH_URL = "https://scw.pjn.gov.ar/scw/consultaListaRelacionados.seam";

/**
 * Get an authenticated Playwright Page for a given user session.
 * The page will be positioned at the PJN SCW home or search page.
 * 
 * Callers are responsible for closing the browser handle via `closePjnPage`.
 */
export async function getPjnPageForUser(
  session: SessionState
): Promise<{ page: Page; handle: ScrapingBrowserHandle }> {
  logger.debug("Creating PJN Playwright page from session", {
    hasCookies: Boolean(session.cookies?.length),
    cookieCount: session.cookies?.length ?? 0,
  });

  const handle = await createScrapingBrowserFromSession(session);
  const page = await handle.context.newPage();

  // Navigate to the case history search page to establish session
  await page.goto(CASE_HISTORY_SEARCH_URL, {
    waitUntil: "networkidle",
    timeout: 30000,
  });

  logger.debug("PJN page ready", {
    url: page.url(),
  });

  return { page, handle };
}

/**
 * Close a PJN page and its associated browser handle.
 * Safe to call multiple times.
 */
export async function closePjnPage(
  page: Page,
  handle: ScrapingBrowserHandle
): Promise<void> {
  try {
    await page.close();
  } catch (err) {
    logger.warn("Error closing PJN page", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  await closeScrapingBrowser(handle);
}
