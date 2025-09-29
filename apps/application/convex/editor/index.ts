'use node'
// Export all editor functions
export * from "./read";
export * from "./edit";

// Export types for external use
export type {
  HtmlChunk,
  Range,
  NodeRange,
  HtmlDiff,
  ApplyHtmlDiffOptions,
} from "./types";

// Export validators for external use
export {
  HtmlChunkValidator,
  HtmlChunkArrayValidator,
  RangeValidator,
  NodeRangeValidator,
  HtmlDiffValidator,
  HtmlDiffArrayValidator,
  ApplyHtmlDiffOptionsValidator,
} from "./types";

// Export utility functions for external use
export {
  extractTextFromNode,
  createProseMirrorChunks,
} from "./utils";
