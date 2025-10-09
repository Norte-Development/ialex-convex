import { createTool, ToolCtx } from "@convex-dev/agent";
import { api, internal } from "../../../_generated/api";
import { z } from "zod";
import { createErrorResponse } from "../shared/utils";
import { Id } from "../../../_generated/dataModel";

/**
 * Tool for listing all library documents accessible to the user with their processing status and chunk counts.
 * Includes both personal library and team libraries. Use this to see what documents are available for reading.
 *
 * @description Lists all library documents accessible to you with their processing status and chunk counts. Includes both your personal library and all team libraries you have access to. Use this to see what documents are available for reading.
 * @param {Object} args - No parameters required
 * @returns {Promise<Object>} Summary and list of all accessible library documents
 * @throws {Error} When user is not authenticated
 *
 * @example
 * // List all accessible library documents
 * await listLibraryDocumentsTool.handler(ctx, {});
 *
 * // Returns:
 * // {
 * //   summary: {
 * //     totalDocuments: 12,
 * //     personalDocuments: 5,
 * //     teamDocuments: 7,
 * //     readableDocuments: 10,
 * //     processingDocuments: 1,
 * //     failedDocuments: 1
 * //   },
 * //   documents: [...]
 * // }
 */
export const listLibraryDocumentsTool = createTool({
  description: "List all library documents accessible to you with their processing status and chunk counts. Includes both your personal library and all team libraries you have access to. Use this to see what reference documents, templates, and knowledge base articles are available.",
  args: z.object({}),
  handler: async (ctx: ToolCtx, args: any) => {
    try {
      // Verify authentication using agent context
      if (!ctx.userId) {
        return createErrorResponse("No autenticado");
      }

      // Extract userId from agent context
      let userId: string;
      
      if (ctx.userId.startsWith("case:")) {
        const parts = ctx.userId.split("_");
        userId = parts[parts.length - 1];
      } else if (ctx.userId.startsWith("home_")) {
        userId = ctx.userId.replace("home_", "");
      } else {
        userId = ctx.userId;
      }

      console.log("Listing library documents for user:", userId);

      // Get all accessible library documents (personal + team libraries)
      const documents = await ctx.runQuery(api.functions.libraryDocument.getAllAccessibleLibraryDocuments, {});

      // Format document information for the agent
      const documentList = documents.map(doc => ({
        documentId: doc._id,
        title: doc.title,
        description: doc.description || "Sin descripción",
        scope: doc.teamId ? "Equipo" : "Personal",
        processingStatus: doc.processingStatus || "unknown",
        // totalChunks: doc.totalChunks || 0,
        canRead: (doc.processingStatus === "completed" || !doc.processingStatus),
        fileSize: doc.fileSize,
        tags: doc.tags || [],
        createdAt: new Date(doc._creationTime).toISOString()
      }));

      const summary = {
        totalDocuments: documentList.length,
        personalDocuments: documentList.filter(d => d.scope === "Personal").length,
        teamDocuments: documentList.filter(d => d.scope === "Equipo").length,
        readableDocuments: documentList.filter(d => d.canRead).length,
        processingDocuments: documentList.filter(d => d.processingStatus === "processing").length,
        failedDocuments: documentList.filter(d => d.processingStatus === "failed").length
      };

      return `# 📚 Documentos de Biblioteca

## Resumen
- **Total de Documentos**: ${summary.totalDocuments}
- **Documentos Personales**: ${summary.personalDocuments}
- **Documentos de Equipo**: ${summary.teamDocuments}
- **Documentos Legibles**: ${summary.readableDocuments}
- **Documentos en Procesamiento**: ${summary.processingDocuments}
- **Documentos Fallidos**: ${summary.failedDocuments}

## Lista de Documentos
${documentList.length === 0 ? 'No hay documentos en tu biblioteca.' : documentList.map((doc, index) => `
### ${index + 1}. ${doc.title || 'Sin título'}
- **ID del Documento**: ${doc.documentId}
- **Ámbito**: ${doc.scope}
- **Descripción**: ${doc.description}
- **Estado de Procesamiento**: ${doc.processingStatus}
- **Total de Fragmentos**:
- **¿Se Puede Leer?**: ${doc.canRead ? 'Sí' : 'No'}
- **Tamaño del Archivo**: ${doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : 'N/A'}
- **Etiquetas**: ${doc.tags.length > 0 ? doc.tags.join(', ') : 'Sin etiquetas'}
- **Fecha de Creación**: ${new Date(doc.createdAt).toLocaleDateString()}
`).join('\n')}

---
*Lista de documentos de tu biblioteca personal y de equipos.*`;
    } catch (error) {
      console.error("Error in listLibraryDocumentsTool:", error);
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }
} as any);

