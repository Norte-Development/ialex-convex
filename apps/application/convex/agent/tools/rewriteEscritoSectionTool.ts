import { createTool, ToolCtx } from "@convex-dev/agent";
import { api, internal } from "../../_generated/api";
import { z } from "zod";
import { Id } from "../../_generated/dataModel";
import { getUserAndCaseIds, createErrorResponse, validateStringParam } from "./utils";

/**
 * Builds a human-readable description of the anchor configuration
 */
function buildAnchorDescription(afterText?: string, beforeText?: string, occurrenceIndex?: number): string {
  const parts = [];
  
  if (afterText && beforeText) {
    parts.push(`between "${afterText}" and "${beforeText}"`);
  } else if (afterText) {
    parts.push(`after "${afterText}"`);
  } else if (beforeText) {
    parts.push(`before "${beforeText}"`);
  } else {
    parts.push("entire document");
  }
  
  if (occurrenceIndex) {
    parts.push(`(occurrence ${occurrenceIndex})`);
  }
  
  return parts.join(" ");
}

/**
 * Tool to rewrite a large section of an Escrito using an LLM-produced target text
 * and anchor-based scoping, then apply it through the server-side diff engine.
 * Returns detailed summary of the operation including anchor description, text length, and operation details.
 */
export const rewriteEscritoSectionTool = createTool({
  description: "Rewrite a section of an Escrito by anchors (after/before) using target text, merged via diff. Returns detailed summary including anchor description, text length, and operation details.",
  args: z.object({
    escritoId: z.any().describe("The Escrito ID (Convex doc id)"),
    targetText: z.any().describe("The full replacement text for the scoped section"),
    afterText: z.any().optional().describe("Anchor: place rewrite after this text (scope start)"),
    beforeText: z.any().optional().describe("Anchor: place rewrite before this text (scope end)"),
    occurrenceIndex: z.any().optional().describe("If anchors repeat, pick the Nth occurrence (1-based)"),
  }).required({escritoId: true, targetText: true}),
  handler: async (ctx: ToolCtx, args: any) => {
    try {
      const {caseId, userId} = getUserAndCaseIds(ctx.userId as string);

      await ctx.runQuery(internal.auth_utils.internalCheckNewCaseAccess,{
        userId: userId as Id<"users">,
        caseId: caseId as Id<"cases">,
        requiredLevel: "advanced"
      } )

      const idErr = validateStringParam(args.escritoId, "escritoId");
      if (idErr) return idErr;
      const textErr = validateStringParam(args.targetText, "targetText");
      if (textErr) return textErr;
      if (args.afterText !== undefined) {
        const aErr = validateStringParam(args.afterText, "afterText");
        if (aErr) return aErr;
      }
      if (args.beforeText !== undefined) {
        const bErr = validateStringParam(args.beforeText, "beforeText");
        if (bErr) return bErr;
      }

      // Basic fetch to ensure escrito exists and belongs to case
      const escrito = await ctx.runQuery(internal.functions.documents.internalGetEscrito, { escritoId: args.escritoId as any });
      if (!escrito) return createErrorResponse("Escrito not found");
      if (escrito.caseId !== caseId) return createErrorResponse("Escrito does not belong to current case");

      const res = await ctx.runMutation(api.functions.escritosTransforms.index.rewriteSectionByAnchors, {
        escritoId: args.escritoId as any,
        targetText: args.targetText,
        anchors: {
          afterText: args.afterText ?? undefined,
          beforeText: args.beforeText ?? undefined,
          occurrenceIndex: typeof args.occurrenceIndex === 'number' ? args.occurrenceIndex : undefined,
        }
      });

      // Enhanced response with detailed summary
      const anchorDescription = buildAnchorDescription(args.afterText, args.beforeText, args.occurrenceIndex);
      const targetLength = args.targetText.length;
      
      return {
        ok: res.ok,
        message: res.ok 
          ? `Successfully rewrote section ${anchorDescription} with ${targetLength} characters of new content`
          : res.message || "Failed to rewrite section",
        details: {
          anchorDescription,
          targetTextLength: targetLength,
          anchors: {
            afterText: args.afterText || null,
            beforeText: args.beforeText || null,
            occurrenceIndex: args.occurrenceIndex || null,
          },
          operation: "section_rewrite",
        },
        mutationResult: res,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const anchorDescription = buildAnchorDescription(args.afterText, args.beforeText, args.occurrenceIndex);
      
      return {
        ok: false,
        message: `Failed to rewrite section ${anchorDescription}: ${errorMessage}`,
        details: {
          anchorDescription,
          targetTextLength: args.targetText?.length || 0,
          anchors: {
            afterText: args.afterText || null,
            beforeText: args.beforeText || null,
            occurrenceIndex: args.occurrenceIndex || null,
          },
          operation: "section_rewrite",
          error: errorMessage,
        },
        mutationResult: null,
      };
    }
  }
} as any);


