import { createTool, ToolCtx, getThreadMetadata } from "@convex-dev/agent";
import { components } from "../../../_generated/api";
import { api, internal } from "../../../_generated/api";
import { z } from "zod";
import { getUserAndCaseIds, createErrorResponse, validateStringParam, validateNumberParam } from "../utils";
import { Id } from "../../../_generated/dataModel";

/**
 * Tool for querying and reading documents with multiple modes.
 * Supports semantic search, progressive reading, and direct document access.
 *
 * @description Queries and reads documents with multiple modes. Supports semantic search within documents, progressive chunk-by-chunk reading, and direct document access. Perfect for finding specific information or systematically reading through documents.
 * @param {Object} args - Query parameters
 * @param {string} args.documentId - The ID of the document to work with
 * @param {string} [args.mode="search"] - Mode: "search" (semantic search), "read" (progressive reading), or "full" (read entire document)
 * @param {string} [args.query] - Search query for semantic search mode
 * @param {number} [args.chunkIndex=0] - Starting chunk index for read mode (0-based)
 * @param {number} [args.chunkCount=1] - Number of chunks to read in read mode
 * @param {number} [args.limit=5] - Maximum results for search mode (default: 5)
 * @returns {Promise<Object>} Document content, search results, or reading progress
 * @throws {Error} When user is not authenticated, not in case context, document not found, or operation fails
 *
 * @example
 * // Semantic search within a document
 * await queryDocumentTool.handler(ctx, {
 *   documentId: "doc_123",
 *   mode: "search",
 *   query: "payment terms and conditions",
 *   limit: 3
 * });
 *
 * // Read document progressively
 * await queryDocumentTool.handler(ctx, {
 *   documentId: "doc_123",
 *   mode: "read",
 *   chunkIndex: 0,
 *   chunkCount: 3
 * });
 */
export const queryDocumentTool = createTool({
  description: "Query and read documents with multiple modes. Supports semantic search, progressive reading, and direct document access. Perfect for finding specific information or systematically reading through documents.",
  args: z.object({
    documentId: z.any().describe("The ID of the document to work with"),
    mode: z.any().optional().describe("Mode: 'search' (semantic search), 'read' (progressive reading), or 'full' (read entire document). Default: 'search'"),
    query: z.any().optional().describe("Search query for semantic search mode"),
    chunkIndex: z.any().optional().describe("Starting chunk index for read mode (0-based, default: 0)"),
    chunkCount: z.any().optional().describe("Number of chunks to read in read mode (default: 1)"),
    limit: z.any().optional().describe("Maximum results for search mode (default: 5)")
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

      const documentId = args.documentId.trim();
      const mode = args.mode || "search";

      // Validate mode-specific parameters
      if (mode === "search") {
        const queryError = validateStringParam(args.query, "query");
        if (queryError) return queryError;
      }

      const limitError = validateNumberParam(args.limit, "limit", 1, 20, 5);
      if (limitError) return limitError;

      const chunkIndexError = validateNumberParam(args.chunkIndex, "chunkIndex", 0, Infinity, 0);
      if (chunkIndexError) return chunkIndexError;

      const chunkCountError = validateNumberParam(args.chunkCount, "chunkCount", 1, 10, 1);
      if (chunkCountError) return chunkCountError;

      const query = args.query ? args.query.trim() : "";
      const limit = args.limit !== undefined ? args.limit : 5;
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
        return createErrorResponse(`El documento no está listo para operaciones. Estado: ${document.processingStatus}`);
      }

      // Handle different modes
      if (mode === "search") {
        // Perform semantic search within the specific document
        const searchResults = await ctx.runAction(api.rag.qdrantUtils.caseDocuments.searchDocumentChunks, {
          documentId,
          caseId,
          query,
          limit
        });

        if (!searchResults || searchResults.length === 0) {
          return `# 🔍 Consulta de Documento - Sin Resultados

## Información del Documento
- **ID del Documento**: ${documentId}
- **Título**: ${document.title}

## Consulta
**Término de búsqueda**: "${query}"

## Resultados
No se encontró contenido relevante para la consulta en este documento.

---
*Búsqueda semántica realizada en el documento.*`;
        }

        return `# 🔍 Consulta de Documento

## Información del Documento
- **ID del Documento**: ${documentId}
- **Título**: ${document.title}

## Consulta
**Término de búsqueda**: "${query}"

## Estadísticas
- **Resultados encontrados**: ${searchResults.length}
- **Límite de resultados**: ${limit}

## Resultados Relevantes
${searchResults.map((result, index) => `
### ${index + 1}. Fragmento ${result.chunkIndex || 'N/A'}
- **Puntuación de Relevancia**: ${result.score ? result.score.toFixed(3) : 'N/A'}
- **Contenido**: ${result.text || 'Sin contenido disponible'}
`).join('\n')}

---
*Búsqueda semántica realizada en el documento.*`;
      } else if (mode === "read") {
        // Progressive reading mode
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
      } else {
        return createErrorResponse(`Modo no soportado: ${mode}. Use 'search' o 'read'.`);
      }
    } catch (error) {
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }
} as any);
