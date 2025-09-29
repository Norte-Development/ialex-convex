import { createTool, ToolCtx } from "@convex-dev/agent";
import { api, internal } from "../../_generated/api";
import { z } from "zod";
import { getUserAndCaseIds, createErrorResponse, validateStringParam } from "./utils";
import { Id } from "../../_generated/dataModel";

/**
 * Tool for inserting HTML content at specific positions in an Escrito document.
 * 
 * BEST FOR: Large content rewrites, adding new paragraphs/sections, replacing entire sections
 * ALSO FOR: Adding content at specific positions, replacing content in ranges
 * 
 * Simple interface: provide HTML content and position type or range.
 * The tool handles position validation and document structure internally.
 * Automatically ignores deleted content when determining positions.
 * When using ranges (from/to), the content in that range will be replaced.
 */
export const insertContentTool: any = createTool({
  description: "Insert or replace HTML content at specific positions in an Escrito document. BEST FOR large rewrites, adding new sections, or replacing content in ranges. Supports position types ('document', 'documentStart', 'documentEnd') or range objects with from/to positions for content replacement. Automatically ignores deleted change tracking content when calculating positions.",
  args: z.object({
    escritoId: z.string().describe("The Escrito ID (Convex doc id)"),
    html: z.string().describe("The HTML content to insert"),
    position: z.union([
      z.literal("document"),
      z.literal("documentStart"), 
      z.literal("documentEnd"),
      z.object({
        from: z.number(),
        to: z.number()
      }).describe("The range of the document to insert the content")
    ]).describe("Where to insert the content"),
  }),
  
  handler: async (ctx: ToolCtx, args: {
    escritoId: string;
    html: string;
    position: "document" | "documentStart" | "documentEnd" | { from: number; to: number };
  }) => {
    try {
      const {caseId, userId} = getUserAndCaseIds(ctx.userId as string);
      
      await ctx.runQuery(internal.auth_utils.internalCheckNewCaseAccess, {
        userId: userId as Id<"users">,
        caseId: caseId as Id<"cases">,
        requiredLevel: "basic"
      });

      // Validate inputs
      const escritoIdError = validateStringParam(args.escritoId, "escritoId");
      if (escritoIdError) return escritoIdError;

      const htmlError = validateStringParam(args.html, "html");
      if (htmlError) return htmlError;

      const escritoId = args.escritoId.trim();
      const html = args.html.trim();

      // Call the insertHtmlAction function
      const result = await ctx.runAction(api.editor.edit.insertHtmlAction, {
        escritoId: escritoId as Id<"escritos">,
        html,
        position: args.position
      });

      return {
        success: result.success,
        message: result.message
      };
    } catch (error) {
      return createErrorResponse(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});
