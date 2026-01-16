import { Page } from "playwright";
import { logger } from "../../middleware/logging";
import type { NormalizedCaseCandidate } from "../../types/api";
import { parseCaseSearchResultsHtml } from "../pjnCaseHistoryParsers";
import type { DebugStorage } from "../debugStorage";
import { navigateToCaseSearch } from "./pjnNavigation";
import { selectCaseHistoryCandidate } from "../caseHistorySearchSelection";

export interface CaseHistorySearchOptions {
  jurisdiction: string;
  caseNumber: string;
  year: number;
  /**
   * Optional full FRE in storage format (e.g. "FRE-3852/2020/TO2").
   * When provided, candidate auto-selection will prefer exact matches to this.
   */
  targetFre?: string;
  requestId?: string;
  debugStorage?: DebugStorage;
}

/**
 * Map jurisdiction codes to their numeric values used in the PJN dropdown.
 * These values are used in the "Personalizar Resultados" search form.
 * 
 * Note: The available options depend on the user's profile (letrado/parte).
 * This map includes all known jurisdictions from both authenticated and public forms.
 */
const JURISDICTION_VALUE_MAP: Record<string, string> = {
  // Cortes y Cámaras Nacionales
  CSJ: "0",   // Corte Suprema de Justicia de la Nación
  CIV: "1",   // Cámara Nacional de Apelaciones en lo Civil
  CAF: "2",   // Cámara Nacional de Apelaciones en lo Contencioso Administrativo Federal
  CCF: "3",   // Cámara Nacional de Apelaciones en lo Civil y Comercial Federal
  CNE: "4",   // Cámara Nacional Electoral
  CSS: "5",   // Cámara Federal de la Seguridad Social
  CPE: "6",   // Cámara Nacional de Apelaciones en lo Penal Económico
  CNT: "7",   // Cámara Nacional de Apelaciones del Trabajo
  CFP: "8",   // Cámara Criminal y Correccional Federal
  CCC: "9",   // Cámara Nacional de Apelaciones en lo Criminal y Correccional
  COM: "10",  // Cámara Nacional de Apelaciones en lo Comercial
  CPF: "11",  // Cámara Federal de Casación Penal
  CPN: "12",  // Cámara Nacional de Casación Penal
  // Justicia Federal del Interior
  FBB: "13",  // Justicia Federal de Bahía Blanca
  FCR: "14",  // Justicia Federal de Comodoro Rivadavia
  FCB: "15",  // Justicia Federal de Córdoba
  FCT: "16",  // Justicia Federal de Corrientes
  FGR: "17",  // Justicia Federal de General Roca
  FLP: "18",  // Justicia Federal de La Plata
  FMP: "19",  // Justicia Federal de Mar del Plata
  FMZ: "20",  // Justicia Federal de Mendoza
  FPO: "21",  // Justicia Federal de Posadas
  FPA: "22",  // Justicia Federal de Paraná
  FRE: "23",  // Justicia Federal de Resistencia
  FSA: "24",  // Justicia Federal de Salta
  FRO: "25",  // Justicia Federal de Rosario
  FSM: "26",  // Justicia Federal de San Martín
  FTU: "27",  // Justicia Federal de Tucumán
};

export interface CaseHistorySearchResult {
  fre: string;
  candidates: NormalizedCaseCandidate[];
  selectedCandidate: NormalizedCaseCandidate | null;
  searchHtml: string;
  cookies: string[];
}

/**
 * Perform a case history search using Playwright to interact with the UI.
 * 
 * This function:
 * - Navigates to the case search page
 * - Expands the "Personalizar Resultados" panel to access the search form
 * - Fills in the search form fields (jurisdiction, case number, year)
 * - Clicks the search button
 * - Waits for results to load
 * - Parses the HTML using the existing Cheerio parser
 * - Applies selection logic to pick the best matching candidate
 */
export async function performCaseHistorySearchPlaywright(
  page: Page,
  options: CaseHistorySearchOptions
): Promise<CaseHistorySearchResult> {
  const { jurisdiction, caseNumber, year, requestId, debugStorage } = options;
  const fre = `${jurisdiction.toUpperCase()}-${caseNumber}/${year}`;

  logger.info("Starting Playwright case history search", {
    fre,
    requestId,
  });

  // Navigate to the case search page
  await navigateToCaseSearch(page);

  // Step 1: Expand the "Personalizar Resultados" collapsed panel
  // The search form is hidden inside a Bootstrap collapse panel
  logger.debug("Expanding search form panel", { fre });

  const expandButtonSelectors = [
    'a:has-text("Personalizar Resultados")',
    'a[data-toggle="collapse"][href="#collapseOne"]',
    'a.btn-filter[data-toggle="collapse"]',
  ];

  let panelExpanded = false;
  for (const selector of expandButtonSelectors) {
    try {
      const expandButton = page.locator(selector).first();
      if (await expandButton.count() > 0) {
        await expandButton.click();
        // Wait for the collapse animation to complete
        await page.waitForTimeout(500);
        panelExpanded = true;
        break;
      }
    } catch {
      // Try next selector
    }
  }

  if (!panelExpanded) {
    logger.warn("Could not find expand button, form may already be visible", { fre });
  }

  // Step 2: Wait for the search form to be visible
  const formSelector = 'form[id="j_idt83:consultaExpediente"], form[name="j_idt83:consultaExpediente"]';
  
  try {
    await page.waitForSelector(formSelector, { timeout: 10000, state: "visible" });
  } catch {
    // Try alternative: wait for the jurisdiction dropdown which is always inside the form
    await page.waitForSelector('select[name*="camara"]', { timeout: 10000, state: "visible" });
  }

  logger.debug("Search form visible", { fre });

  // Step 3: Fill in the jurisdiction dropdown
  // The jurisdiction is a <select> element with numeric values
  const jurisdictionValue = JURISDICTION_VALUE_MAP[jurisdiction.toUpperCase()];
  if (!jurisdictionValue) {
    throw new Error(`Unknown jurisdiction code: ${jurisdiction}. Known codes: ${Object.keys(JURISDICTION_VALUE_MAP).join(", ")}`);
  }

  const jurisdictionSelect = page.locator('select[name="j_idt83:consultaExpediente:camara"]');
  await jurisdictionSelect.selectOption(jurisdictionValue);

  logger.debug("Jurisdiction selected", { 
    fre,
    jurisdiction,
    jurisdictionValue,
  });

  // Step 4: Fill case number
  const caseNumberInput = page.locator('input[name="j_idt83:consultaExpediente:j_idt116:numero"]');
  await caseNumberInput.fill(caseNumber);

  // Step 5: Fill year
  const yearInput = page.locator('input[name="j_idt83:consultaExpediente:j_idt118:anio"]');
  await yearInput.fill(String(year));

  logger.debug("Search form filled", {
    fre,
    jurisdiction,
    caseNumber,
    year,
  });

  // Step 6: Find and click the search button
  const searchButtonSelectors = [
    'input[name="j_idt83:consultaExpediente:consultaFiltroSearchButtonSAU"]',
    'input[id*="consultaFiltroSearchButtonSAU"]',
    'input[type="submit"][value="Consultar"]',
    'button:has-text("Consultar")',
  ];

  let searchClicked = false;
  for (const selector of searchButtonSelectors) {
    try {
      const button = page.locator(selector).first();
      if (await button.count() > 0) {
        await button.click();
        searchClicked = true;
        break;
      }
    } catch {
      // Try next selector
    }
  }

  if (!searchClicked) {
    throw new Error("Could not find search button");
  }

  // Step 7: Wait for results to load
  // Wait for navigation/form submission to complete
  await page.waitForLoadState("networkidle", { timeout: 30000 });

  // Also look for the results table to confirm
  const resultsTableSelectors = [
    'table[id*="dataTable"]',
    '#tablaConsultaLista\\:tablaConsultaForm\\:j_idt179\\:dataTable',
    'table.rf-dg',
  ];

  let resultsLoaded = false;
  for (const selector of resultsTableSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      resultsLoaded = true;
      break;
    } catch {
      // Try next selector
    }
  }

  if (!resultsLoaded) {
    logger.debug("Results table not found with specific selectors, continuing anyway", { fre });
  }

  // Capture the HTML
  const searchHtml = await page.content();

  logger.debug("Search results HTML captured", {
    fre,
    htmlLength: searchHtml.length,
  });

  // Parse the HTML using the existing parser
  const candidates = parseCaseSearchResultsHtml(searchHtml);

  logger.info("Parsed case history search results", {
    fre,
    candidateCount: candidates.length,
  });

  // Apply selection logic to find the best matching candidate
  const targetFre = options.targetFre ?? fre;
  const selection = selectCaseHistoryCandidate({
    targetFre,
    candidates,
    jurisdiction,
    caseNumber,
    year,
  });

  const selectedCandidate: NormalizedCaseCandidate | null =
    selection.selectedCandidate;

  if (selectedCandidate) {
    logger.info("Selected unambiguous candidate", {
      fre,
      targetFre,
      selectedFre: selectedCandidate.fre,
      rowIndex: selectedCandidate.rowIndex,
      exactFreMatchesCount: selection.exactFreMatchesCount,
      baseMatchesCount: selection.baseMatchesCount,
    });
  } else if (candidates.length > 0) {
    logger.warn("Ambiguous or no match; no candidate auto-selected", {
      fre,
      targetFre,
      candidateCount: candidates.length,
      exactFreMatchesCount: selection.exactFreMatchesCount,
      baseMatchesCount: selection.baseMatchesCount,
      searchJurisdiction: jurisdiction,
      searchCaseNumber: caseNumber,
      searchYear: year,
    });
  } else {
    logger.info("No candidates found in search results", { fre, targetFre });
  }

  // Save parsed results to debug storage if provided
  if (debugStorage) {
    const safeFre = fre.replace(/[/\\:]/g, "_");
    debugStorage.saveHtml(`${safeFre}_01_search`, searchHtml, {
      fre,
      searchOptions: {
        jurisdiction,
        caseNumber,
        year,
      },
    });
    debugStorage.saveJson(`${safeFre}_01_search_results`, {
      candidates,
      selectedCandidate,
      targetFre,
      exactFreMatchesCount: selection.exactFreMatchesCount,
      baseMatchesCount: selection.baseMatchesCount,
    }, {
      fre,
      searchOptions: {
        jurisdiction,
        caseNumber,
        year,
      },
    });
  }

  // Extract cookies from the page context for compatibility
  const playwrightCookies = await page.context().cookies();
  const cookies = playwrightCookies.map((c) => `${c.name}=${c.value}`);

  return {
    fre,
    candidates,
    selectedCandidate,
    searchHtml,
    cookies,
  };
}
