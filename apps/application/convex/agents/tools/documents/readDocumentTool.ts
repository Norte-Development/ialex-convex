import { createTool, ToolCtx, getThreadMetadata } from "@convex-dev/agent";
import { components } from "../../../_generated/api";
import { api, internal } from "../../../_generated/api";
import { z } from "zod";
import { getUserAndCaseIds, createErrorResponse, validateStringParam, validateNumberParam } from "../shared/utils";
import { Id } from "../../../_generated/dataModel";

/**
 * Tool for reading a document progressively, chunk by chunk.
 * Use this to read through entire documents sequentially without overwhelming token limits.
 * Perfect for systematic document analysis.
 *
 * @description Reads a document progressively, chunk by chunk. Use this tool when you need to systematically read through case documents without overwhelming token limits. Perfect for comprehensive document analysis, reviewing evidence, or understanding complete document content. Start with chunkIndex 0 and increment to read sequentially through the document.
 * @param {Object} args - Reading parameters
 * @param {string} args.documentId - The ID of the document to read
 * @param {number} [args.chunkIndex=0] - Which chunk to read (0-based index). Start with 0 for the beginning.
 * @param {number} [args.chunkCount=1] - Number of consecutive chunks to read (default: 1). Use higher values to read multiple chunks at once.
 * @returns {Promise<Object>} Document chunk information including content, progress, and navigation details
 * @throws {Error} When user is not authenticated, not in case context, document not found, or chunk index is invalid
 *
 * @example
 * // Read the first chunk of a document
 * await readDocumentTool.handler(ctx, {
 *   documentId: "doc_123",
 *   chunkIndex: 0
 * });
 *
 * // Read multiple chunks starting from index 5
 * await readDocumentTool.handler(ctx, {
 *   documentId: "doc_123",
 *   chunkIndex: 5,
 *   chunkCount: 3
 * });
 */
export const readDocumentTool = createTool({
  description: "Read a document progressively, chunk by chunk. Use this tool when you need to systematically read through case documents without overwhelming token limits. Perfect for comprehensive document analysis, reviewing evidence, or understanding complete document content. Start with chunkIndex 0 and increment to read sequentially through the document.",
  args: z.object({
    documentId: z.any().describe("The ID of the document to read"),
    chunkIndex: z.any().optional().describe("Which chunk to read (0-based index). Start with 0 for the beginning."),
    chunkCount: z.any().optional().describe("Number of consecutive chunks to read (default: 1). Use higher values to read multiple chunks at once.")
  }).required({documentId: true}),
  handler: async (ctx: ToolCtx, args: any) => {
    try {
      const {caseId, userId} = getUserAndCaseIds(ctx.userId as string);
      
      await ctx.runQuery(internal.auth_utils.internalCheckNewCaseAccess,{
        userId: userId as Id<"users">,
        caseId: caseId as Id<"cases">,
        requiredLevel: "basic"
      } )

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

      // Verify authentication using agent context
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

      // Get document metadata using internal helper (bypasses permission checks)
      const document = await ctx.runQuery(internal.functions.documents.getDocumentForAgent, {
        documentId: documentId as any
      });

      if (!document) {
        return createErrorResponse("Documento no encontrado");
      }

      // Verify document belongs to the current case
      if (document.caseId !== caseId) {
        return createErrorResponse("El documento no pertenece al caso actual");
      }

      // Check if document is processed
      if (document.processingStatus !== "completed") {
        return createErrorResponse(`El documento no está listo para lectura. Estado: ${document.processingStatus}`);
      }

      // Get total chunks (prefer DB field, fallback to Qdrant count)
      let totalChunks = document.totalChunks || 0;
      if (totalChunks === 0) {
        totalChunks = await ctx.runAction(api.rag.qdrantUtils.caseDocuments.getDocumentChunkCount, {
          documentId,
          caseId
        });
      }

      // Validate chunk index
      if (chunkIndex >= totalChunks) {
        return createErrorResponse(`Índice de fragmento ${chunkIndex} está más allá de la longitud del documento (${totalChunks} fragmentos)`);
      }

      // Calculate the actual number of chunks to read
      const actualChunkCount = Math.min(chunkCount, totalChunks - chunkIndex);

      // Fetch multiple chunks from Qdrant
      const chunksContent = await ctx.runAction(api.rag.qdrantUtils.caseDocuments.getDocumentChunksByRange, {
        documentId,
        caseId,
        startIndex: chunkIndex,
        endIndex: chunkIndex + actualChunkCount - 1
      });

      if (!chunksContent || chunksContent.length === 0) {
        return createErrorResponse(`No se encontraron fragmentos en el rango ${chunkIndex} a ${chunkIndex + actualChunkCount - 1}`);
      }

      // Combine chunks content
      const combinedContent = chunksContent.join('\n\n');

      return `# 📖 Lectura de Documento

## Información del Documento
- **ID del Documento**: ${documentId}
- **Título**: ${document.title}
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
*Documento leído progresivamente.*`;
    } catch (error) {
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }
} as any);
