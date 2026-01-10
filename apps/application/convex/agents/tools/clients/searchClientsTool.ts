import { createTool, ToolCtx } from "@convex-dev/agent";
import { api, internal } from "../../../_generated/api";
import { z } from "zod";
import { getUserAndCaseIds, createErrorResponse } from "../shared/utils";
import { Id } from "../../../_generated/dataModel";
import { 
  createSearchResultsTemplate, 
  createCaseClientsResultsTemplate, 
  createAllClientsResultsTemplate,
  ClientResult 
} from "./templates";

// Helper functions for formatting results

/**
 * Tool for searching and retrieving client information.
 * Supports searching by name, DNI, CUIT, or filtering by case.
 *
 * @description Tool for searching and retrieving client information. Supports searching by name, DNI, CUIT, or filtering by case. Returns comprehensive client details including their cases and roles. Perfect for finding client information and understanding client-case relationships.
 * @param {Object} args - Search parameters
 * @param {string} [args.searchTerm] - Search term to filter clients by name, DNI, or CUIT
 * @param {string} [args.caseId] - Filter by case (returns clients in specific case)
 * @param {number} [args.limit=20] - Maximum number of results to return (default: 20, max: 100)
 * @returns {Promise<Object>} Search results with client details and their cases
 * @throws {Error} When user is not authenticated or search fails
 *
 * @example
 * // Search clients by name
 * await searchClientsTool.handler(ctx, {
 *   searchTerm: "Juan Pérez",
 *   limit: 10
 * });
 *
 * // Get clients in specific case
 * await searchClientsTool.handler(ctx, {
 *   caseId: "case_123",
 *   limit: 50
 * });
 */
/**
 * Schema for searchCaseClientsTool arguments.
 * All fields have defaults to satisfy OpenAI's JSON schema requirements.
 */
const searchCaseClientsToolArgs = z.object({
  searchTerm: z.string().default("").describe("Search term to filter clients by name, DNI, or CUIT. Empty string to get all clients."),
  limit: z.number().int().min(1).max(100).default(20).describe("Maximum number of results to return (default: 20, max: 100)")
});

type SearchCaseClientsToolArgs = z.infer<typeof searchCaseClientsToolArgs>;

export const searchCaseClientsTool = createTool({
  description: "Tool for searching and retrieving client information. Supports searching by name, DNI, CUIT, or filtering by case. Returns comprehensive client details including their cases and roles. Perfect for finding client information and understanding client-case relationships.",
  args: searchCaseClientsToolArgs,
  handler: async (ctx: ToolCtx, args: SearchCaseClientsToolArgs) => {
    try {
      const {caseId, userId} = getUserAndCaseIds(ctx.userId as string);

      if (!caseId) {
        return createErrorResponse("No esta en un caso");
      }
      
      await ctx.runQuery(internal.auth_utils.internalCheckNewCaseAccess,{
        userId: userId as Id<"users">,
        caseId: caseId as Id<"cases">,
        requiredLevel: "basic"
      } )

      const searchTerm = args.searchTerm.trim() !== "" ? args.searchTerm.trim() : undefined;
      const targetCaseId = caseId?.trim();
      const limit = args.limit;

      // Call internal query to search clients
      const clients = await ctx.runQuery(internal.functions.clients.searchClientsForAgent, {
        searchTerm: searchTerm || undefined,
        caseId: targetCaseId as Id<"cases">,
        limit,
      });

      // Format results based on search type
      if (searchTerm) {
        return createSearchResultsTemplate(clients, searchTerm, limit);
      } else if (targetCaseId) {
        return createCaseClientsResultsTemplate(clients, targetCaseId, limit);
      } else {
        return createAllClientsResultsTemplate(clients, limit);
      }
    } catch (error) {
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  },
} as any);
