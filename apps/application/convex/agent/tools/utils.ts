/**
 * Extracts the `caseId` and `userId` from a thread user identifier.
 *
 * Expected formats:
 * - `"case:{caseId}_{userId}"` → returns both caseId and userId
 * - `"someUserId"` → treated as a raw userId (caseId will be `null`)
 *
 * @param threadUserId - The identifier of the thread user.
 *   - Format: `"case:{caseId}_{userId}"` (preferred)
 *   - Or just `"userId"` (fallback mode)
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
 * getUserAndCaseIds("5678");
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
    return { caseId: null, userId: threadUserId };
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
export const createErrorResponse = (message: string): { error: string } => {
  return { error: message };
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
export const validateStringParam = (value: any, paramName: string): { error: string } | null => {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    return createErrorResponse(`Invalid ${paramName}: must be a non-empty string`);
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
): { error: string } | null => {
  if (value === undefined && defaultValue !== undefined) {
    return null; // Will use default value
  }
  
  if (typeof value !== 'number' || value < min || value > max) {
    return createErrorResponse(`Invalid ${paramName}: must be a number between ${min} and ${max}`);
  }
  return null;
};