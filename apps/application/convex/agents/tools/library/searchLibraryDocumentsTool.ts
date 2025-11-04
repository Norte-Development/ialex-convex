import { createTool, ToolCtx } from "@convex-dev/agent";
import { api, internal } from "../../../_generated/api";
import { z } from "zod";
import { createErrorResponse, validateStringParam, validateNumberParam, getUserAndCaseIds } from "../shared/utils";
import { Id } from "../../../_generated/dataModel";

/**
 * Tool for searching library documents using dense embeddings with semantic chunk clustering.
 * Searches across user's personal library and all accessible team libraries.
 *
 * @description Searches library documents using dense embeddings with semantic chunk clustering. Provides coherent context by grouping related chunks and expanding context windows. Searches across your personal library and all team libraries you have access to.
 * @param {Object} args - Search parameters
 * @param {string} args.query - The search query text to find relevant library documents
 * @param {number} [args.limit=10] - Maximum number of initial results to return (default: 10)
 * @param {number} [args.contextWindow=4] - Number of adjacent chunks to include for context expansion (default: 4)
 * @returns {Promise<Object>} Search results with clustered document chunks and context
 * @throws {Error} When user is not authenticated
 *
 * @example
 * // Search for legal precedents in library
 * await searchLibraryDocumentsTool.handler(ctx, {
 *   query: "precedents related to contract law",
 *   limit: 15,
 *   contextWindow: 6
 * });
 */
export const searchLibraryDocumentsTool = createTool({
  description: "Search library documents using dense embeddings with semantic chunk clustering. Searches across your personal library and all team libraries you have access to. Use this to find relevant reference documents, templates, legal precedents, and knowledge base articles.",
  args: z.object({
    query: z.any().describe("The search query text to find relevant library documents"),
    limit: z.any().optional().describe("Maximum number of initial results to return (default: 10)"),
    contextWindow: z.any().optional().describe("Number of adjacent chunks to include for context expansion (default: 4)")
  }).required({query: true}),
  handler: async (ctx: ToolCtx, args: any) => {
    try {
      // Verify authentication using agent context
      if (!ctx.userId) {
        return createErrorResponse("No autenticado");
      }

      // Validate inputs in handler
      const queryError = validateStringParam(args.query, "query");
      if (queryError) return queryError;

      const limitError = validateNumberParam(args.limit, "limit", 1, 50, 10);
      if (limitError) return limitError;

      const contextWindowError = validateNumberParam(args.contextWindow, "contextWindow", 1, 20, 4);
      if (contextWindowError) return contextWindowError;

      const limit = args.limit !== undefined ? args.limit : 10;
      const contextWindow = args.contextWindow !== undefined ? args.contextWindow : 4;

      // Extract userId from agent context using shared utility
      const {caseId, userId} = getUserAndCaseIds(ctx.userId as string);

      // Get user's team memberships to search team libraries
      const teamMemberships = await ctx.runQuery(internal.functions.teams.getUserTeamMembershipsInternal, {
        userId: userId as Id<"users">
      });

      const teamIds = teamMemberships.map(m => String(m.teamId));

      console.log("Searching library documents:", { userId, teamIds, query: args.query, limit, contextWindow });

      // Call the action to perform the search with clustering
      const results = await ctx.runAction(api.rag.qdrantUtils.libraryDocuments.searchLibraryDocumentsWithClustering, {
        query: args.query.trim(),
        userId: userId,
        teamIds,
        limit: Math.min(limit, 50), // Cap at 50 to prevent abuse
        contextWindow: Math.min(contextWindow, 20) // Cap at 20 to prevent abuse
      });

      if (!results || results.length === 0) {
        return `# 🔍 Búsqueda en Biblioteca

## Consulta
"${args.query.trim()}"

## Parámetros
- **Límite**: ${Math.min(limit, 50)} resultados
- **Ventana de Contexto**: ${Math.min(contextWindow, 20)} fragmentos

## Resultados
No se encontraron documentos en tu biblioteca que coincidan con esta búsqueda.

**Sugerencias:**
- Intenta usar términos de búsqueda diferentes
- Verifica que el documento exista en tu biblioteca personal o de equipo
- Usa palabras clave más generales

---
*Búsqueda completada sin resultados.*`;
      }

      return `# 🔍 Búsqueda en Biblioteca

## Consulta
"${args.query.trim()}"

## Parámetros
- **Límite**: ${Math.min(limit, 50)} resultados
- **Ventana de Contexto**: ${Math.min(contextWindow, 20)} fragmentos

## Resultados Encontrados
Se encontraron fragmentos relevantes en tu biblioteca personal y bibliotecas de equipo.

## Contenido

${results}

---
*Resultados de búsqueda en biblioteca. Los fragmentos se han agrupado por documento y se ha expandido el contexto para mayor coherencia.*`;
    } catch (error) {
      console.error("Error in searchLibraryDocumentsTool:", error);
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }
} as any);

