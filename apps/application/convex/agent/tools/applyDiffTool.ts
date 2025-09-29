import { createTool, ToolCtx } from "@convex-dev/agent";
import { api, internal } from "../../_generated/api";
import { z } from "zod";
import { getUserAndCaseIds, createErrorResponse, validateStringParam } from "./utils";
import { Id } from "../../_generated/dataModel";

/**
 * Tool for applying targeted HTML diffs to make small, precise changes to document content.
 * 
 * BEST FOR: Small changes like text corrections, formatting adjustments, word replacements
 * NOT FOR: Large content rewrites, adding new paragraphs/sections (use insertContent tool instead)
 * 
 * Takes an array of diff operations to apply in sequence.
 * Each diff can include optional context for precise positioning.
 * Automatically ignores deleted content when searching and matching text.
 * Enhanced to properly handle HTML content with block elements (paragraphs, lists, line breaks).
 */
export const applyDiffTool: any = createTool({
  description: "Apply small, targeted edits via diffs for precise changes like text corrections, formatting adjustments, or word replacements. Enhanced to properly handle HTML content with block elements. For large rewrites or adding new sections, use insertContent tool with ranges instead. Takes an array of diff operations, each with context (optional), delete (required), and insert (required) fields.",
  args: z.object({
    escritoId: z.string().describe("The Escrito ID (Convex doc id)"),
    diffs: z.array(z.object({
      context: z.string().optional().describe("Text/HTML that appears before delete to anchor the change. Must be an exact match."),
      delete: z.string().describe("The content to delete from the document. Must be an exact match."),
      insert: z.string().describe("The content to insert in place of the deleted content. It can be empty for pure deletions.")
    })).describe("Array of diffs to apply in sequence"),
  }),
  
  handler: async (ctx: ToolCtx, args: {
    escritoId: string;
    diffs: Array<{
      context?: string;
      delete: string;
      insert: string;
    }>;
  }) => {
    console.log('🔧 applyDiffTool: Starting diff application process');
    console.log('🔧 applyDiffTool: Input args:', JSON.stringify({
      escritoId: args.escritoId,
      diffsCount: args.diffs?.length || 0,
      diffs: args.diffs?.map((d, i) => ({
        index: i,
        hasContext: !!d.context,
        contextLength: d.context?.length || 0,
        deleteLength: d.delete?.length || 0,
        insertLength: d.insert?.length || 0,
        deletePreview: d.delete?.substring(0, 50) + (d.delete?.length > 50 ? '...' : ''),
        insertPreview: d.insert?.substring(0, 50) + (d.insert?.length > 50 ? '...' : '')
      }))
    }, null, 2));

    try {
      console.log('🔧 applyDiffTool: Extracting user and case IDs');
      const {caseId, userId} = getUserAndCaseIds(ctx.userId as string);
      console.log('🔧 applyDiffTool: User ID:', userId, 'Case ID:', caseId);
      
      console.log('🔧 applyDiffTool: Checking case access permissions');
      await ctx.runQuery(internal.auth_utils.internalCheckNewCaseAccess, {
        userId: userId as Id<"users">,
        caseId: caseId as Id<"cases">,
        requiredLevel: "basic"
      });
      console.log('🔧 applyDiffTool: Access permissions verified');

      // Validate inputs
      console.log('🔧 applyDiffTool: Validating escritoId parameter');
      const escritoIdError = validateStringParam(args.escritoId, "escritoId");
      if (escritoIdError) {
        console.log('🔧 applyDiffTool: ❌ EscritoId validation failed:', escritoIdError);
        return escritoIdError;
      }

      console.log('🔧 applyDiffTool: Validating diffs array');
      if (!Array.isArray(args.diffs) || args.diffs.length === 0) {
        const error = createErrorResponse("Invalid diffs: must be a non-empty array");
        console.log('🔧 applyDiffTool: ❌ Diffs array validation failed:', error);
        return error;
      }

      // Validate each diff
      console.log('🔧 applyDiffTool: Validating individual diffs');
      for (let i = 0; i < args.diffs.length; i++) {
        const diff = args.diffs[i];
        console.log(`🔧 applyDiffTool: Validating diff ${i}:`, {
          hasDelete: !!diff.delete,
          deleteType: typeof diff.delete,
          hasInsert: !!diff.insert,
          insertType: typeof diff.insert,
          hasContext: !!diff.context
        });
        
        if (!diff.delete || typeof diff.delete !== 'string') {
          const error = createErrorResponse(`Invalid diff at index ${i}: delete field is required and must be a string`);
          console.log(`🔧 applyDiffTool: ❌ Diff ${i} validation failed:`, error);
          return error;
        }
        if (typeof diff.insert !== 'string') {
          const error = createErrorResponse(`Invalid diff at index ${i}: insert field must be a string`);
          console.log(`🔧 applyDiffTool: ❌ Diff ${i} validation failed:`, error);
          return error;
        }
      }
      console.log('🔧 applyDiffTool: ✅ All diffs validation passed');

      const escritoId = args.escritoId.trim();
      console.log('🔧 applyDiffTool: Calling applyHtmlDiff action with:', {
        escritoId,
        diffsCount: args.diffs.length,
        options: {
          caseSensitive: true,
          strict: true
        }
      });

      // Call the applyHtmlDiff function
      const result = await ctx.runAction(api.editor.edit.applyHtmlDiff, {
        escritoId: escritoId as Id<"escritos">,
        diffs: args.diffs,
        options: {
          caseSensitive: true,
          strict: true  // Fail atomically if any diff can't be applied
        }
      });

      console.log('🔧 applyDiffTool: ✅ applyHtmlDiff completed with result:', JSON.stringify(result, null, 2));

      const finalResult = {
        applied: result.applied,
        failed: result.failed,
        unmatchedDiffIndexes: result.unmatchedDiffIndexes,
        scope: result.scope,
        strictAborted: result.strictAborted,
        chunkIndex: result.chunkIndex,
        message: result.applied > 0 
          ? `Successfully applied ${result.applied} diff(s)` 
          : `Failed to apply any diffs. ${result.failed} failed.`
      };
      
      console.log('🔧 applyDiffTool: ✅ Returning final result:', JSON.stringify(finalResult, null, 2));
      return finalResult;
    } catch (error) {
      console.log('🔧 applyDiffTool: ❌ Error occurred:', error);
      return createErrorResponse(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});
