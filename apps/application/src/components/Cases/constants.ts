/**
 * PJN Jurisdiction codes from the Poder Judicial de la Nación portal.
 * These represent different courts and federal jurisdictions in Argentina.
 * 
 * IMPORTANT: Format conventions:
 * - Portal format (raw): "FRE 3852/2020/TO2" (space-separated)
 * - Storage format (normalized): "FRE-3852/2020/TO2" (hyphen-separated)
 * 
 * The frontend uses storage format for display and stores JURISDICTION-NUMBER.
 */
export const JURISDICTIONS = [
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

export type JurisdictionCode = typeof JURISDICTIONS[number]["code"];

