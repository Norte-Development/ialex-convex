'use node'

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action, ActionCtx, mutation } from "../_generated/server";
import { prosemirrorSync } from "../prosemirror";
import { buildServerSchema, getServerExtensions } from "../../../../packages/shared/src/tiptap/schema";
import { generateHTML } from '@tiptap/html/server';
import { Node } from '@tiptap/pm/model';
import { Id } from "../_generated/dataModel";
import { HtmlChunk, HtmlChunkArrayValidator, Range, RangeValidator } from "./types";
import { extractTextFromNode, createProseMirrorChunks } from "./utils";

/**
 * Helper function to get the full HTML content of an escrito document.
 * 
 * @param ctx - The action context
 * @param args - The arguments containing the escrito ID
 * @returns The full HTML content of the escrito document
 * @throws {Error} When the escrito document is not found
 */
const getFullHtmlHelper = async (ctx: ActionCtx, args: { escritoId: Id<"escritos"> }) => {
    const escrito = await ctx.runQuery(internal.functions.documents.internalGetEscrito, { escritoId: args.escritoId });

    if (!escrito) {
      throw new Error("Escrito not found");
    }

    const doc = await prosemirrorSync.getDoc(ctx, escrito.prosemirrorId, buildServerSchema());
    
    // Use the same extensions that were used to build the schema
    const html = generateHTML(doc.doc.toJSON(), getServerExtensions());
    return html;
}

/**
 * Get the full HTML content of an escrito document.
 * 
 * @param ctx - The action context
 * @param args - The arguments containing the escrito ID
 * @returns The full HTML content of the escrito document as a string
 */
export const getFullHtml = action({
  args: {
    escritoId: v.id("escritos"),
  },
  handler: async (ctx, args) => {
    return await getFullHtmlHelper(ctx, args);
  },
});


/**
 * Get HTML content from a specific range in the document using separate from/to parameters.
 * 
 * @param escritoId - The ID of the escrito document
 * @param from - Start position in the document
 * @param to - End position in the document
 * @returns The HTML content as a string for the specified range
 */
export const getHtmlRange = action({
  args: {
    escritoId: v.id("escritos"),
    from: v.number(),
    to: v.number(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const escrito = await ctx.runQuery(internal.functions.documents.internalGetEscrito, { escritoId: args.escritoId });

    if (!escrito) {
      throw new Error("Escrito not found");
    }

    const doc = await prosemirrorSync.getDoc(ctx, escrito.prosemirrorId, buildServerSchema());
    
    // Validate range bounds
    const docSize = doc.doc.content.size;
    const fromPos = Math.max(1, Math.min(args.from, docSize + 1)); // ProseMirror docs start at position 1
    const toPos = Math.max(fromPos, Math.min(args.to, docSize + 1));
    
    // Create a document slice for the specified range
    const slice = doc.doc.slice(fromPos, toPos);
    
    // Generate HTML for this specific document slice
    const html = generateHTML(slice.content.toJSON(), getServerExtensions());
    
    return html;
  },
});

/**
 * Get HTML content from a specific range in the document using a Range object.
 * 
 * @param escritoId - The ID of the escrito document
 * @param range - The range object containing from and to positions
 * @returns The HTML content as a string for the specified range
 */
export const getHtmlRangeFromObject = action({
  args: {
    escritoId: v.id("escritos"),
    range: RangeValidator,
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const escrito = await ctx.runQuery(internal.functions.documents.internalGetEscrito, { escritoId: args.escritoId });

    if (!escrito) {
      throw new Error("Escrito not found");
    }

    const doc = await prosemirrorSync.getDoc(ctx, escrito.prosemirrorId, buildServerSchema());
    
    // Validate range bounds
    const docSize = doc.doc.content.size;
    const fromPos = Math.max(1, Math.min(args.range.from, docSize + 1)); // ProseMirror docs start at position 1
    const toPos = Math.max(fromPos, Math.min(args.range.to, docSize + 1));
    
    // Create a document slice for the specified range
    const slice = doc.doc.slice(fromPos, toPos);
    
    // Generate HTML for this specific document slice
    const html = generateHTML(slice.content.toJSON(), getServerExtensions());
    
    return html;
  },
});

/**
 * Generate HTML chunks from an escrito document with specified chunk size.
 * Creates semantic chunks that respect ProseMirror node boundaries while maintaining
 * the specified maximum character count per chunk.
 * 
 * @param ctx - The action context
 * @param args - The arguments containing the escrito ID and desired chunk size
 * @returns Array of HTML chunks with their corresponding ranges and node positions
 * @throws {Error} When the escrito document is not found
 */
export const getHtmlChunks = action({
  args: {
    escritoId: v.id("escritos"),
    chunkSize: v.number(),
  },
  returns: HtmlChunkArrayValidator,
  handler: async (ctx, args): Promise<HtmlChunk[]> => {
    const escrito = await ctx.runQuery(internal.functions.documents.internalGetEscrito, { escritoId: args.escritoId });

    if (!escrito) {
      throw new Error("Escrito not found");
    }

    const doc = await prosemirrorSync.getDoc(ctx, escrito.prosemirrorId, buildServerSchema());
    
    // Create chunks at ProseMirror document level using actual node boundaries
    const proseMirrorChunks = createProseMirrorChunks(doc.doc, args.chunkSize);
    
    const chunks: HtmlChunk[] = [];

    for (const pmChunk of proseMirrorChunks) {
      // Create a document slice for this chunk using actual ProseMirror positions
      const slice = doc.doc.slice(pmChunk.from, pmChunk.to);
      
      // Generate HTML for this specific document slice
      const chunkHtml = generateHTML(slice.content.toJSON(), getServerExtensions());
      
      // Calculate HTML character positions within the full document HTML
      // For now, we'll use the cumulative HTML length as approximation
      const htmlStart = chunks.reduce((acc, chunk) => acc + chunk.content.length, 0);
      const htmlEnd = htmlStart + chunkHtml.length;

      chunks.push({
        content: chunkHtml,
        range: {
          from: htmlStart,
          to: htmlEnd,
        },
        nodeRange: {
          from: pmChunk.from,
          to: pmChunk.to,
        },
      });
    }

    return chunks;
  },
});