import { createTool, ToolCtx } from "@convex-dev/agent";
import { internal } from "../../../_generated/api";
import { z } from "zod";
import { createErrorResponse, getUserAndCaseIds } from "../shared/utils";
import { createEscritosSearchResultsTemplate } from "./templates";
import { Id } from "../../../_generated/dataModel";

/**
 * Tool for searching Escritos within a case.
 * 
 * This tool allows searching escritos by title. If the query is empty,
 * it will list all escritos (within the specified limit).
 * 
 * @example
 * ```typescript
 * // Search for escritos
 * await searchEscritosTool.handler(ctx, {
 *   query: "motion",
 *   limit: 10
 * });
 * 
 * // List all escritos
 * await searchEscritosTool.handler(ctx, {
 *   query: "",
 *   limit: 20
 * });
 * ```
 */
export const searchEscritosTool = createTool({
  description: "Search for escritos in the current case by title. If query is empty, lists all escritos (within limit).",
  args: z.object({
    query: z.string().describe("The search query text to find relevant escritos. Empty to get all escritos."),
    limit: z.number().optional().describe("The maximum number of escritos to return. Default is 20."),
    caseId: z.any().optional().describe("Optional case ID. If provided, will use this case instead of extracting from context. Used for WhatsApp agent."),
  }).required({query: true}),
  handler: async (ctx: ToolCtx, args: any) => {
    try {
      const { query, limit } = args;
      const userAndCase = getUserAndCaseIds(ctx.userId as string);
      let userId = userAndCase.userId;
      let caseId: string | null = null;

      // If caseId is provided in args, use it (for WhatsApp agent)
      if (args.caseId) {
        caseId = args.caseId;
      } else {
        // Otherwise, try to get it from context
        caseId = userAndCase.caseId;
      }
      
      if (!caseId) {
        return createErrorResponse("No está en un caso");
      }
      
      if (!userId) {
        return createErrorResponse("No autenticado");
      }

      await ctx.runQuery(internal.auth_utils.internalCheckNewCaseAccess, {
        userId: userId as Id<"users">,
        caseId: caseId as Id<"cases">,
        requiredLevel: "basic"
      });

      const searchLimit = limit || 20;
      const searchQuery = query.trim();

      // Get all escritos for the case
      const allEscritos = await ctx.runQuery(internal.functions.documents.getEscritosForAgent, {
        caseId: caseId as Id<"cases">,
      });

      let escritos;

      if (!searchQuery) {
        // If query is empty, list all escritos
        // Sort by lastEditedAt (most recent first) and apply limit
        escritos = allEscritos
          .sort((a: any, b: any) => (b.lastEditedAt || b._creationTime) - (a.lastEditedAt || a._creationTime))
          .slice(0, searchLimit);
      } else {
        // Filter by search term (case-insensitive search on title)
        const searchTerm = searchQuery.toLowerCase();
        escritos = allEscritos
          .filter((escrito: any) => escrito.title.toLowerCase().includes(searchTerm))
          .sort((a: any, b: any) => (b.lastEditedAt || b._creationTime) - (a.lastEditedAt || a._creationTime))
          .slice(0, searchLimit);
      }

      return createEscritosSearchResultsTemplate(escritos, searchQuery, searchLimit);

    } catch (error) {
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  },
} as any);

