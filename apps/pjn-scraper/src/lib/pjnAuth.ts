import { chromium, Browser, BrowserContext, Page } from "playwright";
import { config } from "../config";
import { logger } from "../middleware/logging";
import type { SessionState } from "./sessionStore";

interface LoginOptions {
  username: string;
  password: string;
}

/**
 * Perform a PJN SSO login using a fresh Playwright browser instance and return
 * a SessionState with cookies and basic metadata.
 *
 * This function is intentionally focused on the auth flow and is independent
 * from any scraping logic. Each call launches a new browser, performs the login,
 * captures cookies, and tears down the browser — guaranteeing complete isolation
 * between login attempts.
 */
export async function performPjnLogin(
  options: LoginOptions
): Promise<SessionState> {
  const { username, password } = options;

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let lastUrl: string | undefined;

  logger.info("Starting PJN SSO login", { username });

  try {
    // Launch a fresh browser instance for this login attempt
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    page = await context.newPage();

    logger.debug("Browser launched, navigating to SSO URL", {
      url: config.pjnSsoAuthUrl,
    });

    // Navigate to the SSO auth URL
    await page.goto(config.pjnSsoAuthUrl, { waitUntil: "networkidle" });

    // Try a few different selectors for the username and password fields to
    // be resilient to small markup changes.
    const usernameSelectors: Array<string> = [
      'input[name="username"]',
      'input#username',
      'input[type="text"]',
    ];
    const passwordSelectors: Array<string> = [
      'input[name="password"]',
      'input#password',
      'input[type="password"]',
    ];

    const findFirstExisting = async (
      selectors: string[],
      fieldName: string
    ): Promise<string> => {
      for (const selector of selectors) {
        const locator = page!.locator(selector);
        const count = await locator.first().count();
        if (count > 0) {
          logger.debug(`Found ${fieldName} field`, { selector });
          return selector;
        }
      }
      throw new Error(`Unable to locate PJN login form field: ${fieldName}`);
    };

    const usernameSelector = await findFirstExisting(
      usernameSelectors,
      "username"
    );
    const passwordSelector = await findFirstExisting(
      passwordSelectors,
      "password"
    );

    // Fill in credentials
    await page.fill(usernameSelector, username);
    await page.fill(passwordSelector, password);

    logger.debug("Credentials filled, submitting form");

    // Try to find a submit button; fall back to pressing Enter in the password field.
    const buttonSelectors: Array<string> = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Ingresar")',
    ];

    let clicked = false;
    for (const selector of buttonSelectors) {
      const locator = page.locator(selector);
      const count = await locator.first().count();
      if (count > 0) {
        logger.debug("Clicking submit button", { selector });
        await Promise.all([
          page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {
            // Navigation might be handled via XHR; ignore timeout here.
          }),
          locator.first().click(),
        ]);
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      logger.debug("No submit button found, pressing Enter on password field");
      const passwordField = page.locator(passwordSelector).first();
      await passwordField.press("Enter");
      await page.waitForLoadState("networkidle").catch(() => undefined);
    }

    lastUrl = page.url();
    logger.info("PJN SSO login flow completed", { finalUrl: lastUrl });

    // If we are still on the SSO realm URL, treat it as invalid credentials.
    if (lastUrl.startsWith(config.pjnSsoBaseUrl)) {
      const bodyText = await page.textContent("body").catch(() => "");
      logger.warn("PJN SSO appears to have rejected credentials", {
        url: lastUrl,
        hasBodyText: Boolean(bodyText),
      });
      throw new Error("Invalid credentials");
    }

    // Basic sanity check that we reached the PJN portal.
    if (!lastUrl.startsWith(config.pjnPortalBaseUrl)) {
      logger.warn("PJN login ended on unexpected URL", {
        url: lastUrl,
        expectedBase: config.pjnPortalBaseUrl,
      });
    }

    // Capture cookies from the browser context
    const cookies = await context.cookies();
    const cookieHeaderValues = cookies.map(
      (cookie) => `${cookie.name}=${cookie.value}`
    );

    // Get the User-Agent from the page
    const userAgent = await page.evaluate(() => navigator.userAgent);

    const sessionState: SessionState = {
      cookies: cookieHeaderValues,
      headers: {
        "User-Agent": userAgent,
      },
      username,
      authenticatedAt: new Date().toISOString(),
    };

    logger.info("PJN SSO cookies captured", {
      cookieCount: cookieHeaderValues.length,
    });

    return sessionState;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error("PJN login failed", {
      error: errorMessage,
      stack: errorStack,
      lastUrl,
      username,
    });

    // Re-throw to let the caller handle it
    throw error;
  } finally {
    // Always clean up browser resources in reverse order
    if (page) {
      try {
        await page.close();
      } catch (err) {
        logger.warn("Error closing page", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (context) {
      try {
        await context.close();
      } catch (err) {
        logger.warn("Error closing browser context", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (browser) {
      try {
        await browser.close();
        logger.debug("Browser closed");
      } catch (err) {
        logger.warn("Error closing browser", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}
