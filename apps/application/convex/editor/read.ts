'use node'

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action, ActionCtx } from "../_generated/server";
import { prosemirrorSync } from "../prosemirror";
import { buildServerSchema, getServerExtensions } from "../../../../packages/shared/src/tiptap/schema";
import { generateHTML } from '@tiptap/html/server';
// Node import not needed in this module
import { Id } from "../_generated/dataModel";
import { HtmlChunk, HtmlChunkArrayValidator, Range, RangeValidator } from "./types";
import { extractTextFromNode, createProseMirrorChunks } from "./utils";

/**
 * Recursively filter out deleted change nodes from a document JSON structure.
 * This ensures that deleted content is not included in HTML output.
 */
function filterDeletedNodes(nodeJson: any): any {
  if (!nodeJson || typeof nodeJson !== 'object') {
    return nodeJson;
  }

  // If this is a deleted change node, exclude it completely
  if ((nodeJson.type === 'inlineChange' || nodeJson.type === 'blockChange') && 
      nodeJson.attrs?.changeType === 'deleted') {
    return null; // Remove deleted nodes
  }

  // If this is a lineBreakChange, handle it specially
  if (nodeJson.type === 'lineBreakChange' && nodeJson.attrs?.changeType === 'deleted') {
    return null; // Remove deleted line breaks
  }

  // Handle arrays (like content arrays)
  if (Array.isArray(nodeJson)) {
    return nodeJson
      .map(item => filterDeletedNodes(item))
      .filter(item => item !== null); // Remove null entries
  }

  // Handle objects (nodes)
  const filtered = { ...nodeJson };
  
  // Validate that the node has a valid type before processing
  if (filtered.type === undefined || filtered.type === null) {
    console.warn('Node with undefined type detected during filtering:', filtered);
    return null; // Remove nodes with invalid types
  }
  
  // Recursively filter content array
  if (filtered.content && Array.isArray(filtered.content)) {
    filtered.content = filtered.content
      .map((child: any) => filterDeletedNodes(child))
      .filter((child: any) => child !== null); // Remove null entries
  }

  // Filter other array properties if they exist
  for (const key in filtered) {
    if (Array.isArray(filtered[key])) {
      filtered[key] = filtered[key]
        .map((item: any) => filterDeletedNodes(item))
        .filter((item: any) => item !== null);
    } else if (typeof filtered[key] === 'object' && filtered[key] !== null) {
      const filteredValue = filterDeletedNodes(filtered[key]);
      // Only keep the filtered value if it's not null
      if (filteredValue !== null) {
        filtered[key] = filteredValue;
      } else {
        delete filtered[key];
      }
    }
  }

  // Final validation: ensure the node still has a valid type after filtering
  if (!filtered.type || typeof filtered.type !== 'string') {
    console.warn('Node type became invalid after filtering:', filtered);
    return null;
  }

  return filtered;
}

/**
 * Helper function to get the full HTML content of an escrito document.
 * Automatically excludes deleted change nodes from the output.
 * 
 * @param ctx - The action context
 * @param args - The arguments containing the escrito ID
 * @returns The full HTML content of the escrito document (excluding deleted content)
 * @throws {Error} When the escrito document is not found
 */
const getFullHtmlHelper = async (ctx: ActionCtx, args: { escritoId: Id<"escritos"> }) => {
    const escrito = await ctx.runQuery(internal.functions.documents.internalGetEscrito, { escritoId: args.escritoId });

    if (!escrito) {
      throw new Error("Escrito not found");
    }

    const doc = await prosemirrorSync.getDoc(ctx, escrito.prosemirrorId, buildServerSchema());
    
    // Filter out deleted change nodes before generating HTML
    const filteredDocJson = filterDeletedNodes(doc.doc.toJSON());
    
    // Use the same extensions that were used to build the schema
    const html = generateHTML(filteredDocJson, getServerExtensions());
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
 * Automatically excludes deleted change nodes from the output.
 * 
 * @param escritoId - The ID of the escrito document
 * @param from - Start position in the document
 * @param to - End position in the document
 * @returns The HTML content as a string for the specified range (excluding deleted content)
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
    
    // Validate range bounds (ProseMirror slice positions are 0..docSize)
    const docSize = doc.doc.content.size;
    const fromPos = Math.max(0, Math.min(args.from, docSize));
    const toPos = Math.max(fromPos, Math.min(args.to, docSize));
    
    // Create a document slice for the specified range
    const slice = doc.doc.slice(fromPos, toPos);
    
    // Filter out deleted change nodes before generating HTML
    const filteredSliceJson = filterDeletedNodes(slice.content.toJSON());
    
    // Generate HTML for this specific document slice
    const html = generateHTML(filteredSliceJson, getServerExtensions());
    
    return html;
  },
});

/**
 * Get HTML content from a specific range in the document using a Range object.
 * Automatically excludes deleted change nodes from the output.
 * 
 * @param escritoId - The ID of the escrito document
 * @param range - The range object containing from and to positions
 * @returns The HTML content as a string for the specified range (excluding deleted content)
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
    
    // Validate range bounds (ProseMirror slice positions are 0..docSize)
    const docSize = doc.doc.content.size;
    const fromPos = Math.max(0, Math.min(args.range.from, docSize));
    const toPos = Math.max(fromPos, Math.min(args.range.to, docSize));
    
    // Create a document slice for the specified range
    const slice = doc.doc.slice(fromPos, toPos);
    
    // Filter out deleted change nodes before generating HTML
    const filteredSliceJson = filterDeletedNodes(slice.content.toJSON());
    
    // Generate HTML for this specific document slice
    const html = generateHTML(filteredSliceJson, getServerExtensions());
    
    return html;
  },
});

/**
 * Generate HTML chunks from an escrito document with specified chunk size.
 * Creates semantic chunks that respect ProseMirror node boundaries while maintaining
 * the specified maximum character count per chunk.
 * Automatically excludes deleted change nodes from the output.
 * 
 * @param ctx - The action context
 * @param args - The arguments containing the escrito ID and desired chunk size
 * @returns Array of HTML chunks with their corresponding ranges and node positions (excluding deleted content)
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
    // createProseMirrorChunks already uses extractTextFromNode which filters deleted content
    const proseMirrorChunks = createProseMirrorChunks(doc.doc, args.chunkSize);
    
    const chunks: HtmlChunk[] = [];

    for (const pmChunk of proseMirrorChunks) {
      // Create a document slice for this chunk using actual ProseMirror positions, clamped to valid bounds
      const docSize = doc.doc.content.size;
      const from = Math.max(0, Math.min(pmChunk.from, docSize));
      const to = Math.max(from, Math.min(pmChunk.to, docSize));
      const slice = doc.doc.slice(from, to);
      
      // Filter out deleted change nodes before generating HTML
      const filteredSliceJson = filterDeletedNodes(slice.content.toJSON());
      
      // Generate HTML for this specific document slice
      const chunkHtml = generateHTML(filteredSliceJson, getServerExtensions());
      
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
          from,
          to,
        },
      });
    }

    return chunks;
  },
});