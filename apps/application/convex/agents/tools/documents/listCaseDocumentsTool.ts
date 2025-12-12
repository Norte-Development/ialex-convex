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
  args: z.object({
    caseId: z.any().optional().describe("Optional case ID. If provided, will use this case instead of extracting from context. Used for WhatsApp agent.")
  }),
  handler: async (ctx: ToolCtx, args: any) => {
    try {
      // Get userId first
      const userAndCase = getUserAndCaseIds(ctx.userId as string);
      let userId = userAndCase.userId;
      let caseId: string | null = null;

      // First, try to extract caseId from thread metadata (takes precedence)
      if (ctx.threadId) {
        try {
          const { userId: threadUserId } = await getThreadMetadata(ctx, components.agent, { threadId: ctx.threadId });
          
          // Extract caseId from threadUserId format: "case:${caseId}_${userId}"
          if (threadUserId?.startsWith("case:")) {
            const threadUserAndCase = getUserAndCaseIds(threadUserId);
            caseId = threadUserAndCase.caseId;
          }
        } catch (error) {
          // If thread metadata extraction fails, continue to fallback
        }
      }

      // If no caseId from context, use the one from args (for WhatsApp agent)
      if (!caseId && args.caseId) {
        caseId = args.caseId;
      }

      // If still no caseId, try to get it from ctx.userId
      if (!caseId) {
        caseId = userAndCase.caseId;
      }
      
      if (!caseId || !userId){
        return createErrorResponse("Contexto de usuario inválido");
      }
      
      await ctx.runQuery(internal.auth_utils.internalCheckNewCaseAccess,{
        userId: userId as Id<"users">,
        caseId: caseId as Id<"cases">,
        requiredLevel: "basic"
      } )

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

      const markdown = `# 📁 Documentos del Caso

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

      // Build citations array from all documents
      console.log(`📚 [Citations] Creating citations from ${documentList.length} listed documents`);
      const citations = documentList.map((doc) => {
        const citation = {
          id: doc.documentId,
          type: 'case-doc' as const,
          title: doc.title || 'Documento sin título',
        };
        console.log(`  📖 Citation created:`, citation);
        return citation;
      });
      console.log(`✅ [Citations] Total citations created: ${citations.length}`);

      // Return structured JSON with markdown and citations (matching legislation/fallos pattern)
      if (citations.length > 0) {
        console.log(`📤 [Citations] Returning tool output with ${citations.length} citations`);
        return { markdown, citations };
      }

      return markdown;
    } catch (error) {
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }
} as any);
