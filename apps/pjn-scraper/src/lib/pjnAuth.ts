import { chromium, Browser, BrowserContext, Page, Request } from "playwright";
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
  let tokenPayload:
    | (Record<string, unknown> & {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        refresh_expires_in?: number;
        token_type: string;
      })
    | null = null;

  logger.info("Starting PJN SSO login", { username });

  try {
    // Launch a fresh browser instance for this login attempt
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    page = await context.newPage();

    // Capture token responses from the SSO server
    context.on("requestfinished", async (request: Request) => {
      try {
        const url = request.url();
        if (
          !url.startsWith(config.pjnSsoBaseUrl) ||
          !url.includes("/protocol/openid-connect/token")
        ) {
          return;
        }

        const response = await request.response();
        if (!response) {
          return;
        }

        const headers = response.headers();
        const contentType =
          headers["content-type"] || headers["Content-Type"] || "";
        if (!contentType.includes("application/json")) {
          return;
        }

        const json = (await response.json()) as unknown;
        if (
          json &&
          typeof json === "object" &&
          "access_token" in json &&
          "refresh_token" in json
        ) {
          const typed = json as {
            access_token: string;
            refresh_token: string;
            expires_in: number;
            refresh_expires_in?: number;
            token_type: string;
          };

          tokenPayload = typed;
          logger.info("Captured PJN token response from SSO", {
            hasAccessToken: Boolean(typed.access_token),
            hasRefreshToken: Boolean(typed.refresh_token),
            expiresIn: typed.expires_in,
          });
        }
      } catch (err) {
        logger.warn("Failed to capture PJN token response", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

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

    logger.info("Establishing SCW session by navigating to consultaListaRelacionados.seam");
    try {
      await page.goto(
        "https://scw.pjn.gov.ar/scw/consultaListaRelacionados.seam",
        { waitUntil: "networkidle", timeout: 30000 }
      );
      const scwUrl = page.url();
      logger.info("SCW session established", { scwUrl });
    } catch (scwError) {
      // Log but don't fail the entire login if SCW navigation has issues
      logger.warn("Failed to navigate to SCW portal for JSESSIONID, continuing anyway", {
        error: scwError instanceof Error ? scwError.message : String(scwError),
      });
    }

    // Capture cookies from the browser context (now includes SCW JSESSIONID)
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

    // Attach tokens to the session if we captured them during login
    if (tokenPayload) {
      const {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: expiresIn,
      } = tokenPayload;

      sessionState.accessToken = accessToken;
      sessionState.refreshToken = refreshToken;
      sessionState.accessTokenExpiresAt = new Date(
        Date.now() + expiresIn * 1000
      ).toISOString();

      sessionState.headers = {
        ...(sessionState.headers ?? {}),
        Authorization: `Bearer ${accessToken}`,
      };

      logger.info("PJN tokens obtained from SSO flow and added to session", {
        expiresIn,
        accessTokenExpiresAt: sessionState.accessTokenExpiresAt,
      });
    } else {
      logger.warn("PJN SSO login completed but no token response was captured", {
        finalUrl: lastUrl,
      });
    }

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
