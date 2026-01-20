/**
 * PJN Jurisdiction codes from the Poder Judicial de la Nación portal.
 * These represent different courts and federal jurisdictions in Argentina.
 * 
 * IMPORTANT: Format conventions:
 * - Portal format (raw): "FRE 3852/2020/TO2" (space-separated)
 * - Storage format (normalized): "FRE-3852/2020/TO2" (hyphen-separated)
 * 
 * The scraper normalizes portal format → storage format.
 * The frontend uses storage format for display and input.
 */
export const PJN_JURISDICTIONS = [
  { code: "CSJ", name: "Corte Suprema de Justicia de la Nación" },
  { code: "CIV", name: "Cámara Nacional de Apelaciones en lo Civil" },
  { code: "CAF", name: "Cámara Nacional de Apelaciones en lo Contencioso Administrativo Federal" },
  { code: "CCF", name: "Cámara Nacional de Apelaciones en lo Civil y Comercial Federal" },
  { code: "CNE", name: "Cámara Nacional Electoral" },
  { code: "CSS", name: "Camara Federal de la Seguridad Social" },
  { code: "CPE", name: "Cámara Nacional de Apelaciones en lo Penal Económico" },
  { code: "CNT", name: "Cámara Nacional de Apelaciones del Trabajo" },
  { code: "CFP", name: "Camara Criminal y Correccional Federal" },
  { code: "CCC", name: "Camara Nacional de Apelaciones en lo Criminal y Correccional" },
  { code: "COM", name: "Camara Nacional de Apelaciones en lo Comercial" },
  { code: "CPF", name: "Camara Federal de Casación Penal" },
  { code: "CPN", name: "Camara Nacional Casacion Penal" },
  { code: "FBB", name: "Justicia Federal de Bahia Blanca" },
  { code: "FCR", name: "Justicia Federal de Comodoro Rivadavia" },
  { code: "FCB", name: "Justicia Federal de Córdoba" },
  { code: "FCT", name: "Justicia Federal de Corrientes" },
  { code: "FGR", name: "Justicia Federal de General Roca" },
  { code: "FLP", name: "Justicia Federal de La Plata" },
  { code: "FMP", name: "Justicia Federal de Mar del Plata" },
  { code: "FMZ", name: "Justicia Federal de Mendoza" },
  { code: "FPO", name: "Justicia Federal de Posadas" },
  { code: "FPA", name: "Justicia Federal de Paraná" },
  { code: "FRE", name: "Justicia Federal de Resistencia" },
  { code: "FSA", name: "Justicia Federal de Salta" },
  { code: "FRO", name: "Justicia Federal de Rosario" },
  { code: "FSM", name: "Justicia Federal de San Martin" },
  { code: "FTU", name: "Justicia Federal de Tucuman" },
] as const;

export type PjnJurisdictionCode = typeof PJN_JURISDICTIONS[number]["code"];

/**
 * All valid jurisdiction codes as an array of strings.
 */
export const JURISDICTION_CODES: string[] = PJN_JURISDICTIONS.map((j) => j.code);

/**
 * Regex pattern to match any jurisdiction code followed by the case identifier.
 * Format: JURISDICTION-NUMBER (e.g., "FRE-3852/2020/TO2", "CSJ-1234/2021")
 * 
 * Captures:
 * - Group 1: The jurisdiction code (e.g., "FRE")
 * - Group 2: The case number and suffixes (e.g., "3852/2020/TO2")
 */
export const FRE_PATTERN = new RegExp(
  `^(${JURISDICTION_CODES.join("|")})[-](.+)$`,
  "i"
);

/**
 * Validate and normalize an FRE identifier.
 * Ensures the format is JURISDICTION-NUMBER with uppercase jurisdiction.
 * 
 * @param fre - The FRE identifier to validate
 * @returns Normalized FRE or null if invalid format
 */
export function normalizeFreIdentifier(fre: string | undefined | null): string | null {
  if (!fre) return null;
  
  const trimmed = fre.trim();
  if (!trimmed) return null;
  
  const match = trimmed.match(FRE_PATTERN);
  if (match) {
    // Normalize: uppercase jurisdiction code
    return `${match[1].toUpperCase()}-${match[2]}`;
  }
  
  // If it doesn't match the pattern but looks like just a number, 
  // it's invalid (missing jurisdiction)
  return null;
}

/**
 * Parse an FRE identifier into its components.
 * 
 * @param fre - The FRE identifier to parse (e.g., "FRE-3852/2020/TO2")
 * @returns Object with jurisdiction and caseNumber, or null if invalid
 */
export function parseFreIdentifier(fre: string): {
  jurisdiction: PjnJurisdictionCode;
  caseNumber: string;
} | null {
  if (!fre) return null;
  
  const match = fre.trim().match(FRE_PATTERN);
  if (!match) return null;
  
  const jurisdiction = match[1].toUpperCase();
  if (!JURISDICTION_CODES.includes(jurisdiction)) {
    return null;
  }
  
  return {
    jurisdiction: jurisdiction as PjnJurisdictionCode,
    caseNumber: match[2],
  };
}

/**
 * Build an FRE identifier from jurisdiction and case number.
 * 
 * @param jurisdiction - The jurisdiction code (e.g., "FRE")
 * @param caseNumber - The case number (e.g., "3852/2020/TO2")
 * @returns The FRE identifier in format "FRE-3852/2020/TO2"
 */
export function buildFreIdentifier(
  jurisdiction: string,
  caseNumber: string
): string | null {
  if (!jurisdiction || !caseNumber) return null;
  
  const normalizedJurisdiction = jurisdiction.trim().toUpperCase();
  if (!JURISDICTION_CODES.includes(normalizedJurisdiction)) {
    return null;
  }
  
  return `${normalizedJurisdiction}-${caseNumber.trim()}`;
}

