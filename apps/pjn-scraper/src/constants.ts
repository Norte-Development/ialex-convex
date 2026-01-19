/**
 * PJN Jurisdiction codes from the Poder Judicial de la Nación portal.
 * These represent different courts and federal jurisdictions in Argentina.
 * 
 * IMPORTANT: Format conventions:
 * - Portal format (raw): "FRE 3852/2020/TO2" (space-separated)
 * - Storage format (normalized): "FRE-3852/2020/TO2" (hyphen-separated)
 * 
 * This file parses portal format and outputs storage format.
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
 * Example matches: "FRE 3852/2020/TO2", "CSJ 1234/2021", "CIV 5678/2019/CA1"
 * 
 * Captures:
 * - Group 1: The jurisdiction code (e.g., "FRE")
 * - Group 2: The case number and suffixes (e.g., "3852/2020/TO2")
 */
export const JURISDICTION_PATTERN = new RegExp(
  `^(${JURISDICTION_CODES.join("|")})\\s+(.+)$`,
  "i"
);

/**
 * Parse a claveExpediente string to extract jurisdiction and case number.
 * 
 * @param claveExpediente - The raw case key from PJN (e.g., "FRE 3852/2020/TO2")
 * @returns Object with jurisdiction code, case number, and full identifier, or null if invalid
 */
export function parseClaveExpediente(claveExpediente: string): {
  jurisdiction: string;
  caseNumber: string;
  fullIdentifier: string;
} | null {
  if (!claveExpediente) return null;
  
  const trimmed = claveExpediente.trim();
  const match = trimmed.match(JURISDICTION_PATTERN);
  
  if (match) {
    return {
      jurisdiction: match[1].toUpperCase(),
      caseNumber: match[2].trim(),
      fullIdentifier: `${match[1].toUpperCase()}-${match[2].trim()}`,
    };
  }
  
  // If no jurisdiction prefix found, return the whole string as the case number
  // This handles cases where the format might be different
  return null;
}

