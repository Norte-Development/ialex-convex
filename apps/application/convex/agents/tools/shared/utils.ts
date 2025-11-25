import { internal } from "../../../_generated/api";
import { Id } from "../../../_generated/dataModel";

/**
 * Extracts the `caseId` and `userId` from a thread user identifier.
 *
 * Expected formats:
 * - `"case:{caseId}_{userId}"` → returns both caseId and userId
 * - `"user:someUserId"` → treated as a raw userId (caseId will be `null`)
 *
 * @param threadUserId - The identifier of the thread user.
 *   - Format: `"case:{caseId}_{userId}"` (preferred)
 *   - Or just `"user:userId"` (fallback mode)
 *
 * @returns An object containing:
 *   - `caseId`: The extracted case ID (or `null` if fallback)
 *   - `userId`: The extracted user ID
 *
 * @throws Will throw an error if `threadUserId` is falsy or
 * if the formatted string is invalid (`case:` but missing ids).
 *
 * @example
 * ```ts
 * getUserAndCaseIds("case:1234_5678");
 * // { caseId: "1234", userId: "5678" }
 *
 * getUserAndCaseIds("user:5678");
 * // { caseId: null, userId: "5678" }
 * ```
 */
export const getUserAndCaseIds = (
    threadUserId: string
  ): { caseId: string | null; userId: string } => {
    if (!threadUserId) {
      throw new Error("Not authenticated");
    }
  
    const CASE_PREFIX = "case:";
  
    if (threadUserId.startsWith(CASE_PREFIX)) {
      // Extract substring after "case:"
      const payload = threadUserId.slice(CASE_PREFIX.length);
      const [caseId, userId] = payload.split("_");
  
      if (!caseId || !userId) {
        throw new Error(
          `Invalid threadUserId format. Expected "case:{caseId}_{userId}", got "${threadUserId}"`
        );
      }
  
      return { caseId, userId };
    }
  
    // Fallback: treat as just userId
    return { caseId: null, userId: threadUserId.replace("user:", "") };
  };

/**
 * Creates a standardized error response object for agent tools.
 * All tools should return this format instead of throwing errors.
 *
 * @param message - The error message explaining what went wrong
 * @returns An error object with a consistent structure
 *
 * @example
 * ```ts
 * return createErrorResponse("Document not found");
 * // Returns: { error: "Document not found" }
 * ```
 */
export const createErrorResponse = (message: string): string => {
  return `# ❌ Error

## Problema Encontrado
${message}

Por favor, verifica los parámetros proporcionados e intenta nuevamente.`;
};

/**
 * Validates that a string parameter is not empty and returns an error response if invalid.
 *
 * @param value - The value to validate
 * @param paramName - The name of the parameter for error messages
 * @returns Error response if invalid, null if valid
 *
 * @example
 * ```ts
 * const error = validateStringParam(args.documentId, "documentId");
 * if (error) return error;
 * ```
 */
export const validateStringParam = (value: any, paramName: string): string | null => {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    return createErrorResponse(`Parámetro inválido ${paramName}: debe ser una cadena de texto no vacía`);
  }
  return null;
};

/**
 * Validates that a number parameter is within a specified range.
 *
 * @param value - The value to validate
 * @param paramName - The name of the parameter for error messages
 * @param min - Minimum allowed value (inclusive)
 * @param max - Maximum allowed value (inclusive)
 * @param defaultValue - Default value to use if undefined
 * @returns Error response if invalid, null if valid
 *
 * @example
 * ```ts
 * const error = validateNumberParam(args.limit, "limit", 1, 50, 10);
 * if (error) return error;
 * ```
 */
export const validateNumberParam = (
  value: any, 
  paramName: string, 
  min: number, 
  max: number, 
  defaultValue?: number
): string | null => {
  if (value === undefined && defaultValue !== undefined) {
    return null; // Will use default value
  }
  
  if (typeof value !== 'number' || value < min || value > max) {
    return createErrorResponse(`Parámetro inválido ${paramName}: debe ser un número entre ${min} y ${max}`);
  }
  return null;
};

/**
 * Calculates the Levenshtein distance between two strings.
 * Used for fuzzy matching truncated IDs where characters might be missing from the middle.
 * 
 * @param a - First string
 * @param b - Second string
 * @returns The edit distance (number of insertions, deletions, or substitutions)
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Validates and potentially corrects a truncated Convex ID
 * by searching for matching IDs in the case.
 * 
 * Convex IDs are typically 32 characters long. If an ID is shorter than 30 characters,
 * it's likely truncated and we attempt to find the correct ID by searching escritos
 * in the case that start with the provided prefix or fuzzy match the string.
 * 
 * @param ctx - The tool context
 * @param escritoId - The potentially truncated escrito ID
 * @param caseId - The case ID to search within
 * @returns Object with the corrected ID and whether it was corrected
 * 
 * @example
 * ```ts
 * const { id, wasCorrected } = await validateAndCorrectEscritoId(ctx, "m570hstszctgcx37gp9b", caseId);
 * if (wasCorrected) {
 *   console.log(`Auto-corrected ID: ${id}`);
 * }
 * ```
 */
export async function validateAndCorrectEscritoId(
  ctx: any,
  escritoId: string,
  caseId: string | null
): Promise<{ id: string; wasCorrected: boolean }> {
  // Convex IDs are typically 32 characters
  // If the ID is 30+ characters, it's likely complete
  if (escritoId.length >= 30) {
    return { id: escritoId, wasCorrected: false };
  }
  
  // ID appears truncated, try to find the correct one
  console.log(`⚠️ Potentially truncated escritoId detected: "${escritoId}" (length: ${escritoId.length})`);
  
  if (!caseId) {
    console.log("⚠️ No caseId available for auto-correction");
    return { id: escritoId, wasCorrected: false };
  }
  
  try {
    // Query escritos in the case
    // We fetch all IDs for the case to perform in-memory fuzzy matching
    // This is efficient because the number of escritos per case is typically small (<100)
    const escritos = await ctx.runQuery(
      internal.functions.documents.getEscritosForAgent,
      { caseId: caseId as Id<"cases"> }
    );
    
    // 1. Exact match check (just in case)
    const exactMatch = escritos.find((e: any) => e._id === escritoId);
    if (exactMatch) {
      return { id: escritoId, wasCorrected: false };
    }
    
    // 2. Prefix match check (fastest fallback)
    let matches = escritos.filter((e: any) => e._id.startsWith(escritoId));
    
    // 3. Fuzzy match check (Levenshtein) if prefix fails
    // This handles "middle-out" truncation (e.g. "abcdef...xyz") which simple prefix/suffix checks miss
    if (matches.length === 0) {
      // Only attempt fuzzy match if we have a substantial part of the ID (>20 chars)
      // to avoid false positives with very short strings
      if (escritoId.length > 20) {
        // Allow up to 5 edits (deletions/substitutions)
        // e.g. 29 chars vs 32 chars = 3 deletions -> allowed
        const MAX_DISTANCE = 5;
        
        matches = escritos.filter((e: any) => {
          const dist = levenshteinDistance(escritoId, e._id);
          return dist <= MAX_DISTANCE;
        });
        
        if (matches.length > 0) {
          console.log(`⚠️ Fuzzy match found using Levenshtein distance`);
        }
      }
    }
    
    if (matches.length === 1) {
      // Perfect! Only one match, use it
      const correctedId = matches[0]._id;
      console.log(`✅ Auto-corrected truncated ID: "${escritoId}" -> "${correctedId}"`);
      return { id: correctedId, wasCorrected: true };
    } else if (matches.length > 1) {
      // Multiple matches - prefer the most recently edited one
      const sortedMatches = matches.sort((a: any, b: any) => 
        (b.lastEditedAt || b._creationTime) - (a.lastEditedAt || a._creationTime)
      );
      const correctedId = sortedMatches[0]._id;
      console.log(`✅ Auto-corrected truncated ID (${matches.length} matches, using most recent): "${escritoId}" -> "${correctedId}"`);
      return { id: correctedId, wasCorrected: true };
    } else {
      // No matches found
      console.log(`⚠️ No matching escrito found for truncated ID: "${escritoId}"`);
      return { id: escritoId, wasCorrected: false };
    }
  } catch (error) {
    console.error("Error during ID auto-correction:", error);
    return { id: escritoId, wasCorrected: false };
  }
}