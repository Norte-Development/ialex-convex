import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../_generated/api";

/**
 * Tool for searching legislation and normative documents using Qdrant hybrid search.
 * Searches both dense embeddings and sparse keywords for comprehensive legal document retrieval.
 *
 * @description Searches legislation and normative documents using hybrid search (dense + sparse embeddings). Returns comprehensive metadata including titles, jurisdictions, publication dates, and full text content.
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
  description: "Search legislation and normative documents using hybrid search (dense + sparse embeddings). Returns comprehensive metadata including titles, jurisdictions, publication dates, and full text content.",
  args: z.object({
    query: z.string().min(1).describe("The search query text to find relevant legislation and normative documents")
  }).required({query: true}),
  handler: async (ctx: any, args: any) => {
    // Validate inputs in handler
    if (!args.query || typeof args.query !== 'string' || args.query.trim().length === 0) {
      throw new Error("Invalid query: must be a non-empty string");
    }

    const validatedArgs = {
      query: args.query.trim()
    };

    try {
      // Call the internal searchNormatives action
      const results = await ctx.runAction(internal.rag.qdrant.searchNormatives, validatedArgs);

      console.log("Results:", results[0].text || results[0].content);

      // Format and return results with enhanced information
      return {
        success: true,
        query: validatedArgs.query,
        resultsCount: results.length,
        results: results.map((result: any, index: number) => ({
          rank: index + 1,
          score: result.score,
          // metadata: {
          //   id: result.id, // Always present as string
          //   documentId: result.document_id || 'N/A',
          //   title: result.title || 'N/A',
          //   tipoNorma: result.tipo_norma || 'N/A',
          //   jurisdiction: result.jurisdiccion || 'N/A',
          //   countryCode: result.country_code || 'N/A',
          //   fuente: result.fuente || 'N/A',
          //   numero: result.number || 'N/A',
          //   organismo: result.tipo_organismo || 'N/A',
          //   tipoContenido: result.tipo_contenido || 'N/A',
          //   estado: result.estado || 'N/A',
          //   publicationDate: result.publication_ts ? new Date(result.publication_ts * 1000).toISOString() : null,
          //   sanctionDate: result.sanction_ts ? new Date(result.sanction_ts * 1000).toISOString() : null,
          //   date: result.date_ts ? new Date(result.date_ts * 1000).toISOString() : null,
          //   url: result.url || null,
          //   tags: result.tags,
          //   relaciones: result.relaciones,
          //   citas: result.citas,
          //   contentHash: result.content_hash || 'N/A',
          //   lastIngestedRunId: result.last_ingested_run_id || 'N/A'
          // },
          content: {
            fullText: result.content || result.text || 'N/A',
          }
        })),
        searchMetadata: {
          searchType: 'hybrid',
          collections: ['ialex_legislation_py'],
          timestamp: new Date().toISOString(),
          totalResults: results.length
        }
      };

    } catch (error) {
      console.error("Legislation search failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Legislation search failed: ${errorMessage}`);
    }
  },
} as any);
