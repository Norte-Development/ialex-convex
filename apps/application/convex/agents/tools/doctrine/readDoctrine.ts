import { createTool } from "@convex-dev/agent";
import { internal } from "../../../_generated/api";
import { z } from "zod";
import { createErrorResponse } from "../shared/utils";

/**
 * Tool for reading and retrieving doctrine information from a URL.
 * 
 * This tool crawls a doctrine URL and extracts its content in a structured format.
 * The content is returned in markdown/text format, suitable for analysis and application.
 * 
 * @remarks
 * - Supports any publicly accessible URL
 * - Returns formatted content with metadata (title, author, description)
 * - Excludes navigation, headers, footers, and other non-content elements
 * - Perfect for reading doctrine before applying it to escritos
 * - Returns error messages as formatted strings instead of throwing
 * 
 * @example
 * ```typescript
 * const content = await readDoctrineTool.handler(ctx, {
 *   url: "https://www.saij.gob.ar/some-doctrine-article"
 * });
 * ```
 */
export const readDoctrineTool = createTool({
    description: "Tool for reading and retrieving doctrine information. Supports reading by URL. Returns doctrine content without raw content or IDs. Perfect for reading doctrine before applying it to escritos.",
    args: z.object({
        url: z.string().describe("URL of the doctrine to read"),
    }).required({url: true}),
    handler: async (ctx, args) => {
        try {
            // Validate URL format
            if (!args.url || typeof args.url !== 'string' || args.url.trim().length === 0) {
                return createErrorResponse("La URL proporcionada es inválida. Debe ser una URL no vacía.");
            }

            // Basic URL validation
            try {
                new URL(args.url);
            } catch (urlError) {
                return createErrorResponse(`Formato de URL inválido: ${args.url}\n\nAsegúrate de incluir el protocolo (https://) y que la URL sea válida.`);
            }

            const result: string[] = await ctx.runAction(internal.agents.tools.doctrine.utils.crawlUrl, {
                url: args.url,
            });

            // Validate result
            if (!result || result.length === 0) {
                return createErrorResponse(`No se pudo extraer contenido de la URL: ${args.url}\n\nPosibles causas:\n- La página no existe o no es accesible\n- El contenido está protegido o requiere autenticación\n- La estructura de la página no es compatible`);
            }

            return result.join("\n\n---\n\n");
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Error desconocido";
            console.error("Error reading doctrine:", errorMessage);
            return createErrorResponse(`No se pudo leer la doctrina: ${errorMessage}\n\nIntenta con otra URL o verifica que la página sea accesible.`);
        }
    }
})