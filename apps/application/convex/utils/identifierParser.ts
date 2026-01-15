/**
 * Identifier Parsing Utilities
 * 
 * Parses and normalizes Argentine personal identifiers (DNI, CUIT, CUIL)
 * from PJN I.E.J.P field values.
 */

// Document type classification
export type DocumentType = "DNI" | "CUIT" | "CUIL" | "PASSPORT" | "OTHER" | "UNKNOWN";

// Parsed identifier result
export interface ParsedIdentifier {
  type: DocumentType;
  number: string; // Normalized number (digits only)
  formatted: string; // Formatted for display
  raw: string; // Original input
  isValid: boolean;
}

/**
 * Normalize a string by removing common separators and whitespace.
 */
function normalizeDigits(input: string): string {
  return input.replace(/[-.\s]/g, "");
}

/**
 * Validate CUIT/CUIL checksum (modulo 11 algorithm)
 */
function validateCuitCuilChecksum(digits: string): boolean {
  if (digits.length !== 11) return false;
  
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i], 10) * weights[i];
  }
  
  const remainder = sum % 11;
  let checkDigit: number;
  
  if (remainder === 0) {
    checkDigit = 0;
  } else if (remainder === 1) {
    // Special case - check digit should be recalculated
    checkDigit = parseInt(digits[10], 10);
  } else {
    checkDigit = 11 - remainder;
  }
  
  return checkDigit === parseInt(digits[10], 10);
}

/**
 * Determine if a CUIT/CUIL prefix indicates CUIT vs CUIL.
 * - 20, 23, 24, 27: CUIL (individuals)
 * - 30, 33, 34: CUIT (companies)
 */
function getCuitCuilType(prefix: string): DocumentType {
  const individualPrefixes = ["20", "23", "24", "27"];
  const companyPrefixes = ["30", "33", "34"];
  
  if (individualPrefixes.includes(prefix)) {
    return "CUIL";
  } else if (companyPrefixes.includes(prefix)) {
    return "CUIT";
  }
  // Default to CUIT for unknown prefixes
  return "CUIT";
}

/**
 * Format a CUIT/CUIL number for display (XX-XXXXXXXX-X)
 */
function formatCuitCuil(digits: string): string {
  if (digits.length !== 11) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

/**
 * Format a DNI number for display (XX.XXX.XXX)
 */
function formatDni(digits: string): string {
  // Remove leading zeros for formatting
  const trimmed = digits.replace(/^0+/, "") || "0";
  
  // Format with dots as thousand separators
  const reversed = trimmed.split("").reverse();
  const groups: string[] = [];
  
  for (let i = 0; i < reversed.length; i += 3) {
    groups.push(reversed.slice(i, i + 3).reverse().join(""));
  }
  
  return groups.reverse().join(".");
}

/**
 * Parse an I.E.J.P field value into a structured identifier.
 * 
 * The I.E.J.P field from PJN can contain:
 * - DNI: 7-8 digit number (e.g., "12345678", "12.345.678")
 * - CUIT/CUIL: 11 digit number (e.g., "20-12345678-9", "20123456789")
 * - Sometimes with prefixes like "DNI:", "CUIT:", "LE:", "LC:"
 * - May be empty or contain "S/D" (sin datos)
 * 
 * @param iejpValue - The raw I.E.J.P value from PJN
 * @returns Parsed identifier with type and normalized number
 */
export function parseIejpValue(iejpValue: string | null | undefined): ParsedIdentifier {
  const raw = iejpValue?.trim() || "";
  
  // Handle empty or "no data" values
  if (!raw || raw.toLowerCase() === "s/d" || raw === "-") {
    return {
      type: "UNKNOWN",
      number: "",
      formatted: "",
      raw,
      isValid: false,
    };
  }
  
  // Check for explicit type prefixes
  const upperValue = raw.toUpperCase();
  let workingValue = raw;
  let explicitType: DocumentType | null = null;
  
  if (upperValue.startsWith("DNI:") || upperValue.startsWith("DNI ")) {
    explicitType = "DNI";
    workingValue = raw.slice(4).trim();
  } else if (upperValue.startsWith("CUIT:") || upperValue.startsWith("CUIT ")) {
    explicitType = "CUIT";
    workingValue = raw.slice(5).trim();
  } else if (upperValue.startsWith("CUIL:") || upperValue.startsWith("CUIL ")) {
    explicitType = "CUIL";
    workingValue = raw.slice(5).trim();
  } else if (upperValue.startsWith("LE:") || upperValue.startsWith("LE ")) {
    // Libreta de Enrolamiento - treat as DNI
    explicitType = "DNI";
    workingValue = raw.slice(3).trim();
  } else if (upperValue.startsWith("LC:") || upperValue.startsWith("LC ")) {
    // Libreta Cívica - treat as DNI
    explicitType = "DNI";
    workingValue = raw.slice(3).trim();
  } else if (upperValue.startsWith("PAS:") || upperValue.startsWith("PASAPORTE:")) {
    explicitType = "PASSPORT";
    workingValue = raw.replace(/^(PAS|PASAPORTE):?\s*/i, "").trim();
  }
  
  // Normalize the value to just digits
  const digits = normalizeDigits(workingValue);
  
  // If no digits found, return unknown
  if (!digits || !/^\d+$/.test(digits)) {
    return {
      type: explicitType || "UNKNOWN",
      number: "",
      formatted: raw,
      raw,
      isValid: false,
    };
  }
  
  // Determine type based on length if not explicitly specified
  if (digits.length === 11) {
    // CUIT/CUIL format
    const type = explicitType || getCuitCuilType(digits.slice(0, 2));
    const isValid = validateCuitCuilChecksum(digits);
    
    return {
      type,
      number: digits,
      formatted: formatCuitCuil(digits),
      raw,
      isValid,
    };
  } else if (digits.length >= 7 && digits.length <= 8) {
    // DNI format (7-8 digits)
    // Pad to 8 digits for consistency
    const paddedDigits = digits.padStart(8, "0");
    
    return {
      type: explicitType || "DNI",
      number: paddedDigits,
      formatted: formatDni(paddedDigits),
      raw,
      isValid: true,
    };
  } else if (explicitType === "PASSPORT") {
    // Passport - variable format
    return {
      type: "PASSPORT",
      number: digits,
      formatted: workingValue,
      raw,
      isValid: true,
    };
  }
  
  // Unknown format
  return {
    type: explicitType || "OTHER",
    number: digits,
    formatted: raw,
    raw,
    isValid: false,
  };
}

/**
 * Extract the I.E.J.P value from the combined details field.
 * The details field format is typically: "TOMO/FOLIO | I.E.J.P"
 * 
 * @param details - The combined details string from caseParticipants
 * @returns The extracted I.E.J.P value or null
 */
export function extractIejpFromDetails(details: string | null | undefined): string | null {
  if (!details) return null;
  
  // Split by the pipe separator
  const parts = details.split("|").map(p => p.trim());
  
  // The I.E.J.P is typically the last part (or second part if two parts)
  if (parts.length >= 2) {
    // Return the last non-empty part that looks like an identifier
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      if (part && part !== "-" && part.toLowerCase() !== "s/d") {
        // Check if it contains digits (likely an identifier)
        if (/\d/.test(part)) {
          return part;
        }
      }
    }
  }
  
  // If only one part or no valid identifier found, return the whole string if it has digits
  if (/\d/.test(details)) {
    return details;
  }
  
  return null;
}

/**
 * Normalize a name for comparison purposes.
 * - Removes common prefixes (DR., DRA., SR., SRA., etc.)
 * - Normalizes accents and special characters
 * - Converts to uppercase
 * - Normalizes whitespace
 */
export function normalizeName(name: string | null | undefined): string {
  if (!name) return "";
  
  let normalized = name.trim().toUpperCase();
  
  // Remove common prefixes
  const prefixes = [
    "DR.", "DRA.", "DR ", "DRA ",
    "SR.", "SRA.", "SR ", "SRA ",
    "LIC.", "LIC ",
    "ING.", "ING ",
    "ABG.", "ABG ",
    "ESTUDIO ",
  ];
  
  for (const prefix of prefixes) {
    if (normalized.startsWith(prefix)) {
      normalized = normalized.slice(prefix.length).trim();
    }
  }
  
  // Normalize accents
  normalized = normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  
  // Remove punctuation except spaces
  normalized = normalized.replace(/[^\w\s]/g, " ");
  
  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, " ").trim();
  
  return normalized;
}

/**
 * Calculate similarity between two strings using Jaro-Winkler algorithm.
 * Returns a value between 0 (no similarity) and 1 (identical).
 */
export function jaroWinklerSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);
  
  let matches = 0;
  let transpositions = 0;
  
  // Find matches
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);
    
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  
  if (matches === 0) return 0;
  
  // Count transpositions
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  
  // Jaro similarity
  const jaro = (
    matches / s1.length +
    matches / s2.length +
    (matches - transpositions / 2) / matches
  ) / 3;
  
  // Winkler modification (prefix bonus)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  
  return jaro + prefix * 0.1 * (1 - jaro);
}
