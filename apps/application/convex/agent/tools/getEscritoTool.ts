import { createTool, ToolCtx } from "@convex-dev/agent";
import { api, internal } from "../../_generated/api";
import { z } from "zod";
import { getUserAndCaseIds, createErrorResponse, validateStringParam } from "./utils";
import { Id } from "../../_generated/dataModel";

/**
 * @deprecated This tool is deprecated and will be removed in a future version.
 * Use the readEscritoTool instead for better functionality and performance.
 * 
 * Retrieves the content of an Escrito document by its ID.
 * This tool fetches the document metadata and then retrieves the actual
 * content using the ProseMirror snapshot functionality.
 * 
 * @param escritoId - The unique identifier of the Escrito document (Convex document ID)
 * @returns An object containing the document content
 * 
 * @throws {Error} When the escritoId is invalid, empty, or not a string
 * @throws {Error} When the Escrito document is not found
 * @throws {Error} When there's an issue retrieving the ProseMirror snapshot
 * 
 * @example
 * ```typescript
 * const result = await getEscritoTool.handler(ctx, { escritoId: "j1234567890abcdef" });
 * console.log(result.content); // The document content
 * ```
 * 
 * @since 1.0.0
 * @deprecated Since 2.0.0 - Use readEscritoTool instead
 */
export const getEscritoTool = createTool({
  description: "Get the content of an Escrito (DEPRECATED - use readEscritoTool instead)",
  args: z.object({
    escritoId: z.any().describe("The Escrito ID (Convex doc id)"),
  }).required({escritoId: true}),
  /**
   * Handler function that retrieves Escrito content by ID
   * @param ctx - The tool context providing access to Convex functions
   * @param args - Arguments containing the escritoId
   * @returns Object with the document content
   */
  handler: async (ctx: ToolCtx, args: any) => {
    try {
      const {caseId, userId} = getUserAndCaseIds(ctx.userId as string);
      
      await ctx.runQuery(internal.auth_utils.internalCheckNewCaseAccess,{
        userId: userId as Id<"users">,
        caseId: caseId as Id<"cases">,
        requiredLevel: "basic"
      } )

      // Validate inputs in handler
      const escritoIdError = validateStringParam(args.escritoId, "escritoId");
      if (escritoIdError) return escritoIdError;

      const escritoId = args.escritoId.trim();

      // Fetch the Escrito document metadata
      const escrito = await ctx.runQuery(internal.functions.documents.internalGetEscrito, { escritoId: escritoId as any });

      if (!escrito) {
        return createErrorResponse(`Escrito not found with ID: ${escritoId}`);
      }

      // Get the actual document content using ProseMirror snapshot
      const documentContent = await ctx.runQuery(api.prosemirror.getSnapshot, { id: escrito.prosemirrorId });

      return {
        content: documentContent
      };
    } catch (error) {
      return createErrorResponse(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} as any);
