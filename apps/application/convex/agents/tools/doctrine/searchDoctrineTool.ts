import { createTool } from "@convex-dev/agent";
import { internal } from "../../../_generated/api";
import { z } from "zod";
import { createErrorResponse } from "../shared/utils";

/**
 * Tool for searching legal doctrine across authorized legal databases.
 * 
 * This tool searches for doctrine articles and academic content across multiple
 * authorized legal sources (SAIJ, Pensamiento Penal, etc.) and returns a formatted
 * list of results with titles and URLs.
 * 
 * @remarks
 * - Searches across multiple doctrine sources in parallel
 * - Returns formatted results with titles and URLs
 * - Excludes raw content and IDs for cleaner output
 * - Perfect for discovering relevant doctrine before reading full content
 * - Use `readDoctrineTool` to retrieve full content from a specific URL
 * - Returns error messages as formatted strings instead of throwing
 * 
 * @example
 * ```typescript
 * const results = await searchDoctrineTool.handler(ctx, {
 *   searchTerm: "derecho penal económico"
 * });
 * // Returns:
 * // Se encontraron 5 resultado(s) para "derecho penal económico":
 * //
 * // - Article Title 1
 * //   https://www.saij.gob.ar/article-1
 * //
 * // - Article Title 2
 * //   https://www.pensamientopenal.com.ar/article-2
 * ```
 */
export const searchDoctrineTool = createTool({
    description: "Tool for searching and retrieving doctrine information. Supports searching by name, category, content type, or getting specific doctrine. Returns doctrine summaries and brief descriptions without raw content or IDs. Perfect for finding and understanding doctrine before applying it to escritos.",
    args: z.object({
        searchTerm: z.string().describe("Search term to filter doctrine by name or description"),
    }).required({searchTerm: true}),
    handler: async (ctx, args) => {
        try {
            // Validate search term
            if (!args.searchTerm || args.searchTerm.trim().length === 0) {
                return createErrorResponse("El término de búsqueda no puede estar vacío. Por favor proporciona un término para buscar doctrina.");
            }

            const searchQuery = args.searchTerm.trim();

            // Execute search across all enabled sites
            const results = await ctx.runAction(internal.agents.tools.doctrine.utils.searchDoctrine, {
                query: searchQuery
            });

            // Validate results
            if (!results || !Array.isArray(results)) {
                return createErrorResponse("La respuesta de búsqueda tiene un formato inválido. Por favor intenta nuevamente.");
            }

            // Format results into readable string
            let resultsString = "";
            let resultCount = 0;

            results.forEach(r => {
                try {
                    if (!r || !r.web || !Array.isArray(r.web)) {
                        return; // Skip invalid result objects
                    }

                    r.web.forEach((w) => {
                        try {
                            // Extract title safely
                            const title = 'title' in w && w.title && typeof w.title === 'string' ? w.title : 'Sin título';
                            
                            // Extract URL safely (handle both URL and url properties)
                            let url = 'N/A';
                            if ('URL' in w && w.URL && typeof w.URL === 'string') {
                                url = w.URL;
                            } else if ('url' in w && w.url && typeof w.url === 'string') {
                                url = w.url;
                            }

                            if (url !== 'N/A') {
                                resultsString += `- ${title}\n  ${url}\n\n`;
                                resultCount++;
                            }
                        } catch (error) {
                            console.error("Error processing individual result:", error);
                            // Continue processing other results
                        }
                    });
                } catch (error) {
                    console.error("Error processing result group:", error);
                    // Continue processing other result groups
                }
            });

            // Handle empty results
            if (resultCount === 0) {
                return `# 🔍 No se encontraron resultados

No se encontraron resultados para la búsqueda: **"${searchQuery}"**

## Sugerencias:
- Intenta con términos más generales
- Verifica la ortografía
- Usa sinónimos o términos relacionados
- Combina diferentes palabras clave

## Fuentes disponibles:
- SAIJ (Sistema Argentino de Información Jurídica)
- Pensamiento Penal`;
            }

            return `# 📚 Resultados de búsqueda de doctrina

Se encontraron **${resultCount} resultado(s)** para "${searchQuery}":

${resultsString}
---

💡 **Tip**: Usa la herramienta \`readDoctrineTool\` con la URL de tu interés para leer el contenido completo de un artículo.`;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Error desconocido";
            console.error("Error in searchDoctrineTool:", errorMessage);
            return createErrorResponse(`Error al buscar doctrina: ${errorMessage}\n\nPor favor intenta con otro término de búsqueda o verifica tu conexión.`);
        }
    }
})