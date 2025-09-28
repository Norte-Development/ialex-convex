import { v } from "convex/values";

/**
 * Represents a range in the document with start and end positions.
 * Used for tracking character positions in the document.
 */
export type Range = {
  from: number;
  to: number;
};

/**
 * Represents a node range in the document with start and end node positions.
 * Used for tracking node-level positions in the ProseMirror document.
 */
export type NodeRange = {
  from: number;
  to: number;
};

/**
 * Represents a chunk of HTML content with associated range information.
 * Each chunk contains the HTML content and metadata about its position
 * in both character-level and node-level coordinates.
 */
export type HtmlChunk = {
  content: string;
  range: Range;
  nodeRange: NodeRange;
};

/**
 * Convex validator for Range type
 */
export const RangeValidator = v.object({
  from: v.number(),
  to: v.number(),
});

/**
 * Convex validator for NodeRange type
 */
export const NodeRangeValidator = v.object({
  from: v.number(),
  to: v.number(),
});

/**
 * Convex validator for HtmlChunk type
 */
export const HtmlChunkValidator = v.object({
  content: v.string(),
  range: RangeValidator,
  nodeRange: NodeRangeValidator,
});

/**
 * Convex validator for HtmlChunk array
 */
export const HtmlChunkArrayValidator = v.array(HtmlChunkValidator);
