import { createTool, ToolCtx } from "@convex-dev/agent";
import { internal } from "../../../_generated/api";
import { z } from "zod";
import { prosemirrorSync } from "../../../prosemirror";
import { buildServerSchema } from "../../../../../../packages/shared/src/tiptap/schema";
import { Node } from "@tiptap/pm/model";
import { Id } from "../../../_generated/dataModel";
import {
  getUserAndCaseIds,
  createErrorResponse,
  validateStringParam,
  validateNumberParam,
  validateAndCorrectEscritoId,
} from "../shared/utils";
import { createEscritoNotFoundTemplate } from "./templates";

/**
 * Metadata describing a semantic chunk of document content.
 * 
 * Chunks are created based on document structure and content boundaries
 * to maintain semantic coherence while respecting size limits.
  */
export interface ChunkMetadata {
  /** Zero-based index of this chunk within the document */
  chunkIndex: number;
  /** Starting position of the chunk in the document */
  startPos: number;
  /** Ending position of the chunk in the document */
  endPos: number;
  /** Hierarchical path to this chunk's section (e.g., ["Chapter 1", "Section A", "Subsection 1"]) */
  sectionPath: string[];
  /** Array of node types contained in this chunk (e.g., ["heading", "paragraph", "list"]) */
  nodeTypes: string[];
  /** Whether this chunk contains structural boundaries like headings or major sections */
  hasStructuralBoundary: boolean;
}

/**
 * A processed chunk containing both metadata and extracted content.
 * 
 * Extends ChunkMetadata with the actual text content and processing information.
 */
export interface ProcessedChunk extends ChunkMetadata {
  /** The full text content of this chunk */
  text: string;
  /** A preview/summary of the chunk content (typically first sentence or truncated text) */
  preview: string;
  /** Word count for this chunk */
  wordCount: number;
  /** Indicates if chunk was truncated due to size limits */
  hasMore: boolean;
}

/**
 * Represents a single document node with its content and structural information.
 * 
 * Used for traversing and analyzing ProseMirror document structure.
 */
export interface DocumentNode {
  /** The type of the node (e.g., "heading", "paragraph", "list_item") */
  type: string;
  /** The text content of the node */
  text: string;
  /** The position of the node within the document */
  pos: number;
  /** The heading level (only applicable for heading nodes) */
  level?: number;
  /** Whether this node represents a structural boundary in the document */
  isStructuralBoundary: boolean;
  /** Change type for custom change nodes (e.g., "added", "deleted", "modified") */
  changeType?: string;
  /** Unique identifier for the change (for custom change nodes) */
  changeId?: string;
  /** Semantic type of the change (for custom change nodes) */
  semanticType?: string;
}
  
/**
 * Recursively extracts visible text from a ProseMirror node, excluding content
 * inside change nodes marked as deleted and converting added line breaks to newlines.
 */
function extractVisibleTextFromNode(node: Node): string {
  // Text node: return its text
  if (node.type.name === "text") {
    // @ts-ignore - text is only present on text nodes
    return (node as any).text ?? node.textContent ?? "";
  }

  // Handle custom change nodes explicitly
  if (node.type.name === "inlineChange" || node.type.name === "blockChange") {
    const changeType = (node as any).attrs?.changeType;
    if (changeType === "deleted") {
      return ""; // Exclude deleted content from reads to avoid loops
    }
    // For added/modified, include inner visible text
    let combined = "";
    for (let i = 0; i < node.childCount; i++) {
      combined += extractVisibleTextFromNode(node.child(i));
    }
    return combined;
  }

  if (node.type.name === "lineBreakChange") {
    const changeType = (node as any).attrs?.changeType;
    return changeType === "deleted" ? "" : "\n";
  }

  // Hard break nodes should render as newline
  if (node.type.name === "hardBreak") {
    return "\n";
  }

  // Generic container: concatenate children
  if (node.childCount > 0) {
    let out = "";
    for (let i = 0; i < node.childCount; i++) {
      out += extractVisibleTextFromNode(node.child(i));
    }
    return out;
  }

  // Fallback to textContent
  return (node as any).textContent ?? "";
}

/**
 * Maximum number of words allowed per chunk to maintain manageable chunk sizes.
 * 
 * This constant is used to determine when to split content into separate chunks
 * while preserving semantic boundaries.
 */
const MAX_WORDS_PER_CHUNK = 300;

/**
 * Build a flat index of text runs in the document for position-based mapping.
 * Each run corresponds to a ProseMirror text node with absolute positions.
 */
function buildTextRuns(doc: Node): Array<{ text: string; from: number; to: number }> {
  const runs: Array<{ text: string; from: number; to: number }> = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "text") {
      const text = (node as any).text || "";
      const size = (node as any).nodeSize ?? text.length;
      runs.push({ text, from: pos, to: pos + size });
      return false;
    }
    return true;
  });
  return runs;
}

function findNthOccurrence(haystack: string, needle: string, n: number): number {
  if (!needle) return -1;
  let idx = -1;
  for (let i = 0; i < n; i++) {
    idx = haystack.indexOf(needle, idx + 1);
    if (idx === -1) return -1;
  }
  return idx;
}

/**
 * Locate document positions based on simple textual anchors within single text runs.
 * Returns best-effort PM positions for afterText end and beforeText start.
 */
function findAnchorPositions(
  doc: Node,
  opts: { afterText?: string; beforeText?: string; occurrenceIndex?: number }
): { from?: number; to?: number } {
  const occurrence = Math.max(1, opts.occurrenceIndex ?? 1);
  const runs = buildTextRuns(doc);
  const result: { from?: number; to?: number } = {};

  if (opts.afterText) {
    let count = 0;
    for (const run of runs) {
      const local = findNthOccurrence(run.text, opts.afterText, 1);
      if (local !== -1) {
        count += 1;
        if (count === occurrence) {
          result.from = run.from + local + opts.afterText.length;
          break;
        }
      }
    }
  }

  if (opts.beforeText) {
    let count = 0;
    for (const run of runs) {
      const local = findNthOccurrence(run.text, opts.beforeText, 1);
      if (local !== -1) {
        count += 1;
        if (count === occurrence) {
          result.to = run.from + local;
          break;
        }
      }
    }
  }

  return result;
}

function safeBounds(doc: Node, from?: number, to?: number): { from: number; to: number } {
  const min = 0;
  const max = doc.content.size;
  const f = Math.max(min, Math.min(max, from ?? 0));
  const t = Math.max(f, Math.min(max, to ?? max));
  return { from: f, to: t };
}

function getTextBetween(doc: Node, from: number, to: number): string {
  return (doc as any).textBetween(from, to, "\n\n");
}

function getJsonSlice(doc: Node, from: number, to: number): any {
  const sliced = (doc as any).cut(from, to);
  return sliced.toJSON();
}

/**
 * Generates a hierarchical outline of an Escrito document.
 * 
 * This function creates an outline by extracting headings and paragraphs from the document,
 * mapping them to their respective chunks, and providing structural information.
 * 
 * @param doc - The ProseMirror document node to analyze
 * @returns Array of outline items containing text, position, chunk information, and metadata
 * 
 * @example
 * ```typescript
 * const outline = getEscritoOutline(proseMirrorDoc);
 * outline.forEach(item => {
 *   console.log(`${item.type}: ${item.text} (Chunk ${item.chunkIndex})`);
 * });
 * ```
 */
export const getEscritoOutline = (doc: Node) => {
    // First, get the actual document nodes and chunk metadata
    const documentNodes = extractDocumentNodes(doc);
    const chunkMetadata = createSemanticChunks(documentNodes);
    
    const outline: { 
        text: string, 
        pos: number, 
        chunkIndex: number, 
        totalChunks: number, 
        type: string,
        nodeIndex: number,
        inChunkPosition: number 
    }[] = [];
    
    // Map each node to its actual chunk
    documentNodes.forEach((node, nodeIndex) => {
        // Find which chunk this node belongs to
        const belongsToChunk = chunkMetadata.findIndex(chunk => 
            node.pos >= chunk.startPos && node.pos <= chunk.endPos
        );
        
        // Find position within the chunk
        const chunkNodes = documentNodes.filter(n => {
            const chunk = chunkMetadata[belongsToChunk];
            return chunk && n.pos >= chunk.startPos && n.pos <= chunk.endPos;
        });
        const inChunkPosition = chunkNodes.findIndex(n => n.pos === node.pos);
        
        // Only include headings and paragraphs in outline
        if (node.type === "heading" || node.type === "paragraph") {
            const text = node.type === "heading" ? node.text : node.text.slice(0, 100);
            if (text.length > 0) {
                outline.push({
                    text,
                    pos: node.pos,
                    chunkIndex: belongsToChunk >= 0 ? belongsToChunk : -1, // -1 if not found in any chunk
                    totalChunks: chunkMetadata.length,
                    type: node.type,
                    nodeIndex,
                    inChunkPosition: inChunkPosition >= 0 ? inChunkPosition : -1
                });
            }
        }
    });

    return outline;
}



/**
 * Extracts all relevant text nodes from a ProseMirror document with proper tree traversal.
 * 
 * This function traverses the document tree and extracts nodes that contain meaningful
 * text content, including headings, paragraphs, list items, table cells, and code blocks.
 * It maintains section context by tracking heading hierarchy and marks structural boundaries.
 * 
 * @param doc - The ProseMirror document node to extract nodes from
 * @returns Array of DocumentNode objects containing text content and structural information
 * 
 * @example
 * ```typescript
 * const nodes = extractDocumentNodes(proseMirrorDoc);
 * nodes.forEach(node => {
 *   console.log(`${node.type}: ${node.text} (pos: ${node.pos})`);
 * });
 * ```
 */
export function extractDocumentNodes(doc: Node): DocumentNode[] {
  const nodes: DocumentNode[] = [];
  const sectionStack: string[] = [];
  
  doc.descendants((node, pos) => {
    // Handle headings - update section context
    if (node.type.name === "heading") {
      const level = node.attrs?.level || 1;
      const headingText = extractVisibleTextFromNode(node).trim();
      
      if (headingText) {
        // Update section stack based on heading level
        sectionStack.splice(level - 1);
        sectionStack[level - 1] = headingText;
        
        nodes.push({
          type: "heading",
          text: headingText,
          pos,
          level,
          isStructuralBoundary: true,
        });
      }
      return false; // Already extracted visible text from heading subtree
    }

    // Handle standard block/leaf content nodes – compute visible text excluding deleted changes
    if (["paragraph", "listItem", "blockquote", "codeBlock", "tableCell"].includes(node.type.name)) {
      const text = extractVisibleTextFromNode(node).trim();
      if (text) {
        nodes.push({
          type: node.type.name,
          text,
          pos,
          isStructuralBoundary: node.type.name === "codeBlock",
        });
      }
      return false; // Don't traverse into these nodes' children
    }

    // Handle custom change nodes
    if (["inlineChange", "blockChange", "lineBreakChange"].includes(node.type.name)) {
      const changeType = (node as any).attrs?.changeType;
      if (changeType === "deleted") {
        return false; // Skip deleted changes entirely (and their children)
      }
      return true; // Traverse into children so underlying paragraphs/headings are processed normally
    }

    // Handle lists and tables as structural boundaries
    if (["bulletList", "orderedList", "table"].includes(node.type.name)) {
      return true; // Traverse children but mark as structural
    }

    return true; // Continue traversing
  });

  return nodes;
}

/**
 * Generates semantic-aware chunks from document nodes.
 * 
 * This function creates chunks that respect document structure and semantic boundaries
 * while maintaining size limits. It prioritizes keeping related content together and
 * breaks at natural boundaries like major headings or structural elements.
 * 
 * @param nodes - Array of DocumentNode objects to chunk
 * @returns Array of ChunkMetadata objects describing the semantic chunks
 * 
 * @example
 * ```typescript
 * const nodes = extractDocumentNodes(doc);
 * const chunks = createSemanticChunks(nodes);
 * chunks.forEach(chunk => {
 *   console.log(`Chunk ${chunk.chunkIndex}: ${chunk.sectionPath.join(' > ')}`);
 * });
 * ```
 */
export function createSemanticChunks(nodes: DocumentNode[]): ChunkMetadata[] {
  
  const chunks: ChunkMetadata[] = [];
  let currentChunk: {
    nodes: DocumentNode[];
    wordCount: number;
    startPos: number;
    endPos: number;
    sectionPath: string[];
    nodeTypes: Set<string>;
  } | null = null;

  const sectionStack: string[] = [];

  const flushChunk = () => {
    if (!currentChunk || currentChunk.nodes.length === 0) {
      return;
    }

    chunks.push({
      chunkIndex: chunks.length,
      startPos: currentChunk.startPos,
      endPos: currentChunk.endPos,
      sectionPath: [...currentChunk.sectionPath].filter(section => section !== undefined),
      nodeTypes: Array.from(currentChunk.nodeTypes),
      hasStructuralBoundary: currentChunk.nodes.some(n => n.isStructuralBoundary),
    });

    currentChunk = null;
  };

  for (const node of nodes) {
    // Update section context for headings
    if (node.type === "heading" && node.level) {
      sectionStack.splice(node.level - 1);
      sectionStack[node.level - 1] = node.text;
      
      // Flush current chunk at major structural boundaries
      if (node.level <= 2) {
        flushChunk();
      }
    }

    const nodeWordCount = node.text.split(/\s+/).filter(word => word.length > 0).length;

    // Initialize new chunk if needed
    if (!currentChunk) {
      currentChunk = {
        nodes: [],
        wordCount: 0,
        startPos: node.pos,
        endPos: node.pos,
        sectionPath: [...sectionStack].filter(section => section !== undefined),
        nodeTypes: new Set(),
      };
    }

    // Check if adding this node would exceed chunk size
    const wouldExceed = currentChunk.wordCount + nodeWordCount > MAX_WORDS_PER_CHUNK;
    const hasContent = currentChunk.nodes.length > 0;

    // Flush if we would exceed size and have content, unless it's a structural boundary
    if (wouldExceed && hasContent && !node.isStructuralBoundary) {
      flushChunk();
      
      // Start new chunk
      currentChunk = {
        nodes: [],
        wordCount: 0,
        startPos: node.pos,
        endPos: node.pos,
        sectionPath: [...sectionStack].filter(section => section !== undefined),
        nodeTypes: new Set(),
      };
    }

    // Add node to current chunk
    currentChunk.nodes.push(node);
    currentChunk.wordCount += nodeWordCount;
    currentChunk.endPos = node.pos;
    currentChunk.nodeTypes.add(node.type);
  }

  // Flush final chunk
  flushChunk();

  return chunks;
}

/**
 * Generates a preview text for a chunk by extracting the first complete sentence or truncating at word boundaries.
 * 
 * This function attempts to create a meaningful preview by first trying to extract
 * a complete sentence, and if that's too long, it falls back to truncating at word
 * boundaries while staying within the character limit.
 * 
 * @param text - The full text content to generate a preview from
 * @returns A preview string, typically the first sentence or truncated text with ellipsis
 * 
 * @example
 * ```typescript
 * const preview = generateChunkPreview("This is a long paragraph with multiple sentences. It continues here.");
 * console.log(preview); // "This is a long paragraph with multiple sentences."
 * ```
 */
export function generateChunkPreview(text: string): string {
  // Try to get first complete sentence
  const sentences = text.split(/(?<=[.!?])\s+/);
  const firstSentence = sentences[0]?.trim();
  
  if (firstSentence && firstSentence.length <= 120) {
    return firstSentence;
  }
  
  // Fallback to word boundary
  const words = text.split(/\s+/);
  let preview = "";
  for (const word of words) {
    if ((preview + " " + word).length > 120) break;
    preview += (preview ? " " : "") + word;
  }
  
  return preview + (preview.length < text.length ? "..." : "");
}

// ---- New reading primitives ----

export function getTextSelection(doc: Node, from: number, to: number) {
  const b = safeBounds(doc, from, to);
  const text = getTextBetween(doc, b.from, b.to);
  return { text, from: b.from, to: b.to, length: text.length };
}

export function getJsonSelection(doc: Node, from: number, to: number) {
  const b = safeBounds(doc, from, to);
  const json = getJsonSlice(doc, b.from, b.to);
  return { json, from: b.from, to: b.to };
}

export function getTextRange(
  doc: Node,
  args: { from?: number; to?: number; afterText?: string; beforeText?: string; occurrenceIndex?: number }
) {
  const anchors = findAnchorPositions(doc, {
    afterText: args.afterText,
    beforeText: args.beforeText,
    occurrenceIndex: args.occurrenceIndex,
  });
  const b = safeBounds(doc, args.from ?? anchors.from, args.to ?? anchors.to);
  const text = getTextBetween(doc, b.from, b.to);
  return { text, from: b.from, to: b.to, length: text.length };
}

export function getJsonRange(
  doc: Node,
  args: { from?: number; to?: number; afterText?: string; beforeText?: string; occurrenceIndex?: number }
) {
  const anchors = findAnchorPositions(doc, {
    afterText: args.afterText,
    beforeText: args.beforeText,
    occurrenceIndex: args.occurrenceIndex,
  });
  const b = safeBounds(doc, args.from ?? anchors.from, args.to ?? anchors.to);
  const json = getJsonSlice(doc, b.from, b.to);
  return { json, from: b.from, to: b.to };
}

type SizeUnit = "words" | "nodes";

function computeSizeChunks(doc: Node, unit: SizeUnit, chunkSize: number): Array<{ from: number; to: number; words: number; nodes: number }> {
  const chunks: Array<{ from: number; to: number; words: number; nodes: number }> = [];
  const nodes: Array<{ from: number; to: number; text: string }> = [];

  doc.descendants((n, pos) => {
    if (["paragraph", "heading", "blockquote", "codeBlock", "listItem", "tableCell"].includes(n.type.name)) {
      const from = pos;
      const to = pos + n.nodeSize;
      const text = extractVisibleTextFromNode(n);
      nodes.push({ from, to, text });
      return false;
    }
    return true;
  });

  let accFrom: number | null = null;
  let accTo: number | null = null;
  let accWords = 0;
  let accNodes = 0;

  const flush = () => {
    if (accFrom !== null && accTo !== null) {
      chunks.push({ from: accFrom, to: accTo, words: accWords, nodes: accNodes });
    }
    accFrom = accTo = null;
    accWords = 0;
    accNodes = 0;
  };

  for (const item of nodes) {
    const words = item.text.split(/\s+/).filter(Boolean).length;
    if (accFrom === null) accFrom = item.from;
    accTo = item.to;
    accWords += words;
    accNodes += 1;

    const reached = unit === "words" ? accWords >= chunkSize : accNodes >= chunkSize;
    if (reached) flush();
  }

  flush();
  return chunks;
}

export function getTextChunksBySize(
  doc: Node,
  opts: { unit: SizeUnit; chunkSize: number; chunkIndex: number; contextWindow?: number }
) {
  const ranges = computeSizeChunks(doc, opts.unit, opts.chunkSize);
  if (ranges.length === 0) return [] as any[];
  const idx = Math.min(opts.chunkIndex, ranges.length - 1);
  const start = Math.max(0, idx - (opts.contextWindow ?? 0));
  const end = Math.min(ranges.length, idx + (opts.contextWindow ?? 0) + 1);
  const out: Array<{ from: number; to: number; text: string; index: number; total: number }> = [];
  for (let i = start; i < end; i++) {
    const r = ranges[i];
    out.push({ from: r.from, to: r.to, text: getTextBetween(doc, r.from, r.to), index: i, total: ranges.length });
  }
  return out;
}

export function getJsonChunksBySize(
  doc: Node,
  opts: { unit: SizeUnit; chunkSize: number; chunkIndex: number; contextWindow?: number }
) {
  const ranges = computeSizeChunks(doc, opts.unit, opts.chunkSize);
  if (ranges.length === 0) return [] as any[];
  const idx = Math.min(opts.chunkIndex, ranges.length - 1);
  const start = Math.max(0, idx - (opts.contextWindow ?? 0));
  const end = Math.min(ranges.length, idx + (opts.contextWindow ?? 0) + 1);
  const out: Array<{ from: number; to: number; json: any; index: number; total: number }> = [];
  for (let i = start; i < end; i++) {
    const r = ranges[i];
    out.push({ from: r.from, to: r.to, json: getJsonSlice(doc, r.from, r.to), index: i, total: ranges.length });
  }
  return out;
}

/**
 * Retrieves document chunks by index with lazy evaluation and context window support.
 * 
 * This function allows retrieving specific chunks from a document along with surrounding
 * context. It handles out-of-bounds requests gracefully by falling back to the last
 * available chunk. The context window allows including adjacent chunks for better
 * understanding of the content.
 * 
 * @param doc - The ProseMirror document node to extract chunks from
 * @param chunkIndex - The zero-based index of the target chunk to retrieve
 * @param contextWindow - Number of chunks before and after the target chunk to include (default: 0)
 * @returns Array of ProcessedChunk objects containing the requested chunks with their content
 * 
 * @example
 * ```typescript
 * // Get a specific chunk
 * const chunks = getEscritoChunks(doc, 2);
 * 
 * // Get a chunk with context (previous and next chunk)
 * const chunksWithContext = getEscritoChunks(doc, 2, 1);
 * ```
 */
export function getEscritoChunks(
  doc: Node,
  chunkIndex: number,
  contextWindow: number = 0
): ProcessedChunk[] {
  // Extract document structure
  const documentNodes = extractDocumentNodes(doc);
  if (documentNodes.length === 0) {
    return [];
  }

  // Create chunk metadata efficiently
  const chunkMetadata = createSemanticChunks(documentNodes);
  
  if (chunkMetadata.length === 0) {
    return [];
  }

  // Check if requested chunk index is out of bounds
  if (chunkIndex >= chunkMetadata.length) {
    // Fallback: use the last chunk as the target
    const fallbackChunkIndex = chunkMetadata.length - 1;
    const start = Math.max(0, fallbackChunkIndex - contextWindow);
    const end = Math.min(chunkMetadata.length, fallbackChunkIndex + contextWindow + 1);
    
    // Process fallback range
    return processChunkRange(documentNodes, chunkMetadata, start, end);
  }

  // Calculate context window bounds for valid chunk index
  const start = Math.max(0, chunkIndex - contextWindow);
  const end = Math.min(chunkMetadata.length, chunkIndex + contextWindow + 1);

  const result = processChunkRange(documentNodes, chunkMetadata, start, end);
  console.log("result", result);
  return result;
  
  // // Process requested range
  // return result;
}

/**
 * Helper function to process a range of chunks and extract their content.
 * 
 * This internal function takes a range of chunk metadata and processes them into
 * full ProcessedChunk objects with text content, previews, and word counts.
 * 
 * @param documentNodes - Array of all document nodes
 * @param chunkMetadata - Array of chunk metadata objects
 * @param start - Starting index of the range to process (inclusive)
 * @param end - Ending index of the range to process (exclusive)
 * @returns Array of ProcessedChunk objects for the specified range
 * 
 * @internal
 */
function processChunkRange(
  documentNodes: DocumentNode[], 
  chunkMetadata: ChunkMetadata[], 
  start: number, 
  end: number
): ProcessedChunk[] {
  const resultChunks: ProcessedChunk[] = [];
  
  for (let i = start; i < end; i++) {
    const metadata = chunkMetadata[i];
    
    // Extract text for this chunk by finding nodes in position range
    const chunkNodes = documentNodes.filter(
      node => node.pos >= metadata.startPos && node.pos <= metadata.endPos
    );
    
    const textParts: string[] = [];
    for (const node of chunkNodes) {
      if (node.type === "heading") {
        textParts.push(node.text.toUpperCase());
      } else {
        textParts.push(node.text);
      }
    }
    
    const text = textParts.join("\n\n");
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
    const preview = generateChunkPreview(text);
    
    resultChunks.push({
      ...metadata,
      text,
      preview,
      wordCount,
      hasMore: wordCount >= MAX_WORDS_PER_CHUNK * 0.95, // Indicate if chunk is near size limit
    });
  }

  return resultChunks;
}


/**
 * Extracts the full text content of an Escrito document with proper structure preservation.
 * 
 * This function processes the entire document and returns the complete text content
 * along with structural information and word count. Headings are formatted in uppercase
 * to maintain visual hierarchy in the plain text output.
 * 
 * @param doc - The ProseMirror document node to extract full text from
 * @returns Object containing the full text, word count, and structural outline
 * 
 * @example
 * ```typescript
 * const fullDoc = getFullEscrito(proseMirrorDoc);
 * console.log(`Document has ${fullDoc.wordCount} words`);
 * console.log('Structure:', fullDoc.structure);
 * ```
 */
export const getFullEscrito = (doc: Node): { text: string; wordCount: number; structure: string[] } => {
  const documentNodes = extractDocumentNodes(doc);
  const textParts: string[] = [];
  const structure: string[] = [];
  
  for (const node of documentNodes) {
    if (node.type === "heading") {
      const headingText = node.text.toUpperCase();
      textParts.push(headingText);
      structure.push(`H${node.level || 1}: ${node.text}`);
    } else {
      textParts.push(node.text);
    }
  }
  
  const fullText = textParts.join("\n\n");
  const wordCount = fullText.split(/\s+/).filter(word => word.length > 0).length;

  console.log("fullText", fullText);
  
  return {
    text: fullText,
    wordCount,
    structure,
  };
}

/**
 * Tool for reading and analyzing Escrito documents with various operations.
 * 
 * This tool provides three main operations for working with Escrito documents:
 * - "outline": Generates a hierarchical outline of the document structure
 * - "chunk": Retrieves specific chunks of content with optional context window
 * - "full": Extracts the complete document text with structure information
 * 
 * The tool is designed to handle large documents efficiently by providing
 * chunked access and semantic-aware content extraction.
 * 
 * @example
 * ```typescript
 * // Get document outline
 * const outline = await readEscritoTool.handler(ctx, { 
 *   escritoId: "k123...", 
 *   operation: "outline" 
 * });
 * 
 * // Get a specific chunk with context
 * const chunks = await readEscritoTool.handler(ctx, { 
 *   escritoId: "k123...", 
 *   operation: "chunk", 
 *   chunkIndex: 2, 
 *   contextWindow: 1 
 * });
 * 
 * // Get full document
 * const fullDoc = await readEscritoTool.handler(ctx, { 
 *   escritoId: "k123...", 
 *   operation: "full" 
 * });
 * ``` */
const readEscritoTool = createTool({
  description: "Read an Escrito from the case. Use this tool to review escrito content before editing, verify changes after editing, or understand the current state of the document. Supports multiple read operations: 'outline' for structure, 'chunk' for specific sections, 'full' for complete content, and range operations for specific text selections.",
  args: z.object({
    escritoId: z.any().describe("The Escrito ID (Convex doc id)"),
    operation: z.enum(["outline", "chunk", "full", "getTextSelection", "getJsonSelection", "getTextRange", "getJsonRange", "getTextChunks", "getJsonChunks"]).describe("Which read operation to perform"),
    // Existing chunking by semantic chunks
    chunkIndex: z.number().optional().describe("Semantic chunk index"),
    contextWindow: z.number().optional().describe("Chunks before/after to include"),
    // Selection by absolute positions
    from: z.number().optional().describe("Start position (absolute)"),
    to: z.number().optional().describe("End position (absolute)"),
    // Anchor-based ranges
    afterText: z.string().optional().describe("Anchor text after which the range starts"),
    beforeText: z.string().optional().describe("Anchor text before which the range ends"),
    occurrenceIndex: z.number().optional().describe("Occurrence index for anchors (1-based)"),
    // Chunking by size
    unit: z.enum(["words", "nodes"]).optional().describe("Size unit for chunking"),
    chunkSize: z.number().optional().describe("Size per chunk in unit"),
  }).required({escritoId: true}),
  handler: async (ctx: ToolCtx, args: any) => {
    try {
      const {caseId, userId} = getUserAndCaseIds(ctx.userId as string);
      
      await ctx.runQuery(internal.auth_utils.internalCheckNewCaseAccess,{
        userId: userId as Id<"users">,
        caseId: caseId as Id<"cases">,
        requiredLevel: "basic"
      } )

      const rawEscritoId = typeof args.escritoId === "string" ? args.escritoId.trim() : args.escritoId;
      const escritoIdError = validateStringParam(rawEscritoId, "escritoId");
      if (escritoIdError) return escritoIdError;

      const { id: correctedEscritoId, wasCorrected } = await validateAndCorrectEscritoId(
        ctx,
        rawEscritoId,
        caseId
      );
      if (wasCorrected) {
        console.log(`✅ Auto-corrected escritoId in readEscrito: ${rawEscritoId} -> ${correctedEscritoId}`);
      }

      const escrito = await ctx.runQuery(internal.functions.documents.internalGetEscrito, {
        escritoId: correctedEscritoId as any,
      });

      if (!escrito) {
        return createErrorResponse(createEscritoNotFoundTemplate(correctedEscritoId));
      }
      
      const doc = await prosemirrorSync.getDoc(ctx, escrito.prosemirrorId, buildServerSchema());
      switch (args.operation) {
        case "outline":
          return getEscritoOutline(doc.doc);
        case "chunk":
          return getEscritoChunks(doc.doc, args.chunkIndex, args.contextWindow);
        case "full":
          return getFullEscrito(doc.doc);
        case "getTextSelection":
          return getTextSelection(doc.doc, args.from, args.to);
        case "getJsonSelection":
          return getJsonSelection(doc.doc, args.from, args.to);
        case "getTextRange":
          return getTextRange(doc.doc, { from: args.from, to: args.to, afterText: args.afterText, beforeText: args.beforeText, occurrenceIndex: args.occurrenceIndex });
        case "getJsonRange":
          return getJsonRange(doc.doc, { from: args.from, to: args.to, afterText: args.afterText, beforeText: args.beforeText, occurrenceIndex: args.occurrenceIndex });
        case "getTextChunks":
          if (args.unit && args.chunkSize) {
            return getTextChunksBySize(doc.doc, { unit: args.unit, chunkSize: args.chunkSize, chunkIndex: args.chunkIndex ?? 0, contextWindow: args.contextWindow ?? 0 });
          }
          return getEscritoChunks(doc.doc, args.chunkIndex ?? 0, args.contextWindow ?? 0);
        case "getJsonChunks":
          if (args.unit && args.chunkSize) {
            return getJsonChunksBySize(doc.doc, { unit: args.unit, chunkSize: args.chunkSize, chunkIndex: args.chunkIndex ?? 0, contextWindow: args.contextWindow ?? 0 });
          }
          // Fallback: return semantic chunks as JSON slices
          const sem = getEscritoChunks(doc.doc, args.chunkIndex ?? 0, args.contextWindow ?? 0);
          return sem.map(ch => ({ from: ch.startPos, to: ch.endPos, json: getJsonSlice(doc.doc, ch.startPos, ch.endPos), index: ch.chunkIndex, total: sem.length }));
        default:
          return createErrorResponse(`Operación inválida: ${args.operation}`);
      }
    } catch (error) {
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }
} as any);

export { readEscritoTool };
