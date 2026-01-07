import fetch from "node-fetch";
import { createHash } from "crypto";
import * as cheerio from "cheerio";
import { logger } from "../middleware/logging";
import { config } from "../config";
import type { SessionState } from "./sessionStore";
import { GcsStorage } from "./storage";
import type {
  NormalizedMovement,
  NormalizedDigitalDocument,
  CaseHistoryStats,
  CaseHistoryDetailsResponse,
} from "../types/api";
import {
  performCaseHistorySearch,
  type CaseHistorySearchOptions,
} from "./caseHistorySearch";
import {
  parseActuacionesHtml,
  parseDocDigitalesHtml,
  parseIntervinientesHtml,
  parseRecursosHtml,
  parseVinculadosHtml,
  type NormalizedParticipant,
  type NormalizedAppeal,
  type NormalizedRelatedCase,
} from "./pjnCaseHistoryParsers";
import { DebugStorage, createDebugSession } from "./debugStorage";

/**
 * Options for scraping the full historical docket for a PJN expediente
 * from `expediente.seam`.
 */
export interface CaseHistoryDetailsOptions {
  /**
   * Normalized FRE / claveExpediente identifier for the case.
   */
  fre: string;
  /**
   * Identifier of the iAlex user on whose behalf we are scraping.
   * Used primarily for storage path partitioning and observability.
   */
  userId: string;
  /**
   * Whether to scrape the Actuaciones table.
   * Defaults to `true` when omitted.
   */
  includeMovements?: boolean;
  /**
   * Whether to scrape the "Doc. digitales" tab.
   * Defaults to `true` when omitted.
   */
  includeDocuments?: boolean;
  /**
   * Soft limit for the maximum number of movimientos to ingest.
   */
  maxMovements?: number;
  /**
   * Soft limit for the maximum number of digital documents to download.
   */
  maxDocuments?: number;
  /**
   * Optional request identifier for structured logging.
   */
  requestId?: string;
  /**
   * Enable debug storage for saving HTML and parsed results.
   * When true, creates a new debug session automatically.
   * When a DebugStorage instance is provided, uses that instance.
   * Defaults to true in development.
   */
  debugStorage?: boolean | DebugStorage;
}

/**
 * Result of scraping the PJN expediente page, independent of HTTP
 * transport concerns.
 *
 * This structure is designed to be directly consumed by Convex or
 * transformed into a `CaseHistoryDetailsResponse` by route handlers.
 */
export interface CaseHistoryDetailsResult {
  fre: string;
  movimientos: NormalizedMovement[];
  docDigitales: NormalizedDigitalDocument[];
  intervinientes: NormalizedParticipant[];
  recursos: NormalizedAppeal[];
  vinculados: NormalizedRelatedCase[];
  stats: CaseHistoryStats;
  /**
   * Optional cid for the expediente.seam conversation, when available.
   * This is taken from the final expediente URL (e.g. expediente.seam?cid=304513).
   */
  cid?: string;
}

const CASE_HISTORY_SEARCH_URL =
  "https://scw.pjn.gov.ar/scw/consultaListaRelacionados.seam";
const EXPEDIENTE_URL = "https://scw.pjn.gov.ar/scw/expediente.seam";

/**
 * Extract the javax.faces.ViewState value from an HTML page.
 */
function extractViewState(html: string): string | null {
  const viewStateRegex =
    /name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/i;
  const match = html.match(viewStateRegex);
  if (match && match[1]) {
    return match[1];
  }

  const altRegex = /value="([^"]+)"[^>]*name="javax\.faces\.ViewState"/i;
  const altMatch = html.match(altRegex);
  if (altMatch && altMatch[1]) {
    return altMatch[1];
  }

  return null;
}

/**
 * Merge cookies from Set-Cookie headers with existing cookies.
 */
function mergeCookies(
  existingCookies: string[],
  setCookieHeaders: string[]
): string[] {
  const cookieMap = new Map<string, string>();

  for (const cookie of existingCookies) {
    const [nameValue] = cookie.split(";");
    const eqIdx = nameValue.indexOf("=");
    if (eqIdx > 0) {
      const name = nameValue.substring(0, eqIdx).trim();
      cookieMap.set(name, nameValue.trim());
    }
  }

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
 * Navigate from search results to expediente.seam by submitting a JSF form
 * with the rowIndex parameter.
 *
 * This function:
 * 1. Uses the already-fetched search results HTML and cookies (no re-search!)
 * 2. Submits a form to navigate to the specific case using rowIndex
 * 3. Follows redirects to expediente.seam
 * 4. Returns the HTML of the expediente page and updated cookies
 */
async function navigateToExpediente(
  session: SessionState,
  searchHtml: string,
  searchCookies: string[],
  rowIndex: number
): Promise<{ html: string; cookies: string[]; cid: string }> {
  logger.debug("Navigating to expediente.seam", {
    rowIndex,
    searchHtmlLength: searchHtml.length,
    cookieCount: searchCookies.length,
  });

  // Extract ViewState from the search results HTML we already have
  const viewState = extractViewState(searchHtml);

  if (!viewState) {
    throw new Error("ViewState not found in search results page");
  }

  let currentCookies = [...searchCookies];

  const headers: Record<string, string> = {
    accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "accept-language":
      session.headers?.["Accept-Language"] ?? "en-US,en;q=0.9",
    "cache-control": "no-cache",
    pragma: "no-cache",
    "upgrade-insecure-requests": "1",
    cookie: currentCookies.join("; "),
    referer: CASE_HISTORY_SEARCH_URL,
  };

  if (session.headers?.["User-Agent"]) {
    headers["user-agent"] = session.headers["User-Agent"];
  }

  // Locate the original JSF form and all of its inputs so we can faithfully
  // reproduce the POST that the browser would send when clicking "visualizar".
  const $ = cheerio.load(searchHtml);
  const form =
    $("form#tablaConsultaLista\\:tablaConsultaForm").first().length > 0
      ? $("form#tablaConsultaLista\\:tablaConsultaForm").first()
      : $("form[name='tablaConsultaLista:tablaConsultaForm']").first();

  if (!form.length) {
    throw new Error(
      "Could not find tablaConsultaLista:tablaConsultaForm in search results HTML"
    );
  }

  const formActionAttr = form.attr("action") || CASE_HISTORY_SEARCH_URL;
  const formActionUrl = formActionAttr.startsWith("http")
    ? formActionAttr
    : new URL(formActionAttr, CASE_HISTORY_SEARCH_URL).toString();

  const formName =
    form.attr("name") ||
    form.attr("id") ||
    "tablaConsultaLista:tablaConsultaForm";

  // Step 3: Submit form to navigate to expediente using rowIndex
  const formParams = new URLSearchParams();

  // 3a) Pre-populate with all inputs from the original form (including hidden).
  form.find("input").each((_, el) => {
    const name = $(el).attr("name");
    if (!name) return;

    const type = ($(el).attr("type") || "").toLowerCase();
    // Only send checked checkboxes / radios
    if ((type === "checkbox" || type === "radio") && !$(el).attr("checked")) {
      return;
    }

    const value = $(el).attr("value") ?? "";
    formParams.set(name, value);
  });

  // 3b) Override the key JSF params to mimic clicking the "visualizar expediente" button.
  formParams.set(formName, formName);

  const triggerName = `tablaConsultaLista:tablaConsultaForm:j_idt179:dataTable:${rowIndex}:j_idt230`;
  formParams.set(triggerName, triggerName);

  formParams.set("javax.faces.ViewState", viewState);
  formParams.set("conversationPropagation", "join");

  const formHeaders: Record<string, string> = {
    ...headers,
    "content-type": "application/x-www-form-urlencoded",
    cookie: currentCookies.join("; "),
  };

  logger.debug("Submitting JSF form to navigate to expediente", {
    rowIndex,
    formAction: formActionUrl,
  });

  const formResponse = await fetch(formActionUrl, {
    method: "POST",
    headers: formHeaders,
    body: formParams.toString(),
    redirect: "manual",
  });

  // Update cookies from form submission
  const formSetCookieHeaders = formResponse.headers.raw()["set-cookie"] || [];
  currentCookies = mergeCookies(currentCookies, formSetCookieHeaders);

  // Step 4: Follow redirect to expediente.seam
  if (formResponse.status >= 300 && formResponse.status < 400) {
    const location = formResponse.headers.get("location");
    if (!location) {
      throw new Error("Redirect without location header");
    }

    let expedienteUrl: string;
    if (location.startsWith("/")) {
      expedienteUrl = `https://scw.pjn.gov.ar${location}`;
    } else if (location.startsWith("http")) {
      expedienteUrl = location;
    } else {
      expedienteUrl = `https://scw.pjn.gov.ar/scw/${location}`;
    }

    logger.debug("Following redirect to expediente.seam", {
      location: expedienteUrl,
    });

    const expedienteResponse = await fetch(expedienteUrl, {
      method: "GET",
      headers: {
        ...headers,
        cookie: currentCookies.join("; "),
        referer: CASE_HISTORY_SEARCH_URL,
      },
      // Allow JSF / SCW to complete any additional redirects needed to land
      // on the actual expediente view instead of failing on 3xx.
      redirect: "follow",
    });

    // Update cookies from expediente page (after redirects have been followed)
    const expedienteSetCookieHeaders =
      expedienteResponse.headers.raw()["set-cookie"] || [];
    currentCookies = mergeCookies(currentCookies, expedienteSetCookieHeaders);

    if (!expedienteResponse.ok) {
      throw new Error(
        `Failed to load expediente page: ${expedienteResponse.status}`
      );
    }

    const expedienteHtml = await expedienteResponse.text();

    const urlObj = new URL(expedienteResponse.url);
    // Only trust cid when we're actually on expediente.seam
    const cid =
      urlObj.pathname.endsWith("/expediente.seam") &&
      urlObj.searchParams.get("cid")
        ? urlObj.searchParams.get("cid")!
        : "";

    logger.info("Successfully navigated to expediente.seam", {
      cid,
      url: expedienteUrl,
    });

    return {
      html: expedienteHtml,
      cookies: currentCookies,
      cid,
    };
  }

  // If no redirect, try to parse the response as expediente page
  const html = await formResponse.text();
  const urlObj = new URL(formResponse.url);
  const cid =
    urlObj.pathname.endsWith("/expediente.seam") &&
    urlObj.searchParams.get("cid")
      ? urlObj.searchParams.get("cid")!
      : "";

  return {
    html,
    cookies: currentCookies,
    cid,
  };
}

/**
 * Parse FRE to extract jurisdiction, caseNumber, and year.
 * Format: "FRE-3852/2020" or "FRE-3852/2020/TO2"
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
 * Load the "Doc. digitales" tab by submitting a JSF form.
 * This may require clicking a tab or submitting a form to load the content.
 */
async function loadDocDigitalesTab(
  session: SessionState,
  expedienteHtml: string,
  cookies: string[]
): Promise<string> {
  const $ = cheerio.load(expedienteHtml);
  
  // Look for the Doc. digitales tab link or form
  const tabSelectors = [
    'a[href*="doc" i][href*="digital" i]',
    'a[id*="doc" i][id*="digital" i]',
    'input[value*="doc" i][value*="digital" i]',
    'button[onclick*="doc" i][onclick*="digital" i]',
  ];

  let tabElement = $();
  for (const selector of tabSelectors) {
    tabElement = $(selector).first();
    if (tabElement.length > 0) {
      break;
    }
  }

  // Extract ViewState from the current page
  const viewState = extractViewState(expedienteHtml);
  if (!viewState) {
    logger.warn("ViewState not found, cannot load Doc. digitales tab");
    return expedienteHtml; // Return original HTML if we can't load the tab
  }

  // If we found a tab element, try to submit a form to load it
  if (tabElement.length > 0) {
    const href = tabElement.attr("href");
    const onclick = tabElement.attr("onclick");
    const name = tabElement.attr("name");
    const id = tabElement.attr("id");

    // Try to extract form action and parameters
    const form = tabElement.closest("form");
    if (form.length > 0) {
      const formAction = form.attr("action") || EXPEDIENTE_URL;
      const formName = form.attr("name") || form.attr("id") || "";

      const formParams = new URLSearchParams();
      if (formName) {
        formParams.set(formName, formName);
      }
      if (name) {
        formParams.set(name, name);
      }
      if (id) {
        formParams.set(id, id);
      }
      formParams.set("javax.faces.ViewState", viewState);

      const headers: Record<string, string> = {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "accept-language":
          session.headers?.["Accept-Language"] ?? "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "content-type": "application/x-www-form-urlencoded",
        pragma: "no-cache",
        "upgrade-insecure-requests": "1",
        cookie: cookies.join("; "),
        referer: EXPEDIENTE_URL,
      };

      if (session.headers?.["User-Agent"]) {
        headers["user-agent"] = session.headers["User-Agent"];
      }

      try {
        const response = await fetch(formAction, {
          method: "POST",
          headers,
          body: formParams.toString(),
          redirect: "manual",
        });

        if (response.ok) {
          return await response.text();
        }
      } catch (error) {
        logger.warn("Failed to load Doc. digitales tab", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // If we couldn't load the tab, return the original HTML
  // The parser will try to find documents in the current page
  return expedienteHtml;
}

/**
 * Load Intervinientes tab by submitting a JSF form.
 */
async function loadIntervinientesTab(
  session: SessionState,
  expedienteHtml: string,
  cookies: string[]
): Promise<string> {
  return loadTabByName(session, expedienteHtml, cookies, "intervinientes");
}

/**
 * Load Recursos tab by submitting a JSF form.
 */
async function loadRecursosTab(
  session: SessionState,
  expedienteHtml: string,
  cookies: string[]
): Promise<string> {
  return loadTabByName(session, expedienteHtml, cookies, "recursos");
}

/**
 * Load Vinculados tab by submitting a JSF form.
 */
async function loadVinculadosTab(
  session: SessionState,
  expedienteHtml: string,
  cookies: string[]
): Promise<string> {
  return loadTabByName(session, expedienteHtml, cookies, "vinculados");
}

/**
 * Generic tab loader - finds and clicks a tab by partial name match.
 */
async function loadTabByName(
  session: SessionState,
  expedienteHtml: string,
  cookies: string[],
  tabName: string
): Promise<string> {
  const $ = cheerio.load(expedienteHtml);

  // Look for tab link/button
  const tabElement = $(`a[href*="${tabName}" i], a[id*="${tabName}" i], input[value*="${tabName}" i]`).first();

  const viewState = extractViewState(expedienteHtml);
  if (!viewState) {
    return expedienteHtml;
  }

  if (tabElement.length > 0) {
    const form = tabElement.closest("form");
    if (form.length > 0) {
      const formAction = form.attr("action") || EXPEDIENTE_URL;
      const formName = form.attr("name") || form.attr("id") || "";
      const name = tabElement.attr("name");
      const id = tabElement.attr("id");

      const formParams = new URLSearchParams();
      if (formName) formParams.set(formName, formName);
      if (name) formParams.set(name, name);
      if (id) formParams.set(id, id);
      formParams.set("javax.faces.ViewState", viewState);

      const headers: Record<string, string> = {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": session.headers?.["Accept-Language"] ?? "en-US,en;q=0.9",
        "content-type": "application/x-www-form-urlencoded",
        cookie: cookies.join("; "),
        referer: EXPEDIENTE_URL,
      };

      if (session.headers?.["User-Agent"]) {
        headers["user-agent"] = session.headers["User-Agent"];
      }

      try {
        const response = await fetch(formAction, {
          method: "POST",
          headers,
          body: formParams.toString(),
          redirect: "follow",
        });

        if (response.ok) {
          return await response.text();
        }
      } catch (error) {
        logger.warn(`Failed to load ${tabName} tab`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return expedienteHtml;
}

/**
 * Download a PDF from a document reference and upload to GCS.
 */
async function downloadAndUploadPdf(
  docRef: string | null,
  docId: string,
  userId: string,
  session: SessionState,
  cookies: string[],
  storage: GcsStorage
): Promise<string | null> {
  if (!docRef) {
    return null;
  }

  try {
    // Construct download URL - docRef might be a relative path, onclick, or full URL
    let downloadUrl = docRef;
    if (docRef.startsWith("javascript:") || docRef.includes("onclick")) {
      // Extract URL from JavaScript
      const urlMatch = docRef.match(/['"]([^'"]+\.pdf[^'"]*)['"]/i);
      if (urlMatch) {
        downloadUrl = urlMatch[1];
      } else {
        logger.warn("Could not extract URL from JavaScript reference", { docRef });
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
      "accept-language":
        session.headers?.["Accept-Language"] ?? "en-US,en;q=0.9",
      cookie: cookies.join("; "),
      referer: EXPEDIENTE_URL,
    };

    if (session.headers?.["User-Agent"]) {
      headers["user-agent"] = session.headers["User-Agent"];
    }

    const response = await fetch(downloadUrl, {
      method: "GET",
      headers,
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location) {
        // Follow redirect
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
 * Scrape the full historical docket (movimientos and digital documents)
 * for a PJN expediente using the portal UI (`expediente.seam`).
 *
 * This function is responsible for:
 * - Parsing the FRE to extract jurisdiction, caseNumber, and year
 * - Performing a search to get the rowIndex for navigation
 * - Navigating to `expediente.seam` via JSF form submission
 * - Scraping and normalizing the Actuaciones table into `NormalizedMovement`
 *   entries, including any hints about associated documents.
 * - Loading and scraping the "Doc. digitales" tab, normalizing rows into
 *   `NormalizedDigitalDocument` entries.
 * - Downloading PDFs for movements/docs that expose a download action and
 *   uploading them to GCS via `GcsStorage`, populating `gcsPath` fields.
 * - Respecting `maxMovements` / `maxDocuments` soft limits and continuing
 *   gracefully when individual downloads fail.
 * - Producing aggregate `CaseHistoryStats` with counts, error totals, and
 *   an approximate duration.
 */
export async function scrapeCaseHistoryDetails(
  session: SessionState,
  options: CaseHistoryDetailsOptions,
  storage: GcsStorage = new GcsStorage()
): Promise<CaseHistoryDetailsResult> {
  const startTime = Date.now();
  const { fre, userId, includeMovements = true, includeDocuments = true, maxMovements, maxDocuments, requestId } = options;

  // Initialize debug storage
  let debugStorage: DebugStorage | undefined;
  if (options.debugStorage === true || options.debugStorage === undefined) {
    // Create new debug session (enabled by default in non-production)
    debugStorage = createDebugSession();
  } else if (options.debugStorage instanceof DebugStorage) {
    debugStorage = options.debugStorage;
  }

  const safeFre = fre.replace(/[/\\:]/g, "_");

  logger.info("Starting case history details scrape", {
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

  // Step 1: Perform search to get rowIndex
  logger.debug("Step 1: Performing search to get rowIndex", { fre, jurisdiction, caseNumber, year });
  const searchResult = await performCaseHistorySearch(session, {
    jurisdiction,
    caseNumber,
    year,
    requestId,
    debugStorage,
  });

  if (!searchResult.selectedCandidate) {
    const error = `No candidate found for FRE ${fre}. Cannot navigate to expediente page.`;
    debugStorage?.saveJson(`${safeFre}_error`, { error, stage: "search", candidates: searchResult.candidates });
    throw new Error(error);
  }

  const rowIndex = searchResult.selectedCandidate.rowIndex;
  logger.debug("Search completed, selected candidate", {
    fre,
    rowIndex,
    selectedFre: searchResult.selectedCandidate.fre,
  });

  // Step 2: Navigate to expediente.seam using the search result HTML and cookies
  logger.debug("Step 2: Navigating to expediente.seam", { rowIndex });
  const navigationResult = await navigateToExpediente(
    session,
    searchResult.searchHtml,
    searchResult.cookies,
    rowIndex
  );
  const { html: expedienteHtml, cookies, cid } = navigationResult;

  // Save expediente HTML to debug storage
  debugStorage?.saveHtml(`${safeFre}_02_expediente`, expedienteHtml, { fre, cid, rowIndex });

  // Step 3: Parse Actuaciones
  let movimientos: NormalizedMovement[] = [];
  if (includeMovements) {
    logger.debug("Step 3: Parsing Actuaciones", { fre });
    movimientos = parseActuacionesHtml(expedienteHtml, fre);
    
    // Save parsed actuaciones to debug storage
    debugStorage?.saveJson(`${safeFre}_02_actuaciones`, movimientos, { fre, totalCount: movimientos.length });
    
    // Apply maxMovements limit
    if (maxMovements && movimientos.length > maxMovements) {
      movimientos = movimientos.slice(0, maxMovements);
      logger.info("Limited movimientos to maxMovements", {
        fre,
        maxMovements,
        totalFound: movimientos.length,
      });
    }
  }

  // Step 4: Load and parse Doc. digitales tab
  // COMMENTED OUT FOR TESTING - Only parsing actuaciones for now
  let docDigitales: NormalizedDigitalDocument[] = [];
  // if (includeDocuments) {
  //   logger.debug("Step 4: Loading Doc. digitales tab", { fre });
  //   const docDigitalesHtml = await loadDocDigitalesTab(
  //     session,
  //     expedienteHtml,
  //     cookies
  //   );

  //   // Save Doc. digitales HTML to debug storage
  //   debugStorage?.saveHtml(`${safeFre}_03_doc_digitales`, docDigitalesHtml, { fre, cid });
  //   
  //   logger.debug("Step 4: Parsing Doc. digitales", { fre });
  //   docDigitales = parseDocDigitalesHtml(docDigitalesHtml, fre);
  //   
  //   // Save parsed doc digitales to debug storage
  //   debugStorage?.saveJson(`${safeFre}_03_doc_digitales`, docDigitales, { fre, totalCount: docDigitales.length });
  //   
  //   // Apply maxDocuments limit
  //   if (maxDocuments && docDigitales.length > maxDocuments) {
  //     docDigitales = docDigitales.slice(0, maxDocuments);
  //     logger.info("Limited docDigitales to maxDocuments", {
  //       fre,
  //       maxDocuments,
  //       totalFound: docDigitales.length,
  //     });
  //   }
  // }

  // Step 5: Load and parse Intervinientes tab
  // COMMENTED OUT FOR TESTING - Only parsing actuaciones for now
  // logger.debug("Step 5: Loading Intervinientes tab", { fre });
  // const intervinientesHtml = await loadIntervinientesTab(session, expedienteHtml, cookies);
  // debugStorage?.saveHtml(`${safeFre}_04_intervinientes`, intervinientesHtml, { fre });
  // const intervinientes = parseIntervinientesHtml(intervinientesHtml);
  // debugStorage?.saveJson(`${safeFre}_04_intervinientes`, intervinientes, { fre, totalCount: intervinientes.length });
  const intervinientes: NormalizedParticipant[] = [];

  // Step 6: Load and parse Recursos tab
  // COMMENTED OUT FOR TESTING - Only parsing actuaciones for now
  // logger.debug("Step 6: Loading Recursos tab", { fre });
  // const recursosHtml = await loadRecursosTab(session, expedienteHtml, cookies);
  // debugStorage?.saveHtml(`${safeFre}_05_recursos`, recursosHtml, { fre });
  // const recursos = parseRecursosHtml(recursosHtml);
  // debugStorage?.saveJson(`${safeFre}_05_recursos`, recursos, { fre, totalCount: recursos.length });
  const recursos: NormalizedAppeal[] = [];

  // Step 7: Load and parse Vinculados tab
  // COMMENTED OUT FOR TESTING - Only parsing actuaciones for now
  // logger.debug("Step 7: Loading Vinculados tab", { fre });
  // const vinculadosHtml = await loadVinculadosTab(session, expedienteHtml, cookies);
  // debugStorage?.saveHtml(`${safeFre}_06_vinculados`, vinculadosHtml, { fre });
  // const vinculados = parseVinculadosHtml(vinculadosHtml);
  // debugStorage?.saveJson(`${safeFre}_06_vinculados`, vinculados, { fre, totalCount: vinculados.length });
  const vinculados: NormalizedRelatedCase[] = [];

  // Step 8: Download PDFs and upload to GCS
  let downloadErrors = 0;
  
  // Download PDFs for documents with docRef
  // COMMENTED OUT FOR TESTING - Only parsing actuaciones for now
  // for (const doc of docDigitales) {
  //   if (doc.docRef && !doc.gcsPath) {
  //     try {
  //       const gcsPath = await downloadAndUploadPdf(
  //         doc.docRef,
  //         doc.docId,
  //         userId,
  //         session,
  //         cookies,
  //         storage
  //       );
  //       if (gcsPath) {
  //         doc.gcsPath = gcsPath;
  //       } else {
  //         downloadErrors++;
  //       }
  //     } catch (error) {
  //       logger.error("Error processing document PDF", {
  //         docId: doc.docId,
  //         error: error instanceof Error ? error.message : String(error),
  //       });
  //       downloadErrors++;
  //     }
  //   }
  // }

  // Download PDFs for movements with docRef
  for (const movement of movimientos) {
    if (movement.docRef && movement.hasDocument && !movement.gcsPath) {
      try {
        const gcsPath = await downloadAndUploadPdf(
          movement.docRef,
          movement.movementId,
          userId,
          session,
          cookies,
          storage
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

  logger.info("Case history details scrape completed", {
    fre,
    userId,
    requestId,
    stats,
    debugSessionId: debugStorage?.getSessionId(),
    debugSessionDir: debugStorage?.getSessionDir(),
  });

  return result;
}

/**
 * Convert a low-level `CaseHistoryDetailsResult` into the public
 * `CaseHistoryDetailsResponse` shape used by the HTTP router.
 *
 * Route handlers can use this helper to encapsulate the mapping between
 * internal scraping results and the API contract returned to Convex.
 *
 * This helper should:
 * - Map the normalized movimientos and documents directly to the response.
 * - Attach the aggregate `stats` object.
 * - Always return a `"OK"` variant; error conditions are handled at the
 *   route/scraper level before calling this helper.
 *
 * NOTE: This is a pure transformation and must not perform any I/O.
 */
export function toCaseHistoryDetailsResponse(
  result: CaseHistoryDetailsResult
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

