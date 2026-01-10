import { createTool, ToolCtx } from "@convex-dev/agent";
import { api } from "../../../_generated/api";
import { z } from "zod";
import { createErrorResponse, validateStringParam, validateNumberParam } from "../shared/utils";

/**
 * Return type for the legislationReadTool handler.
 * Returns a markdown-formatted string containing either:
 * - Success: Document information, reading progress, and chunk content
 * - Error: Formatted error message
 */
export type LegislationReadToolResult = string;

/**
 * Tool for reading legislation documents progressively, chunk by chunk.
 * Use this to read through entire legislation documents sequentially without overwhelming token limits.
 * Perfect for systematic legislation analysis.
 *
 * @description Reads a legislation document progressively, chunk by chunk. Use this to read through entire legislation documents sequentially without overwhelming token limits. Perfect for systematic legislation analysis.
 * @param {Object} args - Reading parameters
 * @param {string} args.documentId - The ID of the legislation document to read (this is the document_id field in the legislation collection)
 * @param {number} [args.chunkIndex=0] - Which chunk to read (0-based index). Start with 0 for the beginning.
 * @param {number} [args.chunkCount=1] - Number of consecutive chunks to read (default: 1). Use higher values to read multiple chunks at once.
 * @returns {Promise<Object>} Document chunk information including content, progress, and navigation details
 * @throws {Error} When user is not authenticated, document not found, or chunk index is invalid
 *
 * @example
 * // Read the first chunk of a legislation document
 * await legislationReadTool.handler(ctx, {
 *   documentId: "leg_123",
 *   chunkIndex: 0
 * });
 *
 * // Read multiple chunks starting from index 5
 * await legislationReadTool.handler(ctx, {
 *   documentId: "leg_123",
 *   chunkIndex: 5,
 *   chunkCount: 3
 * });
 */
/**
 * Schema for legislationReadTool arguments
 */
const legislationReadToolArgs = z.object({
  documentId: z.string().describe("The ID of the legislation document to read (this is the document_id field in the legislation collection)"),
  chunkIndex: z.number().int().min(0).default(0).describe("Which chunk to read (0-based index). Start with 0 for the beginning."),
  chunkCount: z.number().int().min(1).max(10).default(1).describe("Number of consecutive chunks to read (default: 1). Use higher values to read multiple chunks at once."),
  contextWindow: z.number().int().min(0).max(10).default(0).describe("Optional number of adjacent chunks to include on both sides for additional context.")
});

/**
 * Type for legislationReadTool arguments
 */
type LegislationReadToolArgs = z.infer<typeof legislationReadToolArgs>;

export const legislationReadTool = createTool({
  description: "Read a legislation document progressively, chunk by chunk. Use this to read through entire legislation documents sequentially without overwhelming token limits. Perfect for systematic legislation analysis.",
  args: legislationReadToolArgs,
  handler: async (ctx: ToolCtx, args: LegislationReadToolArgs): Promise<LegislationReadToolResult> => {
    try {
      // Validate inputs in handler
      const documentIdError = validateStringParam(args.documentId, "documentId");
      if (documentIdError) return documentIdError;

      const chunkIndexError = validateNumberParam(args.chunkIndex, "chunkIndex", 0, Infinity, 0);
      if (chunkIndexError) return chunkIndexError;

      const chunkCountError = validateNumberParam(args.chunkCount, "chunkCount", 1, 10, 1);
      if (chunkCountError) return chunkCountError;

      const contextWindowError = validateNumberParam(args.contextWindow, "contextWindow", 0, 10, 0);
      if (contextWindowError) return contextWindowError;

      const documentId = args.documentId.trim();
      const chunkIndex = args.chunkIndex ?? 0;
      const chunkCount = args.chunkCount ?? 1;
      const contextWindow = args.contextWindow ?? 0;
      
      // Verify authentication
      if (!ctx.userId) {
        return createErrorResponse("No autenticado");
      }

      // Get document metadata to verify it exists and get title
      const normative = await ctx.runAction(api.functions.legislation.getNormativeById, {
        jurisdiction: "",
        id: documentId,
      });

      if (!normative) {
        return createErrorResponse("Documento legislativo no encontrado");
      }

      // Get total chunks from Qdrant
      const totalChunks = await ctx.runAction(api.rag.qdrantUtils.legislation.getDocumentChunkCount, {
        document_id: documentId,
      });

      // Validate chunk index
      if (chunkIndex >= totalChunks) {
        return createErrorResponse(`Índice de fragmento ${chunkIndex} está más allá de la longitud del documento (${totalChunks} fragmentos)`);
      }

      // Calculate the actual number of chunks to read
      const actualChunkCount = Math.min(chunkCount, totalChunks - chunkIndex);

      // Compute effective range with optional context window
      const effectiveStartIndex = Math.max(0, chunkIndex - contextWindow);
      const effectiveEndIndex = Math.min(totalChunks - 1, chunkIndex + actualChunkCount - 1 + contextWindow);

      // Fetch multiple chunks from Qdrant
      const chunksContent = await ctx.runAction(api.rag.qdrantUtils.legislation.getDocumentChunksByRange, {
        document_id: documentId,
        startIndex: effectiveStartIndex,
        endIndex: effectiveEndIndex
      });

      if (!chunksContent || chunksContent.length === 0) {
        return createErrorResponse(`No se encontraron fragmentos en el rango ${chunkIndex} a ${chunkIndex + actualChunkCount - 1}`);
      }

      // Combine chunks content
      const combinedContent = chunksContent.join('\n\n');

      return `# 📖 Lectura de Documento Legislativo

## Información del Documento
- **ID del Documento**: ${documentId}
- **Título**: ${normative.title || "Documento Legislativo"}
- **Fragmentos Totales**: ${totalChunks}

## Progreso de Lectura
- **Fragmento Actual**: ${chunkIndex + 1}
- **Fragmentos Leídos**: ${actualChunkCount}
- **Progreso**: ${chunkIndex + actualChunkCount}/${totalChunks}
- **¿Hay Más Fragmentos?**: ${chunkIndex + actualChunkCount < totalChunks ? 'Sí' : 'No'}
- **¿Es el Último Fragmento?**: ${chunkIndex + actualChunkCount >= totalChunks ? 'Sí' : 'No'}

## Configuración de Lectura
- **Ventana de Contexto**: ${contextWindow}
- **Rango Expandido**: ${effectiveStartIndex} - ${effectiveEndIndex}
${chunkIndex + actualChunkCount < totalChunks ? `- **Siguiente Fragmento**: ${chunkIndex + actualChunkCount}` : ''}

## Contenido
${combinedContent || 'Sin contenido disponible'}

---
*Documento legislativo leído progresivamente.*`;
    } catch (error) {
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }
});
