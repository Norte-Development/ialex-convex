import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../_generated/api";
import { createErrorResponse, validateStringParam } from "./utils";
import { LegislationSearchResult } from "../../rag/qdrantUtils/types";

/**
 * Tool for searching legislation and normative documents using Qdrant hybrid search.
 * Searches both dense embeddings and sparse keywords for comprehensive legal document retrieval.
 *
 * @description Searches legislation and normative documents using hybrid search (dense + sparse embeddings). Returns comprehensive metadata including titles, jurisdictions, publication dates, and full text content. Use this tool when users ask about specific laws, articles, regulations, or legal norms. Always follow up with readLegislation to get the complete text of relevant documents.
 * @param {Object} args - Search parameters
 * @param {string} args.query - The search query text to find relevant legislation
 * @returns {Promise<Array>} Array of legislation search results with full metadata
 * @throws {Error} When the legislation search fails
 *
 * @example
 * // Search for labor law legislation
 * await searchLegislationTool.handler(ctx, {
 *   query: "labor law regulations"
 * });
 */
export const searchLegislationTool = createTool({
  description: "Search legislation and normative documents using hybrid search (dense + sparse embeddings). Returns comprehensive metadata including titles, jurisdictions, publication dates, and full text content. Use this tool when users ask about specific laws, articles, regulations, or legal norms. Always follow up with readLegislation to get the complete text of relevant documents.",
  args: z.object({
    query: z.string().min(1).describe("The search query text to find relevant legislation and normative documents")
  }).required({query: true}),
  handler: async (ctx: any, args: any) => {
    try {
      // Validate inputs in handler
      const queryError = validateStringParam(args.query, "query");
      if (queryError) return queryError;

      const validatedArgs = {
        query: args.query.trim()
      };

      // Call the internal searchNormatives action
      const results: LegislationSearchResult[] = await ctx.runAction(internal.rag.qdrantUtils.legislation.searchNormatives, validatedArgs);

      console.log("Results:", results[0].text);

      // Format and return results with enhanced information
      return `# 📜 Búsqueda de Legislación

## Consulta
**Término de búsqueda**: "${validatedArgs.query}"

## Estadísticas
- **Resultados encontrados**: ${results.length}
- **Tipo de búsqueda**: Híbrida (densa + dispersa)
- **Colecciones consultadas**: ialex_legislation_py
- **Tiempo de búsqueda**: ${new Date().toLocaleString()}

## Resultados
${results.length === 0 ? 'No se encontraron documentos legislativos relevantes para la consulta.' : results.map((result: LegislationSearchResult, index: number) => `
### ${index + 1}. ${result.title || 'Sin título'}
- **ID del Documento**: ${result.document_id || 'N/A'}
- **Tipo de Norma**: ${result.tipo_norma || 'N/A'}
- **Jurisdicción**: ${result.jurisdiccion || 'N/A'}
- **Número**: ${result.number || 'N/A'}
- **Estado**: ${result.estado || 'N/A'}
- **Fuente**: ${result.fuente || 'N/A'}
- **Puntuación de Relevancia**: ${result.score ? result.score.toFixed(3) : 'N/A'}
- **Fecha de Publicación**: ${result.publication_ts ? new Date(result.publication_ts * 1000).toLocaleDateString() : 'N/A'}
${result.url ? `- **URL**: ${result.url}` : ''}
- **Contenido**: ${result.text || 'Sin contenido disponible'}
`).join('\n')}

---
*Búsqueda híbrida realizada en la base de datos legislativa.*`;

    } catch (error) {
      console.error("Legislation search failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      return createErrorResponse(`Búsqueda de legislación falló: ${errorMessage}`);
    }
  },
} as any);
