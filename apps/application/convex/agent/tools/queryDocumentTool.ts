import { createTool, ToolCtx, getThreadMetadata } from "@convex-dev/agent";
import { components } from "../../_generated/api";
import { api, internal } from "../../_generated/api";
import { z } from "zod";
import { getUserAndCaseIds, createErrorResponse, validateStringParam, validateNumberParam } from "./utils";
import { Id } from "../../_generated/dataModel";

/**
 * Tool for querying a specific document using semantic search.
 * Searches within a single document to find the most relevant chunks based on a query.
 * Perfect for finding specific information within a large document.
 *
 * @description Queries a specific document using semantic search. Searches within a single document to find the most relevant chunks based on a query. Perfect for finding specific information within a large document.
 * @param {Object} args - Query parameters
 * @param {string} args.documentId - The ID of the document to search within
 * @param {string} args.query - The search query to find relevant content within the document
 * @param {number} [args.limit=5] - Maximum number of relevant chunks to return (default: 5)
 * @returns {Promise<Object>} Search results with relevant document chunks and metadata
 * @throws {Error} When user is not authenticated, not in case context, document not found, or search fails
 *
 * @example
 * // Search for contract terms in a specific document
 * await queryDocumentTool.handler(ctx, {
 *   documentId: "doc_123",
 *   query: "payment terms and conditions",
 *   limit: 3
 * });
 */
export const queryDocumentTool = createTool({
  description: "Query a specific document using semantic search. Searches within a single document to find the most relevant chunks based on a query. Perfect for finding specific information within a large document.",
  args: z.object({
    documentId: z.any().describe("The ID of the document to search within"),
    query: z.any().describe("The search query to find relevant content within the document"),
    limit: z.any().optional().describe("Maximum number of relevant chunks to return (default: 5)")
  }).required({documentId: true, query: true}),
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

      const queryError = validateStringParam(args.query, "query");
      if (queryError) return queryError;

      const limitError = validateNumberParam(args.limit, "limit", 1, 20, 5);
      if (limitError) return limitError;

      const documentId = args.documentId.trim();
      const query = args.query.trim();
      const limit = args.limit !== undefined ? args.limit : 5;

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
        return createErrorResponse(`El documento no está listo para consultas. Estado: ${document.processingStatus}`);
      }

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
    } catch (error) {
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }
} as any);
