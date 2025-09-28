// Export all editor functions
export * from "./read";

// Export types for external use
export type {
  HtmlChunk,
  Range,
  NodeRange,
} from "./types";

// Export validators for external use
export {
  HtmlChunkValidator,
  HtmlChunkArrayValidator,
  RangeValidator,
  NodeRangeValidator,
} from "./types";
