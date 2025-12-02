import { chromium, Browser, BrowserContext, Cookie } from "playwright";
import { logger } from "../middleware/logging";
import type { SessionState } from "./sessionStore";
import { config } from "../config";

/**
 * Handle for a scraping browser session.
 * Higher-level scraping jobs should use this to manage browser lifecycle.
 */
export interface ScrapingBrowserHandle {
  browser: Browser;
  context: BrowserContext;
}

/**
 * Parse a cookie string "name=value" into a Playwright Cookie object.
 * Sets sensible defaults for PJN portal cookies.
 */
function parseCookieString(cookieStr: string): Cookie {
  const [name, ...valueParts] = cookieStr.split("=");
  const value = valueParts.join("="); // Handle values that contain "="

  return {
    name: name.trim(),
    value: value.trim(),
    domain: new URL(config.pjnPortalBaseUrl).hostname,
    path: "/",
    expires: -1, // Session cookie
    httpOnly: false,
    secure: true,
    sameSite: "Lax",
  };
}

/**
 * Create a fresh browser instance with session cookies already set.
 *
 * Use this for browser-based scraping jobs. The returned handle should be
 * closed in a finally block using `closeScrapingBrowser()`.
 *
 * @example
 * ```typescript
 * const handle = await createScrapingBrowserFromSession(sessionState);
 * try {
 *   const page = await handle.context.newPage();
 *   await page.goto("https://portalpjn.pjn.gov.ar/some-page");
 *   // ... scrape data ...
 * } finally {
 *   await closeScrapingBrowser(handle);
 * }
 * ```
 */
export async function createScrapingBrowserFromSession(
  sessionState: SessionState
): Promise<ScrapingBrowserHandle> {
  logger.debug("Creating scraping browser from session", {
    hasCookies: Boolean(sessionState.cookies?.length),
    cookieCount: sessionState.cookies?.length ?? 0,
  });

  const browser = await chromium.launch({ headless: true });

  try {
    // Create context with any headers from the session
    const context = await browser.newContext({
      userAgent: sessionState.headers?.["User-Agent"],
    });

    // Add cookies from session state
    if (sessionState.cookies && sessionState.cookies.length > 0) {
      const playwrightCookies = sessionState.cookies.map(parseCookieString);
      await context.addCookies(playwrightCookies);
      logger.debug("Session cookies added to browser context", {
        count: playwrightCookies.length,
      });
    }

    return { browser, context };
  } catch (error) {
    // If context creation fails, make sure to close the browser
    await browser.close().catch(() => {});
    throw error;
  }
}

/**
 * Close a scraping browser handle, cleaning up all resources.
 *
 * Safe to call multiple times; will log but not throw on errors.
 */
export async function closeScrapingBrowser(
  handle: ScrapingBrowserHandle
): Promise<void> {
  try {
    await handle.context.close();
  } catch (err) {
    logger.warn("Error closing scraping context", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    await handle.browser.close();
    logger.debug("Scraping browser closed");
  } catch (err) {
    logger.warn("Error closing scraping browser", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

