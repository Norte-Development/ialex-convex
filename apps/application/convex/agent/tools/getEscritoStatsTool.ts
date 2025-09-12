import { createTool, ToolCtx } from "@convex-dev/agent";
import { api } from "../../_generated/api";
import { z } from "zod";
import { prosemirrorSync } from "../../prosemirror";
import { buildServerSchema } from "../../../../../packages/shared/src/tiptap/schema";
import { Node } from "@tiptap/pm/model";

/**
 * Statistics object containing document metrics
 */
export interface EscritoStats {
  /** Total word count in the document */
  words: number;
  /** Total paragraph count in the document */
  paragraphs: number;
}

/**
 * Response object containing document statistics and metadata
 */
export interface EscritoStatsResponse {
  /** Document statistics including word and paragraph counts */
  stats: EscritoStats;
  /** The ID of the Escrito document */
  escritoId: string;
  /** The version number of the ProseMirror document */
  version: number;
}

/**
 * Tool for retrieving statistical information about an Escrito document.
 * 
 * This tool provides basic metrics about the document content including
 * word count and paragraph count. It's useful for getting a quick overview
 * of document size and structure.
 * 
 * @example
 * ```typescript
 * // Get stats for a specific Escrito
 * const stats = await getEscritoStatsTool.handler(ctx, { escritoId: "k123..." });
 * console.log(`Document has ${stats.stats.words} words and ${stats.stats.paragraphs} paragraphs`);
 * ```
 */
export const getEscritoStatsTool = createTool({
  description: "Get the stats of an Escrito",
  args: z.object({
    escritoId: z.any().describe("The Escrito ID (Convex doc id)"),
  }).required({escritoId: true}),
  handler: async (ctx: ToolCtx, args: any) => {
    const escrito = await ctx.runQuery(api.functions.documents.getEscrito, { escritoId: args.escritoId as any });
    
    if (!escrito) {
      throw new Error(`Escrito with ID ${args.escritoId} not found`);
    }
    
    const doc = await prosemirrorSync.getDoc(ctx, escrito.prosemirrorId, buildServerSchema());
    const stats = {
        words: countWords(doc),
        paragraphs: countParagraphs(doc),
    }
    return { 
        stats,
        escritoId: escrito._id,
        version: doc.version,
    };
  }
} as any);

/**
 * Counts the total number of words in a ProseMirror document.
 * 
 * This function traverses all text nodes in the document and counts
 * words by splitting text content on whitespace boundaries.
 * 
 * @param doc - The ProseMirror document object containing version and doc properties
 * @returns The total word count across all text nodes in the document
 * 
 * @example
 * ```typescript
 * const wordCount = countWords(proseMirrorDoc);
 * console.log(`Document contains ${wordCount} words`);
 * ```
 */
const countWords = (doc: { version: number; doc: Node }): number => {
    let count = 0;

    doc.doc.content.descendants((node, pos) => {
        if (node.isText && node.text) {
            // Split by whitespace and filter out empty strings
            const words = node.text.split(/\s+/).filter(word => word.length > 0);
            count += words.length;
        }
    });

    return count;
}

/**
 * Counts the total number of paragraph nodes in a ProseMirror document.
 * 
 * This function traverses all nodes in the document and counts
 * those with the type name "paragraph".
 * 
 * @param doc - The ProseMirror document object containing version and doc properties
 * @returns The total number of paragraph nodes in the document
 * 
 * @example
 * ```typescript
 * const paragraphCount = countParagraphs(proseMirrorDoc);
 * console.log(`Document contains ${paragraphCount} paragraphs`);
 * ```
 */
const countParagraphs = (doc: { version: number; doc: Node }): number => {
    let count = 0;

    doc.doc.content.descendants((node, pos) => {
        if (node.type.name === "paragraph") {
            count++;
        }
    });

    return count;
}