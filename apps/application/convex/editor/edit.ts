'use node'

import { action, ActionCtx } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { prosemirrorSync } from "../prosemirror";
import { buildServerSchema, getServerExtensions } from "../../../../packages/shared/src/tiptap/schema";
import { generateJSON, generateHTML } from '@tiptap/html/server';
import { Node } from '@tiptap/pm/model';
import { Id } from "../_generated/dataModel";
import { 
  HtmlChunk, 
  HtmlChunkArrayValidator, 
  InsertPosition, 
  Range, 
  RangeValidator,
  HtmlDiff,
  HtmlDiffArrayValidator,
  ApplyHtmlDiffOptions,
  ApplyHtmlDiffOptionsValidator, 
  InsertPositionValidator
} from "./types";
import { extractTextFromNode, createProseMirrorChunks } from "./utils";
import { buildDocIndex, findMatches } from "../agent/normalizedSearch";
import { normalizeQuery } from "../agent/textNormalization";
import {
  createJsonDiff,
  buildContentWithJsonChanges,
} from "../../../../packages/shared/src/diff/jsonDiff";
import { EditorState, Transaction } from "@tiptap/pm/state";

// Helper function to validate and clean JSON nodes
const validateAndCleanNode = (node: any): any => {
  if (!node || typeof node !== 'object') {
    console.log('📝 validateAndCleanNode: Node is null/undefined or not object, returning paragraph');
    return { type: 'paragraph', content: [] };
  }
  
  // Ensure node has a type
  if (!node.type) {
    console.log('📝 validateAndCleanNode: Node missing type, defaulting to paragraph:', JSON.stringify(node, null, 2));
    return { type: 'paragraph', content: [] };
  }
  
  // Clean the node structure
  const cleanedNode: any = {
    type: node.type,
    attrs: node.attrs || {},
  };
  
  // Handle content
  if (Array.isArray(node.content)) {
    console.log(`📝 validateAndCleanNode: Processing ${node.content.length} children for node type: ${node.type}`);
    cleanedNode.content = node.content
      .map((child: any, index: number) => {
        if (!child || typeof child !== 'object') {
          console.log(`📝 validateAndCleanNode: Invalid child at index ${index}, skipping`);
          return null;
        }
        if (!child.type) {
          console.log(`📝 validateAndCleanNode: Child at index ${index} missing type, defaulting to paragraph:`, JSON.stringify(child, null, 2));
          return { type: 'paragraph', content: [] };
        }
        return validateAndCleanNode(child);
      })
      .filter((child: any) => child && child.type); // Remove any invalid children
    console.log(`📝 validateAndCleanNode: After cleaning, ${cleanedNode.content.length} valid children remain for node type: ${node.type}`);
  } else if (node.content) {
    // If content exists but isn't an array, try to handle it
    console.log('📝 validateAndCleanNode: Non-array content found, converting to array:', JSON.stringify(node.content, null, 2));
    cleanedNode.content = [validateAndCleanNode(node.content)];
  }
  
  // Handle text content
  if (node.text !== undefined) {
    cleanedNode.text = String(node.text || '');
  }
  
  // Handle marks for text nodes
  if (node.marks) {
    cleanedNode.marks = node.marks;
  }
  
  return cleanedNode;
};

/**
 * Convert HTML string to ProseMirror JSON structure
 */
function htmlToProseMirrorJson(html: string): any {
  console.log('🔄 htmlToProseMirrorJson: Converting HTML to ProseMirror JSON');
  try {
    const json = generateJSON(html, getServerExtensions());
    return validateAndCleanNode(json);
  } catch (error) {
    console.log('🔄 htmlToProseMirrorJson: ❌ HTML conversion failed, returning empty paragraph:', error);
    return {
      type: "paragraph",
      content: []
    };
  }
}


/**
 * Convert character position to ProseMirror document position
 */
function charPositionToDocPosition(doc: Node, charPos: number): number {
  let currentCharPos = 0;
  
  // Walk through the document to find the corresponding doc position
  const walk = (node: Node, nodeStartPos: number): number | null => {
    if (node.isText) {
      const textLength = node.text?.length || 0;
      if (currentCharPos <= charPos && charPos <= currentCharPos + textLength) {
        // The position is within this text node
        const offsetInNode = charPos - currentCharPos;
        return nodeStartPos + offsetInNode;
      }
      currentCharPos += textLength;
      return null;
    }
    
    // For non-text nodes, walk through children
    let pos = nodeStartPos + 1; // Start position inside the node
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      const result = walk(child, pos);
      if (result !== null) {
        return result;
      }
      pos += child.nodeSize;
    }
    
    return null;
  };
  
  const result = walk(doc, 0);
  return result !== null ? result : doc.content.size;
}

/**
 * Check if a node or any of its ancestors is a deleted change node
 */
function isNodeDeleted(node: Node, pos: number, doc: Node): boolean {
  // Check if current position is within a deleted change node
  let currentPos = pos;
  let found = false;
  
  doc.nodesBetween(0, doc.content.size, (testNode, testPos) => {
    // Check if this node contains our position and is a deleted change node
    if (testPos <= currentPos && currentPos < testPos + testNode.nodeSize) {
      if ((testNode.type.name === "inlineChange" || testNode.type.name === "blockChange") &&
          testNode.attrs?.changeType === "deleted") {
        found = true;
        return false; // Stop traversal
      }
    }
  });
  
  return found;
}

/**
 * Find HTML content range in ProseMirror document by converting to HTML and matching.
 * Used specifically for HTML content with block elements.
 */
function findHtmlRangeInDocument(
  doc: Node,
  searchHtml: string,
  opts: { caseSensitive?: boolean; startAfter?: number; contextBefore?: string; contextAfter?: string } = {}
): { from: number; to: number } | null {
  const startAfter = opts.startAfter ?? 0;
  
  console.log(`🔍 findHtmlRangeInDocument: Searching for HTML content after position ${startAfter}`);
  console.log(`🔍 findHtmlRangeInDocument: Search HTML: "${searchHtml}"`);
  
  try {
    // Convert the entire document to HTML for matching
    const docHtml = generateHTML(doc.toJSON(), getServerExtensions());
    console.log(`🔍 findHtmlRangeInDocument: Document HTML length: ${docHtml.length}`);
    
    // Clean and normalize the search HTML
    const cleanSearchHtml = searchHtml.trim();
    console.log(`🔍 findHtmlRangeInDocument: Clean search HTML: "${cleanSearchHtml}"`);
    
    // For HTML matching, we need to be more flexible
    // Try exact match first, then fallback to text content matching
    let searchIndex = -1;
    
    if (opts.caseSensitive === false) {
      searchIndex = docHtml.toLowerCase().indexOf(cleanSearchHtml.toLowerCase());
    } else {
      searchIndex = docHtml.indexOf(cleanSearchHtml);
    }
    
    if (searchIndex === -1) {
      console.log(`🔍 findHtmlRangeInDocument: Direct HTML match failed, trying text content approach`);
      
      // Fallback: extract text from the search HTML and search for that
      try {
        const searchJson = htmlToProseMirrorJson(cleanSearchHtml);
        const searchNode = buildServerSchema().nodeFromJSON(searchJson);
        const searchText = extractTextFromNode(searchNode);
        
        console.log(`🔍 findHtmlRangeInDocument: Extracted search text: "${searchText}"`);
        
        // Use the regular text search as fallback
        return findTextRangeInDocument(doc, searchText, opts);
      } catch (fallbackError) {
        console.log(`🔍 findHtmlRangeInDocument: Text fallback failed:`, fallbackError);
        return null;
      }
    }
    
    console.log(`🔍 findHtmlRangeInDocument: Found HTML match at character position ${searchIndex}`);
    
    // Convert HTML character position to ProseMirror document position
    // This is approximate since HTML and ProseMirror structure may differ
    const approximatePos = Math.floor(searchIndex * doc.content.size / docHtml.length);
    const endApproximatePos = Math.floor((searchIndex + cleanSearchHtml.length) * doc.content.size / docHtml.length);
    
    console.log(`🔍 findHtmlRangeInDocument: Approximate document positions: ${approximatePos}-${endApproximatePos}`);
    
    // Check if this position is after our required start position
    if (approximatePos >= startAfter) {
      return { from: approximatePos, to: endApproximatePos };
    }
    
    console.log(`🔍 findHtmlRangeInDocument: Match found before required position ${startAfter}`);
    return null;
    
  } catch (error) {
    console.log(`🔍 findHtmlRangeInDocument: HTML search failed:`, error);
    return null;
  }
}

/**
 * Find text range in ProseMirror document using the proven normalized search system.
 * This approach uses the same sophisticated search infrastructure as escritosTransforms.ts
 * that properly handles cross-node text search, normalization, and context matching.
 */
function findTextRangeInDocument(
    doc: Node,
    searchText: string,
    opts: { caseSensitive?: boolean; startAfter?: number; contextBefore?: string; contextAfter?: string } = {}
  ): { from: number; to: number } | null {
    const startAfter = opts.startAfter ?? 0;
    
    console.log(`🔍 findTextRangeInDocument: Searching for "${searchText}" after position ${startAfter} (enhanced HTML search)`);
    
    // Check if we're searching for HTML content
    const isHtmlSearch = /<[^>]+>/.test(searchText);
    console.log(`🔍 findTextRangeInDocument: HTML search mode: ${isHtmlSearch}`);
    
    if (isHtmlSearch) {
      // For HTML content, use HTML-aware matching
      return findHtmlRangeInDocument(doc, searchText, opts);
    }
    
    // For plain text, use the existing normalized search system
    // Build normalized document index with same options as escritosTransforms.ts
    const docIndex = buildDocIndex(doc, {
      caseInsensitive: !opts.caseSensitive,
      normalizeWhitespace: false,
      unifyNbsp: true,
      removeSoftHyphen: true,
      removeZeroWidth: true,
      normalizeQuotesAndDashes: true,
      unicodeForm: "NFC",
      wholeWord: false, // Don't use word boundaries for HTML diff matching
      contextBefore: opts.contextBefore,
      contextAfter: opts.contextAfter,
      contextWindow: 80,
    });
    
    // Check if delete text includes the context at the beginning
    let actualSearchText = searchText;
    let adjustedStartAfter = startAfter;
    
    if (opts.contextBefore && startAfter > 0) {
      // Normalize the context for comparison
      const normalizedContext = normalizeQuery(opts.contextBefore, {
        caseInsensitive: !opts.caseSensitive,
        normalizeWhitespace: false,
        unifyNbsp: true,
        removeSoftHyphen: true,
        removeZeroWidth: true,
        normalizeQuotesAndDashes: true,
        unicodeForm: "NFC",
      });
      
      const normalizedSearchText = normalizeQuery(searchText, {
        caseInsensitive: !opts.caseSensitive,
        normalizeWhitespace: false,
        unifyNbsp: true,
        removeSoftHyphen: true,
        removeZeroWidth: true,
        normalizeQuotesAndDashes: true,
        unicodeForm: "NFC",
      });
      
      // If delete text starts with context, search from beginning instead
      if (normalizedSearchText.startsWith(normalizedContext)) {
        console.log(`🔍 findTextRangeInDocument: Delete text includes context at beginning, searching from document start`);
        adjustedStartAfter = 0;
      }
    }
    
    // Find matches using the sophisticated search system
    const matches = findMatches(docIndex, actualSearchText, {
      caseInsensitive: !opts.caseSensitive,
      normalizeWhitespace: false,
      unifyNbsp: true,
      removeSoftHyphen: true,
      removeZeroWidth: true,
      normalizeQuotesAndDashes: true,
      unicodeForm: "NFC",
      wholeWord: false,
      contextBefore: opts.contextBefore,
      contextAfter: opts.contextAfter,
      contextWindow: 80,
    });
    
    console.log(`🔍 findTextRangeInDocument: Found ${matches.length} matches using normalized search`);
    
    if (matches.length === 0) {
      console.log(`🔍 findTextRangeInDocument: No matches found`);
      return null;
    }
    
    // Find first match after the required position (using adjusted position)
    for (const match of matches) {
      if (match.from >= adjustedStartAfter) {
        console.log(`🔍 findTextRangeInDocument: ✅ Found valid match at ${match.from}-${match.to} (after position ${adjustedStartAfter})`);
        return { from: match.from, to: match.to };
      }
    }
    
    // If searching after adjustedStartAfter failed and we have context, try a more flexible approach
    if (adjustedStartAfter > 0 && matches.length > 0) {
      console.log(`🔍 findTextRangeInDocument: No matches after position ${adjustedStartAfter}, trying fallback approaches`);
      
      // Fallback 1: Return the first match regardless of position (context may be misplaced)
      const firstMatch = matches[0];
      console.log(`🔍 findTextRangeInDocument: ✅ Using first available match at ${firstMatch.from}-${firstMatch.to} (fallback - ignoring position constraint)`);
      return { from: firstMatch.from, to: firstMatch.to };
    }
    
    console.log(`🔍 findTextRangeInDocument: All matches are before required position ${adjustedStartAfter}`);
    return null;
  }

/**
 * Normalize a diff string (HTML or plain text) for searching.
 * Preserves structure for HTML content while handling deleted change nodes.
 */
function normalizeDiffText(input: string, schema: any): string {
  try {
    // Check if input contains HTML tags
    const hasHtmlTags = /<[^>]+>/.test(input);
    
    if (!hasHtmlTags) {
      // Plain text - return as is
      console.log("🔎 normalizeDiffText: Plain text input, returning as-is");
      return input;
    }
    
    // For HTML content, we need to preserve more structure
    const json = htmlToProseMirrorJson(input);
    const node = schema.nodeFromJSON(json);
    
    // For block content, preserve basic HTML structure
    const contentAnalysis = analyzeHtmlContent(input, schema);
    if (contentAnalysis.type === "block") {
      console.log("🔎 normalizeDiffText: Block content detected, preserving HTML structure");
      // For block content, return the original HTML but clean it up
      return input.trim();
    }
    
    // For inline content, extract text but preserve formatting context
    console.log("🔎 normalizeDiffText: Inline/plain content, extracting text");
    return extractTextFromNode(node); // flatten to text, excluding deleted content
  } catch (e) {
    console.log("🔎 normalizeDiffText: fallback to raw string for", input);
    return input;
  }
}

/**
 * Analyze HTML content to determine its type: plain text, inline formatting, or block content
 */
function analyzeHtmlContent(html: string, schema: any): { type: "plain" | "inline" | "block"; hasMarks: boolean } {
  console.log(`🔍 analyzeHtmlContent: Analyzing "${html}"`);
  
  // Check if it's plain text (no HTML tags)
  if (!/<[^>]+>/.test(html)) {
    console.log(`🔍 analyzeHtmlContent: No HTML tags detected, returning plain`);
    return { type: "plain", hasMarks: false };
  }

  // Parse to see what elements we have
  try {
    const json = htmlToProseMirrorJson(html);
    console.log(`🔍 analyzeHtmlContent: Parsed JSON:`, JSON.stringify(json, null, 2));
    
    const node = schema.nodeFromJSON(json);
    console.log(`🔍 analyzeHtmlContent: Created node:`, {
      type: node.type?.name,
      isText: node.isText,
      content: node.content ? `${node.content.size} items` : 'none'
    });

    // Check if we have block-level elements
    const hasBlockElements = containsBlockElements(node);
    console.log(`🔍 analyzeHtmlContent: Has block elements: ${hasBlockElements}`);
    
    if (hasBlockElements) {
      return { type: "block", hasMarks: false };
    }

    // Check if we have mark elements (inline formatting)
    const hasMarks = containsMarks(node);
    console.log(`🔍 analyzeHtmlContent: Has marks: ${hasMarks}`);
    
    return { type: "inline", hasMarks };
  } catch (err) {
    console.log(`🔍 analyzeHtmlContent: Parsing failed:`, err);
    // If parsing fails, treat as plain text
    return { type: "plain", hasMarks: false };
  }
}

/**
 * Check if a node contains block-level elements
 */
function containsBlockElements(node: any): boolean {
  if (!node) return false;
  
  // Check if this node itself is a block (but not doc)
  if (node.type && node.type.name !== "doc" && node.type.name !== "text" && 
      (node.type.name === "paragraph" || node.type.name === "heading" || 
       node.type.name === "blockquote" || node.type.name === "codeBlock" ||
       node.type.name === "bulletList" || node.type.name === "orderedList" ||
       node.type.name === "listItem")) {
    return true;
  }

  // Recursively check children
  if (node.content && Array.isArray(node.content)) {
    return node.content.some((child: any) => containsBlockElements(child));
  }

  return false;
}

/**
 * Check if a node contains marks (inline formatting)
 */
function containsMarks(node: any): boolean {
  if (!node) {
    console.log(`🔍 containsMarks: Node is null/undefined`);
    return false;
  }
  
  // Handle both JSON nodes and ProseMirror nodes
  const isJsonNode = typeof node.type === 'string';
  const isProseMirrorNode = node.type && typeof node.type.name === 'string';
  
  console.log(`🔍 containsMarks: Checking node:`, {
    type: isProseMirrorNode ? node.type.name : node.type,
    isJsonNode,
    isProseMirrorNode,
    hasMarks: !!(node.marks && Array.isArray(node.marks) && node.marks.length > 0),
    marks: node.marks,
    hasJsonContent: !!(node.content && Array.isArray(node.content)),
    hasPmContent: !!(node.content && node.content.size !== undefined),
    contentSize: isProseMirrorNode ? node.content?.size : node.content?.length
  });
  
  // Check if this node has marks
  if (node.marks && Array.isArray(node.marks) && node.marks.length > 0) {
    console.log(`🔍 containsMarks: Found marks on node:`, node.marks);
    return true;
  }

  // Handle JSON node content (array)
  if (isJsonNode && node.content && Array.isArray(node.content)) {
    for (let i = 0; i < node.content.length; i++) {
      const child = node.content[i];
      console.log(`🔍 containsMarks: Checking JSON child ${i}:`, {
        type: child.type,
        hasMarks: !!(child.marks && Array.isArray(child.marks) && child.marks.length > 0),
        marks: child.marks
      });
      if (containsMarks(child)) {
        return true;
      }
    }
  }
  
  // Handle ProseMirror node content (Fragment)
  if (isProseMirrorNode && node.content && node.content.size > 0) {
    console.log(`🔍 containsMarks: Checking ProseMirror children, count: ${node.content.size}`);
    for (let i = 0; i < node.content.childCount; i++) {
      const child = node.content.child(i);
      console.log(`🔍 containsMarks: Checking PM child ${i}:`, {
        type: child.type.name,
        isText: child.isText,
        hasMarks: !!(child.marks && child.marks.length > 0),
        marks: child.marks?.map((m: any) => m.type.name)
      });
      if (containsMarks(child)) {
        return true;
      }
    }
  }

  console.log(`🔍 containsMarks: No marks found in node`);
  return false;
}

/**
 * Create inline content from HTML that contains only text and marks (no blocks)
 */
function createInlineContent(html: string, schema: any): any {
  try {
    console.log(`🔧 createInlineContent: Processing HTML "${html}"`);
    const json = htmlToProseMirrorJson(html);
    console.log(`🔧 createInlineContent: JSON:`, JSON.stringify(json, null, 2));
    
    const node = schema.nodeFromJSON(json);
    console.log(`🔧 createInlineContent: Created node:`, {
      type: node.type.name,
      isText: node.isText,
      text: node.text,
      marks: node.marks?.map((m: any) => m.type.name),
      contentSize: node.content?.size
    });

    // Extract inline content from the node
    const result = extractInlineContent(node, schema);
    console.log(`🔧 createInlineContent: Extraction result:`, {
      isArray: Array.isArray(result),
      length: Array.isArray(result) ? result.length : 'N/A',
      type: result?.type?.name,
      text: result?.text,
      marks: result?.marks?.map((m: any) => m.type.name)
    });
    
    return result;
  } catch (err) {
    console.error("❌ createInlineContent failed, fallback to plain text:", err);
    return schema.text(stripHtmlTags(html));
  }
}

/**
 * Extract inline content (text with marks) from a node, flattening any structure
 */
function extractInlineContent(node: any, schema: any): any {
  console.log(`🔧 extractInlineContent: Processing node:`, {
    isNull: !node,
    type: node?.type?.name || node?.type,
    isText: node?.isText,
    text: node?.text
  });
  
  if (!node) {
    console.log(`🔧 extractInlineContent: Node is null, returning empty text`);
    return schema.text("");
  }

  // If it's a text node, return it directly
  if (node.isText) {
    console.log(`🔧 extractInlineContent: Direct ProseMirror text node, returning as-is`);
    return node;
  }

  // If it's a text node in JSON form
  if (node.type === "text") {
    const text = node.text || "";
    console.log(`🔧 extractInlineContent: JSON text node, text="${text}", length=${text.length}`);
    if (!text) {
      console.log(`🔧 extractInlineContent: Empty JSON text node, returning empty text`);
      return schema.text(""); // Handle empty text
    }
    const marks = node.marks ? node.marks.map((mark: any) => schema.marks[mark.type]?.create(mark.attrs)) : [];
    console.log(`🔧 extractInlineContent: Creating text with ${marks.length} marks`);
    return schema.text(text, marks.filter(Boolean));
  }

  // For non-text nodes, collect all text content with marks
  console.log(`🔧 extractInlineContent: Non-text node, collecting children`);
  const textNodes: any[] = [];
  collectTextNodes(node, textNodes, schema);
  
  console.log(`🔧 extractInlineContent: Collected ${textNodes.length} text nodes`);

  // If we have multiple text nodes, we need to return a fragment
  if (textNodes.length === 0) {
    console.log(`🔧 extractInlineContent: No text nodes collected, returning empty text`);
    return schema.text(""); // Return empty text instead of failing
  } else if (textNodes.length === 1) {
    console.log(`🔧 extractInlineContent: Single text node, returning directly`);
    return textNodes[0];
  } else {
    console.log(`🔧 extractInlineContent: Multiple text nodes, returning array`);
    // Return a fragment containing all text nodes
    return textNodes;
  }
}

/**
 * Recursively collect text nodes from a structure
 */
function collectTextNodes(node: any, collected: any[], schema: any): void {
  console.log(`🔧 collectTextNodes: Processing node:`, {
    isNull: !node,
    type: node?.type?.name || node?.type,
    isText: node?.isText,
    text: node?.text,
    hasContent: !!(node?.content)
  });
  
  if (!node) return;

  // Handle ProseMirror text nodes
  if (node.isText) {
    const text = node.text || "";
    console.log(`🔧 collectTextNodes: ProseMirror text node, text="${text}", length=${text.length}`);
    if (text) {
      console.log(`🔧 collectTextNodes: Adding ProseMirror text node to collection`);
      collected.push(node); // Just use the existing ProseMirror node
    }
    return;
  }

  // Handle JSON text nodes
  if (node.type === "text") {
    const text = node.text || "";
    console.log(`🔧 collectTextNodes: JSON text node, text="${text}", length=${text.length}`);
    if (text) { // Only add non-empty text nodes
      const marks = node.marks ? node.marks.map((mark: any) => schema.marks[mark.type]?.create(mark.attrs)) : [];
      console.log(`🔧 collectTextNodes: Creating text node with ${marks.length} marks`);
      try {
        const textNode = schema.text(text, marks.filter(Boolean));
        collected.push(textNode);
        console.log(`🔧 collectTextNodes: Successfully created text node`);
      } catch (error) {
        console.error(`🔧 collectTextNodes: Failed to create text node:`, error);
      }
    } else {
      console.log(`🔧 collectTextNodes: Skipping empty JSON text node`);
    }
    return;
  }

  // Handle JSON content arrays
  if (node.content && Array.isArray(node.content)) {
    console.log(`🔧 collectTextNodes: Processing ${node.content.length} JSON children`);
    node.content.forEach((child: any, index: number) => {
      console.log(`🔧 collectTextNodes: Processing JSON child ${index}`);
      collectTextNodes(child, collected, schema);
    });
  }
  
  // Handle ProseMirror content fragments
  if (node.content && node.content.size > 0) {
    console.log(`🔧 collectTextNodes: Processing ${node.content.childCount} ProseMirror children`);
    for (let i = 0; i < node.content.childCount; i++) {
      const child = node.content.child(i);
      console.log(`🔧 collectTextNodes: Processing ProseMirror child ${i}`);
      collectTextNodes(child, collected, schema);
    }
  }
}

/**
 * Convert an HTML/text string into a ProseMirror content Fragment for insertion.
 */
function htmlToInsertFragment(input: string, schema: any) {
    try {
      const json = htmlToProseMirrorJson(input);
      const node = schema.nodeFromJSON(json);
  
      // Case: doc wrapper -> use children
      if (node.type.name === "doc") {
        return node.content;
      }
  
      // Case: heading, paragraph, etc -> use node itself
      return node.isText ? schema.text(node.text ?? "") : node.content;
    } catch (err) {
      console.error("❌ htmlToInsertFragment failed, fallback to plain text:", err);
      // If parsing fails, insert *literal text* (not HTML)
      return schema.text(stripHtmlTags(input));
    }
  }
  
  function stripHtmlTags(html: string): string {
    return html.replace(/<[^>]+>/g, ""); // remove tags, keep plain text
  }

/**
 * Apply diffs to a ProseMirror document using native ProseMirror operations
 */
function applyDiffsToProseMirrorDocument(
  originalDoc: Node,
  diffs: HtmlDiff[],
  schema: any,
  opts: ApplyHtmlDiffOptions = {}
): { workingDoc: Node; applied: number; unmatched: number[] } {
  console.log(
    "📝 applyDiffsToProseMirrorDocument: Starting ProseMirror-native diff application"
  );

  const caseSensitive = opts.caseSensitive ?? true;
  const preferLastContext = opts.preferLastContext ?? false;

  let workingState = EditorState.create({ doc: originalDoc, schema });
  const unmatched: number[] = [];
  let applied = 0;

  diffs.forEach((diff, i) => {
    console.log(`📝 Diff ${i}:`, {
      hasContext: !!diff.context,
      contextValue: diff.context,
      deleteValue: diff.delete,
      insertValue: diff.insert
    });

    // --- 1) Normalize search strings ---
    const normalizedContext = diff.context
      ? normalizeDiffText(diff.context, schema)
      : null;
    const normalizedDelete = normalizeDiffText(diff.delete, schema);
    
    console.log(`📝 Diff ${i} normalized:`, {
      originalContext: diff.context,
      normalizedContext,
      originalDelete: diff.delete,
      normalizedDelete
    });

    // --- 2) Locate context (if provided) ---
    let searchStartPos = 0;
    if (normalizedContext) {
      const contextRange = findTextRangeInDocument(workingState.doc, normalizedContext, {
        caseSensitive,
        startAfter: preferLastContext ? undefined : 0,
      });

      if (!contextRange) {
        console.log(`❌ Diff ${i}: Context not found`);
        unmatched.push(i);
        return;
      }
      searchStartPos = contextRange.to;
      console.log(`✅ Diff ${i}: Context matched, continuing at ${searchStartPos}`);
    }

    // --- 3) Locate delete text in document ---
    const deleteRange = findTextRangeInDocument(
      workingState.doc,
      normalizedDelete,
      { 
        caseSensitive, 
        startAfter: searchStartPos,
        contextBefore: normalizedContext || undefined  // Pass context to enable smart search logic
      }
    );

    if (!deleteRange) {
      console.log(`❌ Diff ${i}: Delete text "${normalizedDelete}" not found`);
      unmatched.push(i);
      return;
    }

    console.log(
      `✅ Diff ${i}: Delete text found at ${deleteRange.from}-${deleteRange.to}`
    );

    // --- 4) Build replacement content with smart content detection ---
    console.log(`📝 Diff ${i}: Analyzing replacement content type`);
    const contentAnalysis = analyzeHtmlContent(diff.insert, schema);
    console.log(`📝 Diff ${i}: Content analysis result:`, contentAnalysis);

    let insertFragment: any;
    
    if (contentAnalysis.type === "plain") {
      // Plain text replacement - preserve existing structure, but normalize the text
      console.log(`📝 Diff ${i}: Using plain text replacement`);
      const normalizedInsertText = normalizeDiffText(diff.insert, schema);
      insertFragment = schema.text(normalizedInsertText);
    } else if (contentAnalysis.type === "inline") {
      // Inline formatting (marks) - preserve existing structure but add formatting
      console.log(`📝 Diff ${i}: Using inline content replacement with marks`);
      insertFragment = createInlineContent(diff.insert, schema);
    } else {
      // Block-level content - use existing logic
      console.log(`📝 Diff ${i}: Using block-level replacement`);
      insertFragment = htmlToInsertFragment(diff.insert, schema);
    }

    // --- 5) Replace in transaction ---
    try {
      const tr = workingState.tr.replaceWith(
        deleteRange.from,
        deleteRange.to,
        insertFragment
      );
      workingState = workingState.apply(tr);
      applied++;
      console.log(`✅ Diff ${i}: Applied successfully (type: ${contentAnalysis.type})`);
    } catch (error) {
      console.error(`❌ Diff ${i}: Transaction failed`, error);
      unmatched.push(i);
    }
  });

  console.log("📝 applyDiffsToProseMirrorDocument: Completed", {
    applied,
    unmatched,
  });

  return { workingDoc: workingState.doc, applied, unmatched };
}

async function insertHtml(ctx: ActionCtx, args: { prosemirrorId: string, html: string, position: InsertPosition }) {
    const { prosemirrorId, html, position } = args;
    const schema = buildServerSchema();
    
    // Generate the document to insert from HTML
    const docToInsert = generateJSON(html, getServerExtensions());
    
    // Use prosemirrorSync.transform to handle the insertion with diffing
    await prosemirrorSync.transform(ctx, prosemirrorId, schema, (originalDoc) => {
        // Store original for diff
        const originalDocJson = originalDoc.toJSON();
        
        // Create a fresh state for applying operations
        const state = EditorState.create({ doc: originalDoc });
        let tr = state.tr;
        
        // Resolve the insertion position
        let insertPos: number;
        if (typeof position === 'number') {
            insertPos = Math.max(0, Math.min(position, originalDoc.content.size));
        } else if (position === 'documentStart') {
            insertPos = 0;
        } else if (position === 'documentEnd') {
            insertPos = originalDoc.content.size;
        } else if (position === 'document') {
            // Replace entire document - insert at start and remove everything after
            insertPos = 0;
            // We'll replace the entire content after insertion
        } else if (typeof position === 'object' && 'from' in position) {
            // Range position - insert at the start of the range
            insertPos = Math.max(0, Math.min(position.from, originalDoc.content.size));
        } else {
            // Default to end of document
            insertPos = originalDoc.content.size;
        }
        
        // Create the node to insert
        let nodeToInsert: Node;
        try {
            nodeToInsert = schema.nodeFromJSON(docToInsert);
        } catch (error) {
            console.error('Failed to create node from HTML:', error);
            // Fallback: create a simple paragraph node
            throw new Error('Failed to create node from HTML');
        }
        
        // Insert the content
        if (position === 'document') {
            // Replace entire document
            tr = tr.replaceWith(0, originalDoc.content.size, nodeToInsert.content);
        } else {
            // Insert at specific position
            tr = tr.insert(insertPos, nodeToInsert);
        }
        
        // Create the new document
        const newDoc = tr.doc;
        const newDocJson = newDoc.toJSON();
        
        // Create diff between original and new document
        const delta = createJsonDiff(originalDocJson, newDocJson);
        
        // Merge changes with change tracking
        const merged = buildContentWithJsonChanges(originalDocJson, newDocJson, delta);
        
        // Create final document and return transaction
        try {
            const mergedNode = schema.nodeFromJSON(merged);
            
            const finalState = EditorState.create({ doc: originalDoc });
            
            // Replace with the merged content
            const result = finalState.tr.replaceWith(
                0,
                finalState.doc.content.size,
                mergedNode.content,
            );
            return result;
        } catch (error) {
            console.error('Failed to merge changes:', error);
            // Fallback: use the new document directly if merge fails
            const finalState = EditorState.create({ doc: originalDoc });
            const fallbackResult = finalState.tr.replaceWith(
                0,
                finalState.doc.content.size,
                newDoc.content,
            );
            return fallbackResult;
        }
    });
    
    return {
        success: true,
        message: `HTML content inserted at position ${typeof position === 'object' && 'from' in position ? position.from : position}`,
    };
}


export const insertHtmlAction = action({
    args: {
    escritoId: v.id("escritos"),
    html: v.string(),
    position: InsertPositionValidator,
},
handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {

    const escrito = await ctx.runQuery(internal.functions.documents.internalGetEscrito, { escritoId: args.escritoId });
    if (!escrito) throw new Error("Escrito not found");

    return await insertHtml(ctx, { prosemirrorId: escrito.prosemirrorId, html: args.html, position: args.position });
},
})

/**
 * Apply context-aware HTML diffs to a chunk or the whole document.
 * 
 * @param escritoId - The ID of the escrito document to modify
 * @param diffs - Array of HTML diff operations to apply
 * @param options - Configuration options for diff application
 * @param chunkIndex - Target chunk index (default: apply to whole document)
 * @param chunkSize - Maximum size of chunks in characters (default: 32000)
 * @returns Summary of the diff application results
 */
export const applyHtmlDiff = action({
  args: {
    escritoId: v.id("escritos"),
    diffs: HtmlDiffArrayValidator,
    options: v.optional(ApplyHtmlDiffOptionsValidator),
    chunkIndex: v.optional(v.number()),
    chunkSize: v.optional(v.number()),
  },
  returns: v.object({
    applied: v.number(),
    failed: v.number(),
    unmatchedDiffIndexes: v.array(v.number()),
    scope: v.string(), // "document" | "chunk"
    strictAborted: v.boolean(),
    chunkIndex: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    console.log('📝 applyHtmlDiff: Starting HTML diff application process (ProseMirror-first approach)');
    console.log('📝 applyHtmlDiff: Input args:', JSON.stringify({
      escritoId: args.escritoId,
      diffsCount: args.diffs?.length || 0,
      chunkIndex: args.chunkIndex,
      chunkSize: args.chunkSize,
      options: args.options
    }, null, 2));

    console.log('📝 applyHtmlDiff: Fetching escrito document');
    const escrito = await ctx.runQuery(internal.functions.documents.internalGetEscrito, {
      escritoId: args.escritoId,
    });
    if (!escrito) {
      console.log('📝 applyHtmlDiff: ❌ Escrito not found');
      throw new Error("Escrito not found");
    }
    console.log('📝 applyHtmlDiff: ✅ Escrito found:', {
      id: escrito._id,
      prosemirrorId: escrito.prosemirrorId,
      title: escrito.title
    });

    const schema = buildServerSchema();
    const opts = args.options ?? {};
    const maxChars = args.chunkSize ?? 32000;
    console.log('📝 applyHtmlDiff: Configuration:', {
      maxChars,
      caseSensitive: opts.caseSensitive,
      preferLastContext: opts.preferLastContext,
      strict: opts.strict
    });

    let resultSummary = {
      applied: 0,
      failed: 0,
      unmatchedDiffIndexes: [] as number[],
      scope: typeof args.chunkIndex === "number" ? "chunk" : "document",
      strictAborted: false,
      chunkIndex: args.chunkIndex,
    };

    console.log('📝 applyHtmlDiff: Starting ProseMirror document transformation');
    await prosemirrorSync.transform(ctx, escrito.prosemirrorId, schema, (originalDoc) => {
      console.log('📝 applyHtmlDiff: Inside transform callback (ProseMirror-first approach)');
      const originalDocJson = originalDoc.toJSON();

      console.log('📝 applyHtmlDiff: Original document structure:', {
        docSize: originalDoc.content.size,
        nodeCount: originalDoc.childCount,
        jsonPreview: JSON.stringify(originalDocJson, null, 2).substring(0, 500) + '...'
      });

      // Determine target document or chunk for diff application
      let targetDoc = originalDoc;
      
      if (typeof args.chunkIndex === "number") {
        console.log('📝 applyHtmlDiff: Processing specific chunk index:', args.chunkIndex);
        console.log('📝 applyHtmlDiff: Creating ProseMirror chunks with maxChars:', maxChars);
        const chunks = createProseMirrorChunks(originalDoc, maxChars);
        console.log('📝 applyHtmlDiff: Created chunks:', {
          totalChunks: chunks.length,
          chunkDetails: chunks.map((chunk, i) => ({
            index: i,
            from: chunk.from,
            to: chunk.to,
            textLength: chunk.text.length,
            textPreview: chunk.text.substring(0, 100) + (chunk.text.length > 100 ? '...' : '')
          }))
        });
        
        if (args.chunkIndex < 0 || args.chunkIndex >= chunks.length) {
          console.log('📝 applyHtmlDiff: ❌ Invalid chunk index:', args.chunkIndex, 'Available chunks:', chunks.length);
          // No-op if invalid index
          resultSummary.failed = args.diffs.length;
          resultSummary.unmatchedDiffIndexes = Array.from({ length: args.diffs.length }, (_, i) => i);
          return EditorState.create({ doc: originalDoc }).tr; // no-op
        }
        
        const target = chunks[args.chunkIndex];
        console.log('📝 applyHtmlDiff: Target chunk details:', {
          index: args.chunkIndex,
          from: target.from,
          to: target.to,
          textLength: target.text.length,
          textPreview: target.text.substring(0, 200) + (target.text.length > 200 ? '...' : '')
        });
        
        // Create a slice document for chunk processing
        const slice = originalDoc.slice(target.from, target.to);
        const sliceContent = slice.content;
        
        // Create a temporary document from the slice for diff processing
        try {
          if (sliceContent.size === 0) {
            targetDoc = schema.nodes.doc.create(null, schema.nodes.paragraph.create());
          } else {
            targetDoc = schema.nodes.doc.create(null, sliceContent);
          }
          console.log('📝 applyHtmlDiff: Created target document from chunk slice');
        } catch (error) {
          console.log('📝 applyHtmlDiff: ❌ Failed to create target doc from slice, using original:', error);
          targetDoc = originalDoc;
        }
      } else {
        console.log('📝 applyHtmlDiff: Processing entire document (no chunk index specified)');
      }

      // Apply diffs to ProseMirror document (creates working copy)
      console.log('📝 applyHtmlDiff: Applying diffs to ProseMirror document');
      const { workingDoc, applied, unmatched } = applyDiffsToProseMirrorDocument(
        targetDoc,
        args.diffs,
        schema,
        opts
      );
      
      console.log('📝 applyHtmlDiff: Diff application results:', {
        applied,
        unmatched: unmatched.length,
        unmatchedIndexes: unmatched
      });

      const failed = unmatched.length;
      const strict = opts.strict ?? false;
      console.log('📝 applyHtmlDiff: Strict mode check:', { strict, failed, willAbort: strict && failed > 0 });

      // If strict and anything failed, no-op
      if (strict && failed > 0) {
        console.log('📝 applyHtmlDiff: ❌ Strict mode aborting due to failed diffs:', {
          failedCount: failed,
          unmatchedIndexes: unmatched
        });
        resultSummary = {
          ...resultSummary,
          applied: 0,
          failed,
          unmatchedDiffIndexes: unmatched,
          strictAborted: true,
        };
        return EditorState.create({ doc: originalDoc }).tr; // no-op transaction
      }

      // Compare original and working documents to generate changes
      console.log('📝 applyHtmlDiff: Comparing original and working documents');
      const workingDocJson = workingDoc.toJSON();
      
      // For chunk processing, we need to reconstruct the full document
      let finalWorkingDocJson = workingDocJson;
      if (typeof args.chunkIndex === "number") {
        console.log('📝 applyHtmlDiff: Reconstructing full document with chunk changes');
        // Create a copy of the original document and replace the chunk
        finalWorkingDocJson = JSON.parse(JSON.stringify(originalDocJson));
        
        // For simplicity, we'll replace the entire document content with the working doc content
        // In a more sophisticated implementation, we'd precisely replace only the chunk
        if (workingDocJson.content && Array.isArray(workingDocJson.content)) {
          finalWorkingDocJson.content = workingDocJson.content;
        }
      }

      console.log('📝 applyHtmlDiff: Creating JSON diff between original and modified documents');
      const delta = createJsonDiff(originalDocJson, finalWorkingDocJson);
      console.log('📝 applyHtmlDiff: JSON diff created:', {
        deltaSize: JSON.stringify(delta).length,
        deltaPreview: JSON.stringify(delta).substring(0, 200) + (JSON.stringify(delta).length > 200 ? '...' : '')
      });
      
      console.log('📝 applyHtmlDiff: Building merged content with change tracking');
      const merged = buildContentWithJsonChanges(originalDocJson, finalWorkingDocJson, delta);
      console.log('📝 applyHtmlDiff: Merged content created:', {
        mergedType: merged.type,
        contentLength: merged.content?.length || 0
      });

      // Validate and clean the merged JSON
      console.log('📝 applyHtmlDiff: Validating and cleaning merged content');
      const cleanedMerged = validateAndCleanNode(merged);
      console.log('📝 applyHtmlDiff: Merged content cleaned:', {
        type: cleanedMerged.type,
        contentLength: cleanedMerged.content?.length || 0
      });
      
      try {
        console.log('📝 applyHtmlDiff: Creating final merged node');
        const mergedNode = schema.nodeFromJSON(cleanedMerged);
        console.log('📝 applyHtmlDiff: ✅ Successfully created merged node:', {
          nodeType: mergedNode.type.name,
          contentSize: mergedNode.content?.size || 0
        });
        
        const finalState = EditorState.create({ doc: originalDoc });
        const finalTr = finalState.tr.replaceWith(0, finalState.doc.content.size, mergedNode.content);
        console.log('📝 applyHtmlDiff: ✅ Final transaction created successfully');

        resultSummary = {
          ...resultSummary,
          applied,
          failed,
          unmatchedDiffIndexes: unmatched,
          strictAborted: false,
        };
        console.log('📝 applyHtmlDiff: ✅ Returning successful result:', resultSummary);
        return finalTr;
      } catch (error) {
        console.log('📝 applyHtmlDiff: ❌ Failed to create merged node, using fallback:', error);
        console.log('📝 applyHtmlDiff: Problematic merged JSON:', JSON.stringify(cleanedMerged, null, 2));
        
        // Fallback: create a transaction with the working document directly
        try {
          const workingNode = schema.nodeFromJSON(validateAndCleanNode(finalWorkingDocJson));
          const fallbackState = EditorState.create({ doc: originalDoc });
          const fallbackTr = fallbackState.tr.replaceWith(0, fallbackState.doc.content.size, workingNode.content);
          
          resultSummary = {
            ...resultSummary,
            applied,
            failed,
            unmatchedDiffIndexes: unmatched,
            strictAborted: false,
          };
          console.log('📝 applyHtmlDiff: Using fallback transaction with result:', resultSummary);
          return fallbackTr;
        } catch (fallbackError) {
          console.log('📝 applyHtmlDiff: ❌ Fallback also failed, returning no-op:', fallbackError);
          resultSummary = {
            ...resultSummary,
            applied: 0,
            failed: args.diffs.length,
            unmatchedDiffIndexes: Array.from({ length: args.diffs.length }, (_, i) => i),
            strictAborted: false,
          };
          return EditorState.create({ doc: originalDoc }).tr; // no-op
        }
      }
    });

    console.log('📝 applyHtmlDiff: ✅ Transformation completed, returning final result:', resultSummary);
    return resultSummary;
  },
});