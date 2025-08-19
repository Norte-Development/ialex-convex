import * as jsondiffpatch from 'jsondiffpatch';
import { diff_match_patch } from '@dmsnell/diff-match-patch';
import { processJsonDiffDelta } from './jsonDelta';
import { convertMetadataToVisualChanges } from './visualize';

function normalizeTextForHashing(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function summarizeContent(node: any): string {
  if (!node.content || !Array.isArray(node.content)) return '';
  const text = extractParagraphText(node);
  const nodeTypes = node.content.map((child: any) => child.type).join(',');
  return `${text}:${nodeTypes}`;
}

function normalizeAttrs(attrs: any): string {
  if (!attrs || typeof attrs !== 'object') return '{}';
  const normalized = Object.keys(attrs)
    .sort()
    .reduce((obj, key) => {
      if (key !== 'transient' && key !== 'tempId') (obj as any)[key] = (attrs as any)[key];
      return obj;
    }, {} as any);
  return JSON.stringify(normalized);
}

function extractParagraphText(paragraph: any): string {
  if (!paragraph.content || !Array.isArray(paragraph.content)) return '';
  const textContent = paragraph.content
    .map((node: any) => {
      if (node.type === 'text') return node.text || '';
      if (node.type === 'hardBreak') return '\n';
      return '';
    })
    .join('');
  return normalizeTextForHashing(textContent);
}

function createStableNodeHash(node: any, context: { index?: number } = {}): string {
  if (!node || typeof node !== 'object') return JSON.stringify(node);
  const nodeId = node.id || context.index || 'no-id';
  if (node.type === 'text') {
    const normalizedText = normalizeTextForHashing(node.text || '');
    const marks = JSON.stringify(node.marks || []);
    return `text:${normalizedText}:${marks}:${nodeId}`;
  }
  if (node.type === 'paragraph') {
    const contentSummary = summarizeContent(node);
    const attrs = normalizeAttrs(node.attrs);
    const textContent = contentSummary.split(':')[0];
    if (!textContent) return `paragraph:${attrs}:empty:${nodeId}`;
    const trimmedContent = textContent.trim();
    if (trimmedContent.length === 0) {
      const whitespaceHash = Buffer.from(textContent).toString('base64').substring(0, 10);
      return `paragraph:${attrs}:whitespace:${whitespaceHash}:${nodeId}`;
    }
    const stableText = trimmedContent.split(' ').slice(0, 2).join(' ').substring(0, 15);
    return `paragraph:${attrs}:${stableText}:${nodeId}`;
  }
  if (node.type === 'heading' || node.type === 'blockquote' || node.type === 'codeBlock') {
    const textContent = extractParagraphText(node);
    const attrs = normalizeAttrs(node.attrs);
    return `${node.type}:${attrs}:${textContent}:${nodeId}`;
  }
  if (node.type === 'hardBreak' || node.type === 'image' || node.type === 'mention') {
    const attrs = normalizeAttrs(node.attrs);
    return `${node.type}:${attrs}:${nodeId}`;
  }
  return `${node.type || 'unknown'}:${normalizeAttrs(node.attrs)}:${nodeId}`;
}

const prosemirrorDiffer = jsondiffpatch.create({
  objectHash: (obj: any) => createStableNodeHash(obj),
  textDiff: { diffMatchPatch: diff_match_patch, minLength: 10 },
  arrays: { detectMove: true, includeValueOnMove: true },
});

export function createJsonDiff(oldDoc: any, newDoc: any) {
  return prosemirrorDiffer.diff(oldDoc, newDoc);
}

export function applyJsonDiff(doc: any, delta: any) {
  return prosemirrorDiffer.patch(doc, delta);
}

export function reverseJsonDiff(delta: any) {
  return prosemirrorDiffer.reverse(delta);
}

export function documentsEqual(doc1: any, doc2: any): boolean {
  return prosemirrorDiffer.diff(doc1, doc2) === undefined;
}

export function generateChangeId(): string {
  return `json-change-${Math.random().toString(36).substr(2, 9)}`;
}

export function buildContentWithJsonChanges(oldDoc: any, newDoc: any, delta: any): any {
  if (!delta) return newDoc;
  const changeId = generateChangeId();
  const processedContent = processJsonDiffDelta(oldDoc, newDoc, delta, changeId);
  const contentWithVisualChanges = convertMetadataToVisualChanges(processedContent);
  return contentWithVisualChanges;
}