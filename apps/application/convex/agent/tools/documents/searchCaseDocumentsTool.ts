import { createTool, ToolCtx, getThreadMetadata } from "@convex-dev/agent";
import { components } from "../../../_generated/api";
import { api, internal } from "../../../_generated/api";
import { z } from "zod";
import { getUserAndCaseIds, createErrorResponse, validateStringParam, validateNumberParam } from "../utils";
import { Id } from "../../../_generated/dataModel";

/**
 * Tool for searching case documents using dense embeddings with semantic chunk clustering.
 * Provides coherent context by grouping related chunks and expanding context windows.
 *
 * @description Searches case documents using dense embeddings with semantic chunk clustering. Provides coherent context by grouping related chunks and expanding context windows.
 * @param {Object} args - Search parameters
 * @param {string} args.query - The search query text to find relevant case documents
 * @param {number} [args.limit=10] - Maximum number of initial results to return (default: 10)
 * @param {number} [args.contextWindow=4] - Number of adjacent chunks to include for context expansion (default: 4)
 * @returns {Promise<Object>} Search results with clustered document chunks and context
 * @throws {Error} When user is not authenticated or not in a case context
 *
 * @example
 * // Search for contract-related documents in current case
 * await searchCaseDocumentsTool.handler(ctx, {
 *   query: "contract terms and conditions",
 *   limit: 15,
 *   contextWindow: 6
 * });
 */
export const searchCaseDocumentsTool = createTool({
  description: "Search case documents using dense embeddings with semantic chunk clustering. Provides coherent context by grouping related chunks and expanding context windows.",
  args: z.object({
    query: z.any().describe("The search query text to find relevant case documents"),
    limit: z.any().optional().describe("Maximum number of initial results to return (default: 10)"),
    contextWindow: z.any().optional().describe("Number of adjacent chunks to include for context expansion (default: 4)")
  }).required({query: true}),
  handler: async (ctx: ToolCtx, args: any) => {
    try {
      const {caseId, userId} = getUserAndCaseIds(ctx.userId as string);

      if (!caseId || !userId){
        return createErrorResponse("Contexto de usuario inválido");
      }
      
      await ctx.runQuery(internal.auth_utils.internalCheckNewCaseAccess,{
        userId: userId as Id<"users">,
        caseId: caseId as Id<"cases">,
        requiredLevel: "basic"
      } )

      // Validate inputs in handler
      const queryError = validateStringParam(args.query, "query");
      if (queryError) return queryError;

      const limitError = validateNumberParam(args.limit, "limit", 1, 50, 10);
      if (limitError) return limitError;

      const contextWindowError = validateNumberParam(args.contextWindow, "contextWindow", 1, 20, 4);
      if (contextWindowError) return contextWindowError;

      const limit = args.limit !== undefined ? args.limit : 10;
      const contextWindow = args.contextWindow !== undefined ? args.contextWindow : 4;

      // Use userId directly from ctx instead of getCurrentUserFromAuth
      if (!ctx.userId) {
        return createErrorResponse("No autenticado");
      }

      // Extract caseId from thread metadata
      if (!ctx.threadId) {
        return createErrorResponse("No hay contexto de hilo disponible");
      }

      const { userId: threadUserId } = await getThreadMetadata(ctx, components.agent, { threadId: ctx.threadId });

      // Extract caseId from threadUserId format: "case:${caseId}_${userId}"
      if (!threadUserId?.startsWith("case:")) {
        return createErrorResponse("Esta herramienta solo puede usarse dentro de un contexto de caso");
      }

      // Call the action to perform the search with clustering
      const results = await ctx.runAction(api.rag.qdrantUtils.caseDocuments.searchCaseDocumentsWithClustering, {
        query: args.query.trim(),
        caseId,
        limit: Math.min(limit, 50), // Cap at 50 to prevent abuse
        contextWindow: Math.min(contextWindow, 20) // Cap at 20 to prevent abuse
      });

      return `# 🔍 Búsqueda de Documentos del Caso

## Consulta
**Término de búsqueda**: "${args.query.trim()}"

## Configuración de Búsqueda
- **Límite de resultados**: ${Math.min(limit, 50)}
- **Ventana de contexto**: ${Math.min(contextWindow, 20)}

## Resultados
${results.length === 0 ? 'No se encontraron documentos relevantes para la consulta.' : results}
---
*Búsqueda semántica realizada en los documentos del caso.*`;
    } catch (error) {
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }
} as any);
