/**
 * Escrito Transform Operations
 * 
 * This module provides text-based editing operations for Escritos (legal documents).
 * All operations preserve change tracking through JSON diff merging.
 */

// Main operations
export { applyTextBasedOperations } from "./applyTextBasedOperations";
export { rewriteSectionByAnchors } from "./rewriteSectionByAnchors";
export { insertHtmlContent } from "./insertHtmlContent";

// Type validators (for use in other files)
export * from "./types";

// Helper functions (exported for testing and reuse)
export * from "./helpers/prosemirrorHelpers";
export * from "./helpers/searchHelpers";
export * from "./helpers/diffHelpers";
