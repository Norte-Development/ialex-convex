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
  ApplyHtmlDiffOptionsValidator 
} from "./types";
import { extractTextFromNode, createProseMirrorChunks } from "./utils";
import {
  createJsonDiff,
  buildContentWithJsonChanges,
} from "../../../../packages/shared/src/diff/jsonDiff";
import { EditorState } from "@tiptap/pm/state";

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

/**
 * Helper function to apply HTML diffs to a string with optional context anchoring.
 */
function applyDiffsToHtml(
  html: string,
  diffs: HtmlDiff[],
  opts: ApplyHtmlDiffOptions = {}
): { html: string; applied: number; unmatched: number[] } {
  const caseSensitive = opts.caseSensitive ?? true;
  const preferLastContext = opts.preferLastContext ?? false;

  let working = html;
  const unmatched: number[] = [];
  let applied = 0;

  const locate = (haystack: string, needle: string, fromIndex: number) => {
    if (needle.length === 0) return -1;
    if (caseSensitive) return haystack.indexOf(needle, fromIndex);
    return haystack.toLowerCase().indexOf(needle.toLowerCase(), fromIndex);
  };

  const locateLast = (haystack: string, needle: string) => {
    if (needle.length === 0) return -1;
    if (caseSensitive) return haystack.lastIndexOf(needle);
    return haystack.toLowerCase().lastIndexOf(needle.toLowerCase());
  };

  diffs.forEach((d, i) => {
    let searchStart = 0;

    if (d.context && d.context.length > 0) {
      const contextIndex = preferLastContext
        ? locateLast(working, d.context)
        : locate(working, d.context, 0);
      if (contextIndex === -1) {
        unmatched.push(i);
        return;
      }
      searchStart = contextIndex + d.context.length;
    }

    const deleteIndex = locate(working, d.delete, searchStart);
    if (deleteIndex === -1) {
      unmatched.push(i);
      return;
    }

    working = working.slice(0, deleteIndex) + d.insert + working.slice(deleteIndex + d.delete.length);
    applied += 1;
  });

  return { html: working, applied, unmatched };
}

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
    const escrito = await ctx.runQuery(internal.functions.documents.internalGetEscrito, {
      escritoId: args.escritoId,
    });
    if (!escrito) throw new Error("Escrito not found");

    const schema = buildServerSchema();
    const opts = args.options ?? {};
    const maxChars = args.chunkSize ?? 32000;

    let resultSummary = {
      applied: 0,
      failed: 0,
      unmatchedDiffIndexes: [] as number[],
      scope: typeof args.chunkIndex === "number" ? "chunk" : "document",
      strictAborted: false,
      chunkIndex: args.chunkIndex,
    };

    await prosemirrorSync.transform(ctx, escrito.prosemirrorId, schema, (originalDoc) => {
      const originalDocJson = originalDoc.toJSON();

      // Determine target range
      let fromPos = 1;
      let toPos = originalDoc.content.size + 1;

      if (typeof args.chunkIndex === "number") {
        const chunks = createProseMirrorChunks(originalDoc, maxChars);
        if (args.chunkIndex < 0 || args.chunkIndex >= chunks.length) {
          // No-op if invalid index
          resultSummary.failed = args.diffs.length;
          resultSummary.unmatchedDiffIndexes = Array.from({ length: args.diffs.length }, (_, i) => i);
          return EditorState.create({ doc: originalDoc }).tr; // no-op
        }
        const target = chunks[args.chunkIndex];
        fromPos = target.from;
        toPos = target.to;
      }

      // Render the target slice to HTML
      const slice = originalDoc.slice(fromPos, toPos);
      const beforeHtml = generateHTML(slice.content.toJSON(), getServerExtensions());

      // Apply diffs
      const { html: afterHtml, applied, unmatched } = applyDiffsToHtml(beforeHtml, args.diffs, {
        caseSensitive: opts.caseSensitive,
        preferLastContext: opts.preferLastContext,
      });

      const failed = unmatched.length;
      const strict = opts.strict ?? false;

      // If strict and anything failed, no-op
      if (strict && failed > 0) {
        resultSummary = {
          ...resultSummary,
          applied: 0,
          failed,
          unmatchedDiffIndexes: unmatched,
          strictAborted: true,
        };
        return EditorState.create({ doc: originalDoc }).tr; // no-op transaction
      }

      // Convert updated HTML back to JSON
      const updatedDocJson = generateJSON(afterHtml, getServerExtensions());

      // Build a transaction replacing exactly the slice, then merge with tracked changes
      const state = EditorState.create({ doc: originalDoc });
      const replaceFrom = Math.max(0, fromPos - 1);
      const replaceTo = Math.max(replaceFrom, toPos - 1);

      let tr = state.tr;
      const nodeToInsert = schema.nodeFromJSON(updatedDocJson);
      tr = tr.replaceWith(replaceFrom, replaceTo, nodeToInsert.content);

      const newDoc = tr.doc;
      const newDocJson = newDoc.toJSON();

      const delta = createJsonDiff(originalDocJson, newDocJson);
      const merged = buildContentWithJsonChanges(originalDocJson, newDocJson, delta);

      try {
        const mergedNode = schema.nodeFromJSON(merged);
        const finalState = EditorState.create({ doc: originalDoc });
        const finalTr = finalState.tr.replaceWith(0, finalState.doc.content.size, mergedNode.content);

        resultSummary = {
          ...resultSummary,
          applied,
          failed,
          unmatchedDiffIndexes: unmatched,
          strictAborted: false,
        };
        return finalTr;
      } catch {
        // Fallback: apply unmerged transaction
        resultSummary = {
          ...resultSummary,
          applied,
          failed,
          unmatchedDiffIndexes: unmatched,
          strictAborted: false,
        };
        return tr;
      }
    });

    return resultSummary;
  },
});