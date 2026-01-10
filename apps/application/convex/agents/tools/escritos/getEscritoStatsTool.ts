import { createTool, ToolCtx } from "@convex-dev/agent";
import { internal } from "../../../_generated/api";
import { z } from "zod";
import { prosemirrorSync } from "../../../prosemirror";
import { buildServerSchema } from "../../../../../../packages/shared/src/tiptap/schema";
import { Node } from "@tiptap/pm/model";
import {
  getUserAndCaseIds,
  createErrorResponse,
  validateStringParam,
  validateAndCorrectEscritoId,
} from "../shared/utils";
import { Id } from "../../../_generated/dataModel";
import { createEscritoStatsTemplate, createEscritoNotFoundTemplate } from "./templates";

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
/**
 * Schema for getEscritoStatsTool arguments.
 * All fields have defaults to satisfy OpenAI's JSON schema requirements.
 */
const getEscritoStatsToolArgs = z.object({
  escritoId: z.string().describe("The Escrito ID (Convex doc id)"),
});

type GetEscritoStatsToolArgs = z.infer<typeof getEscritoStatsToolArgs>;

export const getEscritoStatsTool = createTool({
  description: "Get the stats and structure information of an Escrito. Use this tool BEFORE any escrito editing to understand the document size, structure, and current state. Provides word count, paragraph count, and version information to help plan editing strategies.",
  args: getEscritoStatsToolArgs,
  handler: async (ctx: ToolCtx, args: GetEscritoStatsToolArgs) => {
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
        console.log(`✅ Auto-corrected escritoId in getEscritoStats: ${rawEscritoId} -> ${correctedEscritoId}`);
      }

      const escrito = await ctx.runQuery(internal.functions.documents.internalGetEscrito, {
        escritoId: correctedEscritoId as any,
      });
      
      if (!escrito) {
        return createErrorResponse(createEscritoNotFoundTemplate(correctedEscritoId));
      }
      
      const doc = await prosemirrorSync.getDoc(ctx, escrito.prosemirrorId, buildServerSchema());
      const stats = {
          words: countWords(doc),
          paragraphs: countParagraphs(doc),
      }
      
      const markdown = createEscritoStatsTemplate(escrito._id, doc.version, stats);

      // Build citation for the escrito
      const citation = {
        id: correctedEscritoId,
        type: 'escrito' as const,
        title: escrito.title || 'Escrito sin título',
      };

      console.log(`📚 [Citations] Creating citation for escrito stats`);
      console.log(`  📖 Citation created:`, citation);
      console.log(`📤 [Citations] Returning tool output with 1 citation`);
      return { markdown, citations: [citation] };
    } catch (error) {
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
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