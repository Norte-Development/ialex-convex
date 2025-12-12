import { createTool, ToolCtx } from "@convex-dev/agent";
import { api, internal } from "../../../_generated/api";
import { z } from "zod";
import { createErrorResponse, validateStringParam, validateNumberParam, getUserAndCaseIds } from "../shared/utils";
import { Id } from "../../../_generated/dataModel";

/**
 * Tool for reading a library document progressively, chunk by chunk.
 * Use this to read through entire library documents sequentially without overwhelming token limits.
 * Perfect for systematic document analysis.
 *
 * @description Reads a library document progressively, chunk by chunk. Use this tool when you need to systematically read through library documents without overwhelming token limits. Perfect for comprehensive document analysis, reviewing reference materials, or understanding complete document content. Start with chunkIndex 0 and increment to read sequentially through the document.
 * @param {Object} args - Reading parameters
 * @param {string} args.documentId - The ID of the library document to read
 * @param {number} [args.chunkIndex=0] - Which chunk to read (0-based index). Start with 0 for the beginning.
 * @param {number} [args.chunkCount=1] - Number of consecutive chunks to read (default: 1). Use higher values to read multiple chunks at once.
 * @returns {Promise<Object>} Document chunk information including content, progress, and navigation details
 * @throws {Error} When user is not authenticated, document not found, or chunk index is invalid
 *
 * @example
 * // Read the first chunk of a library document
 * await readLibraryDocumentTool.handler(ctx, {
 *   documentId: "lib_doc_123",
 *   chunkIndex: 0
 * });
 *
 * // Read multiple chunks starting from index 5
 * await readLibraryDocumentTool.handler(ctx, {
 *   documentId: "lib_doc_123",
 *   chunkIndex: 5,
 *   chunkCount: 3
 * });
 */
export const readLibraryDocumentTool = createTool({
  description: "Read a library document progressively, chunk by chunk. Use this tool when you need to systematically read through library documents without overwhelming token limits. Perfect for comprehensive analysis of reference materials, templates, and knowledge base articles. Start with chunkIndex 0 and increment to read sequentially.",
  args: z.object({
    documentId: z.any().describe("The ID of the library document to read"),
    chunkIndex: z.any().optional().describe("Which chunk to read (0-based index). Start with 0 for the beginning."),
    chunkCount: z.any().optional().describe("Number of consecutive chunks to read (default: 1). Use higher values to read multiple chunks at once.")
  }).required({documentId: true}),
  handler: async (ctx: ToolCtx, args: any) => {
    try {
      // Verify authentication using agent context
      if (!ctx.userId) {
        return createErrorResponse("No autenticado");
      }

      // Extract userId from agent context using shared utility
      const {caseId, userId} = getUserAndCaseIds(ctx.userId as string);

      // Validate inputs in handler
      const documentIdError = validateStringParam(args.documentId, "documentId");
      if (documentIdError) return documentIdError;

      const chunkIndexError = validateNumberParam(args.chunkIndex, "chunkIndex", 0, Infinity, 0);
      if (chunkIndexError) return chunkIndexError;

      const chunkCountError = validateNumberParam(args.chunkCount, "chunkCount", 1, 10, 1);
      if (chunkCountError) return chunkCountError;

      const documentId = args.documentId.trim();
      const chunkIndex = args.chunkIndex !== undefined ? args.chunkIndex : 0;
      const chunkCount = args.chunkCount !== undefined ? args.chunkCount : 1;

      console.log("Reading library document:", { documentId, chunkIndex, chunkCount });

      // Get library document metadata (includes permission check)
      const document = await ctx.runQuery(internal.functions.libraryDocument.getLibraryDocumentForAgent, {
        documentId: documentId as Id<"libraryDocuments">
      });

      if (!document) {
        return createErrorResponse("Documento de biblioteca no encontrado o no tienes acceso");
      }

      // Check if document is processed
      if (document.processingStatus !== "completed") {
        return createErrorResponse(`El documento no está listo para lectura. Estado: ${document.processingStatus || 'desconocido'}`);
      }

      // Get total chunks (prefer DB field, fallback to Qdrant count)
      let totalChunks = document.totalChunks || 0;
      if (totalChunks === 0) {
        totalChunks = await ctx.runAction(api.rag.qdrantUtils.libraryDocuments.getLibraryDocumentChunkCount, {
          libraryDocumentId: documentId
        });
      }

      // Validate chunk index
      if (chunkIndex >= totalChunks) {
        return createErrorResponse(`Índice de fragmento ${chunkIndex} está más allá de la longitud del documento (${totalChunks} fragmentos)`);
      }

      // Calculate the actual number of chunks to read
      const actualChunkCount = Math.min(chunkCount, totalChunks - chunkIndex);

      // Fetch multiple chunks from Qdrant
      const chunksContent = await ctx.runAction(api.rag.qdrantUtils.libraryDocuments.getLibraryDocumentChunksByRange, {
        libraryDocumentId: documentId,
        startIndex: chunkIndex,
        endIndex: chunkIndex + actualChunkCount - 1
      });

      if (!chunksContent || chunksContent.length === 0) {
        return createErrorResponse(`No se encontraron fragmentos en el rango ${chunkIndex} a ${chunkIndex + actualChunkCount - 1}`);
      }

      // Combine chunks content
      const combinedContent = chunksContent.join('\n\n');

      // Build citation for the library document
      const citation = {
        id: documentId,
        type: "doc" as const,
        title: document.title || document.description || "Documento de biblioteca",
      };

      const markdown = `# 📖 Lectura de Documento de Biblioteca

## Información del Documento
- **ID del Documento**: ${documentId}
- **Título**: ${document.title}
- **Ámbito**: ${document.teamId ? 'Equipo' : 'Personal'}
- **Fragmentos Totales**: ${totalChunks}

## Progreso de Lectura
- **Fragmento Actual**: ${chunkIndex + 1}
- **Fragmentos Leídos**: ${actualChunkCount}
- **Progreso**: ${chunkIndex + actualChunkCount}/${totalChunks}
- **¿Hay Más Fragmentos?**: ${chunkIndex + actualChunkCount < totalChunks ? 'Sí' : 'No'}
- **¿Es el Último Fragmento?**: ${chunkIndex + actualChunkCount >= totalChunks ? 'Sí' : 'No'}
${chunkIndex + actualChunkCount < totalChunks ? `- **Siguiente Fragmento**: ${chunkIndex + actualChunkCount}` : ''}

## Contenido
${combinedContent || 'Sin contenido disponible'}

---
*Para continuar leyendo, usa el mismo tool con chunkIndex: ${chunkIndex + actualChunkCount}*`;

      console.log(`📚 [Citations] Creating citation for library document read`);
      console.log(`  📖 Citation created:`, citation);
      console.log(`📤 [Citations] Returning tool output with 1 citation`);
      return { markdown, citations: [citation] };
    } catch (error) {
      console.error("Error in readLibraryDocumentTool:", error);
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }
} as any);

