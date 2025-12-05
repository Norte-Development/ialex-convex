import fetch from "node-fetch";
import { logger } from "../middleware/logging";
import { config } from "../config";
import type { SessionState } from "./sessionStore";
import {
  type NormalizedCaseCandidate,
  type CaseHistorySearchResponse,
} from "../types/api";

const CASE_HISTORY_SEARCH_URL =
  "https://scw.pjn.gov.ar/scw/consultaListaRelacionados.seam";

interface RawCaseHistorySearchResult {
  fre: string;
  html: string;
}

/**
 * Result of establishing an SCW session via GET request.
 */
interface ScwSessionResult {
  /** Updated cookies including any new SCW session cookies */
  cookies: string[];
  /** The javax.faces.ViewState token extracted from the page */
  viewState: string;
  /** The HTML content of the page (for debugging) */
  html: string;
}

function buildFreFromOptions(options: CaseHistorySearchOptions): string {
  return `${options.jurisdiction}-${options.caseNumber}/${options.year}`;
}

/**
 * Extract the javax.faces.ViewState value from an HTML page.
 * JSF embeds this as a hidden input field in forms.
 */
function extractViewState(html: string): string | null {
  // Look for: <input type="hidden" name="javax.faces.ViewState" ... value="..." />
  const viewStateRegex =
    /name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/i;
  const match = html.match(viewStateRegex);
  if (match && match[1]) {
    return match[1];
  }

  // Alternative pattern: value comes before name
  const altRegex = /value="([^"]+)"[^>]*name="javax\.faces\.ViewState"/i;
  const altMatch = html.match(altRegex);
  if (altMatch && altMatch[1]) {
    return altMatch[1];
  }

  return null;
}

/**
 * Parse Set-Cookie headers and merge with existing cookies.
 * Returns a deduplicated array of cookie strings.
 */
function mergeCookies(
  existingCookies: string[],
  setCookieHeaders: string[]
): string[] {
  const cookieMap = new Map<string, string>();

  // Parse existing cookies
  for (const cookie of existingCookies) {
    const [nameValue] = cookie.split(";");
    const eqIdx = nameValue.indexOf("=");
    if (eqIdx > 0) {
      const name = nameValue.substring(0, eqIdx).trim();
      cookieMap.set(name, nameValue.trim());
    }
  }

  // Parse and merge new cookies from Set-Cookie headers
  for (const setCookie of setCookieHeaders) {
    const [nameValue] = setCookie.split(";");
    const eqIdx = nameValue.indexOf("=");
    if (eqIdx > 0) {
      const name = nameValue.substring(0, eqIdx).trim();
      cookieMap.set(name, nameValue.trim());
    }
  }

  return Array.from(cookieMap.values());
}

/**
 * Check if the session has an SCW JSESSIONID cookie.
 * If present, we can skip the SSO auth flow and go directly to the search page.
 */
function hasScwJsessionId(cookies: string[]): boolean {
  return cookies.some((c) => {
    const trimmed = c.trim();
    return trimmed.startsWith("JSESSIONID=") || trimmed.includes("scw");
  });
}

/**
 * Establish an SCW session by doing a GET request to the search page.
 * This handles any SSO redirects and extracts the ViewState token.
 * 
 * If there's no SCW JSESSIONID in the session, we start from the SSO auth URL
 * to trigger the OpenID Connect flow that will redirect us to the SCW page.
 */
async function establishScwSession(
  session: SessionState,
  fre: string
): Promise<ScwSessionResult> {
  let currentCookies = session.cookies ? [...session.cookies] : [];
  
  // If we don't have an SCW session cookie yet, start from the SSO auth URL
  // to trigger the OpenID Connect flow. Otherwise, go directly to the SCW page.
  let currentUrl = hasScwJsessionId(currentCookies)
    ? CASE_HISTORY_SEARCH_URL
    : config.pjnScwSsoAuthUrl;

  logger.debug("SCW session establishment starting", {
    hasJsessionId: hasScwJsessionId(currentCookies),
    startingUrl: currentUrl,
    cookieCount: currentCookies.length,
  });

  let redirectCount = 0;
  const maxRedirects = 10;

  const baseHeaders: Record<string, string> = {
    accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "accept-language":
      session.headers?.["Accept-Language"] ?? "en-US,en;q=0.9",
    "cache-control": "no-cache",
    pragma: "no-cache",
    "upgrade-insecure-requests": "1",
  };

  if (session.headers?.["User-Agent"]) {
    baseHeaders["user-agent"] = session.headers["User-Agent"];
  }

  // Note: We don't include Authorization header for SCW requests.
  // SCW is a JSF web application that uses cookie-based sessions,
  // not JWT bearer tokens.

  while (redirectCount < maxRedirects) {
    const headers = {
      ...baseHeaders,
      cookie: currentCookies.join("; "),
    };

    logger.debug("SCW session establishment GET", {
      url: currentUrl,
      redirectCount,
      cookieCount: currentCookies.length,
    });

    const response = await fetch(currentUrl, {
      method: "GET",
      headers,
      redirect: "manual",
    });

    // Collect any new cookies
    const setCookieHeaders = response.headers.raw()["set-cookie"] || [];
    if (setCookieHeaders.length > 0) {
      currentCookies = mergeCookies(currentCookies, setCookieHeaders);
      logger.debug("SCW session received cookies", {
        newCookieCount: setCookieHeaders.length,
        totalCookies: currentCookies.length,
      });
    }

    // Handle redirects
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Redirect without location header");
      }

      // Resolve relative URLs
      if (location.startsWith("/")) {
        const urlObj = new URL(currentUrl);
        currentUrl = `${urlObj.protocol}//${urlObj.host}${location}`;
      } else if (!location.startsWith("http")) {
        const urlObj = new URL(currentUrl);
        currentUrl = `${urlObj.protocol}//${urlObj.host}/${location}`;
      } else {
        currentUrl = location;
      }

      redirectCount++;
      logger.debug("SCW session following redirect", {
        status: response.status,
        location: currentUrl,
        redirectCount,
      });
      continue;
    }

    // Check for success
    if (!response.ok) {
      logger.error("SCW session establishment failed", {
        status: response.status,
        url: currentUrl,
      });
      throw new Error(`SCW session failed with status ${response.status}`);
    }

    // We got a successful response - extract the HTML and ViewState
    const html = await response.text();
    const viewState = extractViewState(html);

    if (!viewState) {
      logger.warn("SCW session: ViewState not found in HTML", {
        finalUrl: currentUrl,
        htmlLength: html.length,
        htmlPreview: html.substring(0, 500),
      });
      throw new Error("ViewState not found in SCW page");
    }

    logger.info("SCW session established successfully", {
      fre,
      finalUrl: currentUrl,
      redirectCount,
      cookieCount: currentCookies.length,
      viewStateLength: viewState.length,
    });

    return {
      cookies: currentCookies,
      viewState,
      html,
    };
  }

  throw new Error(`Too many redirects (${maxRedirects}) establishing SCW session`);
}

/**
 * Build the x-www-form-urlencoded payload for
 * `consultaListaRelacionados.seam` based on the provided search options.
 */
function buildSearchFormBody(
  options: CaseHistorySearchOptions,
  viewState: string
): string {
  const params = new URLSearchParams();

  // JSF form identifier – required to target the correct component.
  params.set("j_idt83:consultaExpediente", "j_idt83:consultaExpediente");

  // Jurisdiction / camara
  params.set("j_idt83:consultaExpediente:camara", options.jurisdiction);

  // Case number (numeric portion)
  params.set("j_idt83:consultaExpediente:j_idt116:numero", options.caseNumber);

  // Year
  params.set("j_idt83:consultaExpediente:j_idt118:anio", String(options.year));

  // Optional filters we currently leave blank.
  params.set("j_idt83:consultaExpediente:caratula", "");
  params.set("j_idt83:consultaExpediente:situation", "");

  // Submit button identifier.
  params.set(
    "j_idt83:consultaExpediente:consultaFiltroSearchButtonSAU",
    "Consultar"
  );

  // The critical ViewState token from the GET request
  params.set("javax.faces.ViewState", viewState);

  return params.toString();
}

/**
 * Low-level helper that performs the actual HTTP POST against
 * `consultaListaRelacionados.seam` using the stored PJN session cookies.
 *
 * This implements a two-step flow:
 * 1. GET the search page to establish an SCW session and get the ViewState
 * 2. POST the form with the search parameters and ViewState
 *
 * This returns the raw HTML response and the FRE that was ultimately used
 * for logging and later parsing.
 */
async function fetchCaseHistorySearchHtml(
  session: SessionState,
  options: CaseHistorySearchOptions
): Promise<RawCaseHistorySearchResult> {
  const fre = buildFreFromOptions(options);

  if (!session.cookies || session.cookies.length === 0) {
    logger.warn("Case history search attempted without PJN cookies", { fre });
    throw new Error("AUTH_REQUIRED");
  }

  // Step 1: Establish SCW session and get ViewState
  logger.info("Step 1: Establishing SCW session", { fre });
  const scwSession = await establishScwSession(session, fre);

  // Step 2: Submit the search form with the ViewState
  logger.info("Step 2: Submitting search form", { fre });

  const cookieHeader = scwSession.cookies.join("; ");

  const headers: Record<string, string> = {
    accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "accept-language":
      session.headers?.["Accept-Language"] ?? "en-US,en;q=0.9",
    "cache-control": "no-cache",
    "content-type": "application/x-www-form-urlencoded",
    pragma: "no-cache",
    "upgrade-insecure-requests": "1",
    cookie: cookieHeader,
    referer: CASE_HISTORY_SEARCH_URL,
  };

  // Preserve the original User-Agent
  if (session.headers?.["User-Agent"]) {
    headers["user-agent"] = session.headers["User-Agent"];
  }

  // Note: We don't include Authorization header for SCW POST requests.
  // The SCW JSF application uses cookie-based sessions (JSESSIONID).

  const body = buildSearchFormBody(options, scwSession.viewState);

  logger.debug("Submitting PJN case history search (HTTP)", {
    url: CASE_HISTORY_SEARCH_URL,
    fre,
    hasCookies: Boolean(scwSession.cookies.length),
    hasViewState: Boolean(scwSession.viewState),
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    config.requestTimeoutMs
  );

  try {
    const response = await fetch(CASE_HISTORY_SEARCH_URL, {
      method: "POST",
      headers,
      body,
      redirect: "manual",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      logger.warn("PJN case history search redirected", {
        status: response.status,
        location,
      });
      throw new Error("AUTH_REQUIRED");
    }

    if (!response.ok) {
      logger.error("PJN case history search failed", {
        status: response.status,
      });
      throw new Error(
        `Case history search failed with status ${response.status}`
      );
    }

    const html = await response.text();

    logger.debug("PJN case history search HTML fetched", {
      fre,
      status: response.status,
      htmlLength: html.length,
    });

    return { fre, html };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      logger.error("PJN case history search timeout", {
        fre,
        timeoutMs: config.requestTimeoutMs,
      });
      throw new Error(`Request timeout after ${config.requestTimeoutMs}ms`);
    }

    logger.error("PJN case history search request error", {
      fre,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Input parameters for performing a PJN case history search against
 * `consultaListaRelacionados.seam`.
 *
 * Requires jurisdiction, caseNumber, and year to perform the search.
 */
export interface CaseHistorySearchOptions {
  /**
   * Jurisdiction code, e.g. "FRE", "CSJ", "CIV", or jurisdiction number.
   */
  jurisdiction: string;
  /**
   * Case number portion, e.g. "3852".
   */
  caseNumber: string;
  /**
   * Four-digit year for the case.
   */
  year: number;
  /**
   * Optional request identifier for structured logging and tracing.
   */
  requestId?: string;
}

/**
 * Result of a low-level search operation against the PJN case list.
 *
 * This is a thinner abstraction than the HTTP response shape and is
 * intended for consumption by route handlers or higher-level services.
 */
export interface CaseHistorySearchResult {
  /**
   * Normalized FRE that was ultimately used for the search.
   */
  fre: string;
  /**
   * List of candidate expedientes returned by PJN.
   */
  candidates: NormalizedCaseCandidate[];
  /**
   * Selected candidate, if the scraper was able to unambiguously choose
   * one expediente (e.g. exact FRE match).
   */
  selectedCandidate: NormalizedCaseCandidate | null;
}

/**
 * Perform a case history search on the PJN portal using an existing
 * authenticated session.
 *
 * This function is responsible for:
 * - Navigating to `consultaListaRelacionados.seam` using Playwright.
 * - Submitting the appropriate search form with the provided FRE or
 *   jurisdiction + case number.
 * - Parsing the resulting HTML table into a list of `NormalizedCaseCandidate`
 *   objects using dedicated HTML parsing helpers.
 * - Applying a best-effort selection strategy to pick a single candidate
 *   (e.g. exact FRE match), while still returning all candidates for UI
 *   disambiguation when necessary.
 * - Emitting structured logs with request identifiers, timing, and counts.
 *
 * NOTE: The concrete Playwright/browser logic and HTML parsing are not
 * implemented yet; this is a typed placeholder to be filled in later.
 */
export async function performCaseHistorySearch(
  session: SessionState,
  options: CaseHistorySearchOptions
): Promise<CaseHistorySearchResult> {
  const { fre, html } = await fetchCaseHistorySearchHtml(session, options);

  // The raw HTML is now available for parsing into `NormalizedCaseCandidate`
  // objects. The parsing layer is intentionally left for a follow-up change.
  logger.debug("performCaseHistorySearch HTML ready for parsing", {
    fre,
    htmlLength: html.length,
  });

  // TODO: Use `parseCaseSearchResultsHtml(html)` and selection logic to build
  // a full `CaseHistorySearchResult`.
  throw new Error("Not implemented: HTML parsing for performCaseHistorySearch");
}

/**
 * Convert a low-level `CaseHistorySearchResult` into the public
 * `CaseHistorySearchResponse` shape used by the HTTP router.
 *
 * Route handlers can use this helper to encapsulate the mapping between
 * internal scraping results and the API contract returned to Convex.
 *
 * This helper should:
 * - Map the selected candidate (if any) into `fre` + `cid`.
 * - Choose `"OK"` vs `"NOT_FOUND"` depending on candidate count.
 * - Optionally attach additional case metadata when available.
 *
 * NOTE: This is a pure transformation and must not perform any I/O.
 */
export function toCaseHistorySearchResponse(
  result: CaseHistorySearchResult
): CaseHistorySearchResponse {
  // Placeholder implementation: document intended behavior via JSDoc.
  logger.debug("toCaseHistorySearchResponse called (placeholder)", {
    candidateCount: result.candidates.length,
    hasSelected: Boolean(result.selectedCandidate),
  });

  throw new Error("Not implemented: toCaseHistorySearchResponse");
}

