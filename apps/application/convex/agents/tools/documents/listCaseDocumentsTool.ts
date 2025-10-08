import { createTool, ToolCtx, getThreadMetadata } from "@convex-dev/agent";
import { components } from "../../../_generated/api";
import { internal } from "../../../_generated/api";
import { z } from "zod";
import { getUserAndCaseIds, createErrorResponse } from "../shared/utils";
import { Id } from "../../../_generated/dataModel";

/**
 * Tool for listing all documents in the current case with their processing status and chunk counts.
 * Use this to see what documents are available for reading.
 *
 * @description Lists all documents in the current case with their processing status and chunk counts. Use this to see what documents are available for reading.
 * @param {Object} args - No parameters required
 * @returns {Promise<Object>} Summary and list of all documents in the current case
 * @throws {Error} When user is not authenticated or not in a case context
 *
 * @example
 * // List all documents in the current case
 * await listCaseDocumentsTool.handler(ctx, {});
 *
 * // Returns:
 * // {
 * //   summary: {
 * //     totalDocuments: 5,
 * //     readableDocuments: 3,
 * //     processingDocuments: 1,
 * //     failedDocuments: 1
 * //   },
 * //   documents: [
 * //     {
 * //       documentId: "doc_123",
 * //       title: "Contract Agreement",
 * //       fileName: "contract.pdf",
 * //       documentType: "contract",
 * //       processingStatus: "completed",
 * //       totalChunks: 15,
 * //       canRead: true,
 * //       fileSize: 1024000,
 * //       createdAt: "2024-01-15T10:30:00.000Z"
 * //     }
 * //   ]
 * // }
 */
export const listCaseDocumentsTool = createTool({
  description: "List all documents in the current case with their processing status and chunk counts. Use this to see what documents are available for reading.",
  args: z.object({}),
  handler: async (ctx: ToolCtx, args: any) => {
    try {
      const {caseId, userId} = getUserAndCaseIds(ctx.userId as string);
      
      await ctx.runQuery(internal.auth_utils.internalCheckNewCaseAccess,{
        userId: userId as Id<"users">,
        caseId: caseId as Id<"cases">,
        requiredLevel: "basic"
      } )

      // Extract caseId from thread metadata
      if (!ctx.threadId) {
        return createErrorResponse("No hay contexto de hilo disponible");
      }

      const { userId: threadUserId } = await getThreadMetadata(ctx, components.agent, { threadId: ctx.threadId });

      // Extract caseId from threadUserId format: "case:${caseId}_${userId}"
      if (!threadUserId?.startsWith("case:")) {
        return createErrorResponse("Esta herramienta solo puede usarse dentro de un contexto de caso");
      }

      // Get all documents for this case using internal helper (bypasses permission checks)
      const documents = await ctx.runQuery(internal.functions.documents.getDocumentsForAgent, {
        caseId: caseId as any
      });

      // Format document information for the agent
      const documentList = documents.map(doc => ({
        documentId: doc._id,
        title: doc.title,
        fileName: doc.originalFileName,
        documentType: doc.documentType || "other",
        processingStatus: doc.processingStatus,
        totalChunks: doc.totalChunks || 0,
        canRead: doc.processingStatus === "completed" && (doc.totalChunks || 0) > 0,
        fileSize: doc.fileSize,
        createdAt: new Date(doc._creationTime).toISOString()
      }));

      const summary = {
        totalDocuments: documentList.length,
        readableDocuments: documentList.filter(d => d.canRead).length,
        processingDocuments: documentList.filter(d => d.processingStatus === "processing").length,
        failedDocuments: documentList.filter(d => d.processingStatus === "failed").length
      };

      return `# 📁 Documentos del Caso

## Resumen
- **Total de Documentos**: ${summary.totalDocuments}
- **Documentos Legibles**: ${summary.readableDocuments}
- **Documentos en Procesamiento**: ${summary.processingDocuments}
- **Documentos Fallidos**: ${summary.failedDocuments}

## Lista de Documentos
${documentList.length === 0 ? 'No hay documentos en este caso.' : documentList.map((doc, index) => `
### ${index + 1}. ${doc.title || 'Sin título'}
- **ID del Documento**: ${doc.documentId}
- **Nombre del Archivo**: ${doc.fileName || 'N/A'}
- **Tipo de Documento**: ${doc.documentType}
- **Estado de Procesamiento**: ${doc.processingStatus}
- **Total de Fragmentos**: ${doc.totalChunks}
- **¿Se Puede Leer?**: ${doc.canRead ? 'Sí' : 'No'}
- **Tamaño del Archivo**: ${doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : 'N/A'}
- **Fecha de Creación**: ${new Date(doc.createdAt).toLocaleDateString()}
`).join('\n')}

---
*Lista de documentos del caso actual.*`;
    } catch (error) {
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }
} as any);
