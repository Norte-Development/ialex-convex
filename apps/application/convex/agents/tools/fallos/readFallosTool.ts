import { createTool, ToolCtx } from "@convex-dev/agent";
import { api } from "../../../_generated/api";
import { z } from "zod";
import { createErrorResponse, validateStringParam, validateNumberParam } from "../shared/utils";

/**
 * Tool for reading fallos documents progressively, chunk by chunk.
 * Use this to read through entire fallos documents sequentially without overwhelming token limits.
 * Perfect for systematic fallos analysis.
 *
 * @description Reads a fallo document progressively, chunk by chunk. Use this to read through entire fallos documents sequentially without overwhelming token limits. Perfect for systematic fallos analysis.
 * @param {Object} args - Reading parameters
 * @param {string} args.documentId - The ID of the fallo document to read (this is the document_id field in the fallos collection)
 * @param {number} [args.chunkIndex=0] - Which chunk to read (0-based index). Start with 0 for the beginning.
 * @param {number} [args.chunkCount=1] - Number of consecutive chunks to read (default: 1). Use higher values to read multiple chunks at once.
 * @returns {Promise<Object>} Document chunk information including content, progress, and navigation details
 * @throws {Error} When user is not authenticated, document not found, or chunk index is invalid
 *
 * @example
 * // Read the first chunk of a fallo document
 * await readFallosTool.handler(ctx, {
 *   documentId: "fallo_123",
 *   chunkIndex: 0
 * });
 *
 * // Read multiple chunks starting from index 5
 * await readFallosTool.handler(ctx, {
 *   documentId: "fallo_123",
 *   chunkIndex: 5,
 *   chunkCount: 3
 * });
 */
export const readFallosTool = createTool({
  description: "Read a fallo document progressively, chunk by chunk. Use this to read through entire fallos documents sequentially without overwhelming token limits. Perfect for systematic fallos analysis.",
  args: z.object({
    documentId: z.any().describe("The ID of the fallo document to read (this is the document_id field in the fallos collection)"),
    chunkIndex: z.any().optional().describe("Which chunk to read (0-based index). Start with 0 for the beginning."),
    chunkCount: z.any().optional().describe("Number of consecutive chunks to read (default: 1). Use higher values to read multiple chunks at once."),
    contextWindow: z.any().optional().describe("Optional number of adjacent chunks to include on both sides for additional context.")
  }).required({documentId: true}),
  handler: async (ctx: ToolCtx, args: any) => {
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
      const chunkIndex = args.chunkIndex !== undefined ? args.chunkIndex : 0;
      const chunkCount = args.chunkCount !== undefined ? args.chunkCount : 1;
      const contextWindow = args.contextWindow !== undefined ? args.contextWindow : 0;
      
      // Verify authentication
      if (!ctx.userId) {
        return createErrorResponse("No autenticado");
      }

      // Get document metadata to verify it exists and get title
      const fallo = await ctx.runAction(api.functions.fallos.getFallo, {
        documentId: documentId,
      });

      if (!fallo) {
        return createErrorResponse("Fallo no encontrado");
      }

      // Get total chunks from Qdrant
      const totalChunks = await ctx.runAction(api.rag.qdrantUtils.fallos.getFalloChunkCount, {
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
      const chunksContent = await ctx.runAction(api.rag.qdrantUtils.fallos.getFalloChunksByRange, {
        document_id: documentId,
        startIndex: effectiveStartIndex,
        endIndex: effectiveEndIndex
      });

      if (!chunksContent || chunksContent.length === 0) {
        return createErrorResponse(`No se encontraron fragmentos en el rango ${chunkIndex} a ${chunkIndex + actualChunkCount - 1}`);
      }

      // Combine chunks content
      const combinedContent = chunksContent.join('\n\n');

      return `# 📖 Lectura de Fallo

## Información del Documento
- **ID del Documento**: ${documentId}
- **Título**: ${fallo.title || "Fallo Jurisprudencial"}
- **Tribunal**: ${fallo.tribunal || 'N/A'}
- **Jurisdicción**: ${fallo.jurisdiccion || 'N/A'}
- **Fecha**: ${fallo.date ? new Date(fallo.date).toLocaleDateString() : 'N/A'}
- **Actor**: ${fallo.actor || 'N/A'}
- **Demandado**: ${fallo.demandado || 'N/A'}
- **Magistrados**: ${fallo.magistrados || 'N/A'}
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
*Fallo leído progresivamente.*`;
    } catch (error) {
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }
} as any);
