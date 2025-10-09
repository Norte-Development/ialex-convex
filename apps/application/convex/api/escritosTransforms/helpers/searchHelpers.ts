/**
 * Helpers for text search configuration
 */

/**
 * Decide whether to use whole-word matching based on search text characteristics
 */
export function isWholeWordLikely(searchText: string): boolean {
  if (!searchText) return false;
  if (searchText.includes(" ")) return false;
  if (searchText.length > 20) return false;
  if (/[.,;:]/.test(searchText)) return false;
  return true;
}

/**
 * Standard search options for precise matching
 */
export function getStandardSearchOptions(wholeWord = false) {
  return {
    caseInsensitive: false,
    normalizeWhitespace: false,
    unifyNbsp: false, // Preserve NBSP for whitespace-sensitive anchors
    removeSoftHyphen: true,
    removeZeroWidth: true,
    normalizeQuotesAndDashes: false, // Preserve original quotes/dashes
    unicodeForm: "NFC" as const,
    wholeWord,
  };
}

/**
 * Search options with context window for finding text with surrounding context
 */
export function getContextualSearchOptions(
  wholeWord = false,
  contextWindow = 80
) {
  return {
    ...getStandardSearchOptions(wholeWord),
    contextWindow,
  };
}
