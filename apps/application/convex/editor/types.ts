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


/**
 * The position where content will be inserted. Can be:
 * - Range: A range of the document
 * - number: A position in the document
 * - 'selection': Replace the current selection
 * - 'selectionStart': The start of the current selection
 * - 'selectionEnd': The end of the current selection
 * - 'document': Replace the entire document
 * - 'documentStart': The start of the document
 * - 'documentEnd': The end of the document
 */
export type InsertPosition = Range | number | 'document' | 'documentStart' | 'documentEnd';

/**
 * Convex validator for InsertPosition type
 */
export const InsertPositionValidator = v.union(
  RangeValidator,
  v.number(),
  v.literal('document'),
  v.literal('documentStart'),
  v.literal('documentEnd')
);

/**
 * Represents a single HTML diff operation with optional context anchoring.
 */
export type HtmlDiff = {
  context?: string;
  delete: string;
  insert: string;
};

/**
 * Convex validator for HtmlDiff type
 */
export const HtmlDiffValidator = v.object({
  context: v.optional(v.string()),
  delete: v.string(),
  insert: v.string(),
});

/**
 * Convex validator for HtmlDiff array
 */
export const HtmlDiffArrayValidator = v.array(HtmlDiffValidator);

/**
 * Options for configuring HTML diff application behavior.
 */
export type ApplyHtmlDiffOptions = {
  caseSensitive?: boolean;
  preferLastContext?: boolean;
  strict?: boolean; // if true and any diff can't be applied, make no change
};

/**
 * Convex validator for ApplyHtmlDiffOptions type
 */
export const ApplyHtmlDiffOptionsValidator = v.object({
  caseSensitive: v.optional(v.boolean()),
  preferLastContext: v.optional(v.boolean()),
  strict: v.optional(v.boolean()),
});
