import * as jsondiffpatch from 'jsondiffpatch';
import { diff_match_patch } from '@dmsnell/diff-match-patch';
// import { detectLineBreakChanges, buildContentWithLineBreakChanges } from './lineBreakChanges';
import { processJsonDiffDelta } from './deltaProcessor';
import { convertMetadataToVisualChanges } from './nodeChanges';


/**
* Normalizes text for stable hashing by removing extra whitespace
* @param text - Text to normalize
* @returns Normalized text
*/
function normalizeTextForHashing(text: string): string {
 return text.replace(/\s+/g, ' ').trim();
}


function summarizeContent(node: any): string {
 if (!node.content || !Array.isArray(node.content)) {
   return '';
 }
 const text = extractParagraphText(node);
 const nodeTypes = node.content.map((child: any) => child.type).join(',');
 return `${text}:${nodeTypes}`;
}


function normalizeAttrs(attrs: any): string {
 if (!attrs || typeof attrs !== 'object') {
   return '{}';
 }
 const normalized = Object.keys(attrs)
   .sort()
   .reduce((obj, key) => {
     if (key !== 'transient' && key !== 'tempId') {
       obj[key] = attrs[key];
     }
     return obj;
   }, {} as any);
 return JSON.stringify(normalized);
}


/**
* Extracts all text content from a paragraph node for stable hashing
* @param paragraph - The paragraph node
* @returns Combined normalized text content
*/
function extractParagraphText(paragraph: any): string {
 if (!paragraph.content || !Array.isArray(paragraph.content)) {
   return '';
 }
  const textContent = paragraph.content
   .map((node: any) => {
     if (node.type === 'text') {
       return node.text || '';
     }
     // For other inline nodes like hardBreak, add a space
     if (node.type === 'hardBreak') {
       return '\n';
     }
     // For other inline nodes, return empty string
     return '';
   })
   .join('');
  
 return normalizeTextForHashing(textContent);
}


/**
* Creates a stable hash for any node type
* @param node - The node to hash
* @returns Stable hash string
*/
function createStableNodeHash(node: any, context: { index?: number } = {}): string {
 if (!node || typeof node !== 'object') {
   return JSON.stringify(node);
 }


 const nodeId = node.id || context.index || 'no-id';


 // For text nodes
 if (node.type === 'text') {
   const normalizedText = normalizeTextForHashing(node.text || '');
   const marks = JSON.stringify(node.marks || []);
   return `text:${normalizedText}:${marks}:${nodeId}`;
 }


 // For paragraphs
 if (node.type === 'paragraph') {
   const contentSummary = summarizeContent(node);
   const attrs = normalizeAttrs(node.attrs);
  
   const textContent = contentSummary.split(':')[0];
   if (!textContent) {
     return `paragraph:${attrs}:empty:${nodeId}`;
   }
  
   const trimmedContent = textContent.trim();
   if (trimmedContent.length === 0) {
     const whitespaceHash = Buffer.from(textContent).toString('base64').substring(0, 10);
     return `paragraph:${attrs}:whitespace:${whitespaceHash}:${nodeId}`;
   }
  
   const stableText = trimmedContent.split(' ').slice(0, 2).join(' ').substring(0, 15);
   return `paragraph:${attrs}:${stableText}:${nodeId}`;
 }


 // For other block nodes
 if (node.type === 'heading' || node.type === 'blockquote' || node.type === 'codeBlock') {
   const textContent = extractParagraphText(node);
   const attrs = normalizeAttrs(node.attrs);
   return `${node.type}:${attrs}:${textContent}:${nodeId}`;
 }


 // For inline nodes
 if (node.type === 'hardBreak' || node.type === 'image' || node.type === 'mention') {
   const attrs = normalizeAttrs(node.attrs);
   return `${node.type}:${attrs}:${nodeId}`;
 }


 // Fallback for unknown node types
 return `${node.type || 'unknown'}:${normalizeAttrs(node.attrs)}:${nodeId}`;
}
// Create a configured instance for ProseMirror documents
const prosemirrorDiffer = jsondiffpatch.create({
   // Object hash function for array items (important for lists and text nodes)
   objectHash: (obj: any) => {
     return createStableNodeHash(obj);
   },
   textDiff: {
     // If using text diffs, it's required to pass in the diff-match-patch library in through this proprty.
     // Alternatively, you can import jsondiffpatch using `jsondiffpatch/with-text-diffs` to avoid having to pass in diff-match-patch through the options.
     diffMatchPatch: diff_match_patch,
     // default 60, minimum string length (left and right sides) to use text diff algorithm: google-diff-match-patch
     minLength: 10,
   },
  
   // Detect moved items in arrays (useful for list reordering)
   arrays: {
     detectMove: true,
     includeValueOnMove: true,
   }
 });
  /**
  * Creates a JSON diff between two ProseMirror documents
  * @param oldDoc - The original document
  * @param newDoc - The modified document
  * @returns The diff delta object, or undefined if documents are identical
  */
 export function createJsonDiff(oldDoc: any, newDoc: any) {
   return prosemirrorDiffer.diff(oldDoc, newDoc);
 }
  /**
  * Applies a JSON diff to a document
  * @param doc - The document to apply changes to
  * @param delta - The diff delta to apply
  * @returns The patched document
  */
 export function applyJsonDiff(doc: any, delta: any) {
   return prosemirrorDiffer.patch(doc, delta);
 }
  /**
  * Reverses a JSON diff delta
  * @param delta - The diff delta to reverse
  * @returns The reversed delta
  */
 export function reverseJsonDiff(delta: any) {
   return prosemirrorDiffer.reverse(delta);
 }
  /**
  * Checks if two documents are equal
  * @param doc1 - First document
  * @param doc2 - Second document
  * @returns True if documents are equal, false otherwise
  */
 export function documentsEqual(doc1: any, doc2: any): boolean {
   return prosemirrorDiffer.diff(doc1, doc2) === undefined;
 }
  /**
  * Generates a unique ID for tracking changes
  * @returns A unique change ID string
  */
 export function generateChangeId(): string {
   return `json-change-${Math.random().toString(36).substr(2, 9)}`;
 }


/**
* Main function that converts JSON diff delta to change nodes for the editor
* @param oldDoc - The original document
* @param newDoc - The modified document
* @param delta - The diff delta
* @returns Document with change nodes indicating modifications
*/
export function buildContentWithJsonChanges(
   oldDoc: any,
   newDoc: any,
   delta: any
 ): any {
   if (!delta) {
     return newDoc;
   }
  
   const changeId = generateChangeId();
  
   // First, detect line break changes
   // const lineBreakChanges = detectLineBreakChanges(oldDoc, newDoc);
  
   // if (lineBreakChanges && lineBreakChanges.length > 0) {
   //   return buildContentWithLineBreakChanges(newDoc, lineBreakChanges, changeId);
   // }
  
   // Process the delta to create change nodes
   const processedContent = processJsonDiffDelta(oldDoc, newDoc, delta, changeId);
  
   // Convert deletion metadata to visual change nodes
   const contentWithVisualChanges = convertMetadataToVisualChanges(processedContent);
  
   return contentWithVisualChanges;
 }

