import { createTool, ToolCtx } from "@convex-dev/agent";
import { internal } from "../../../_generated/api";
import { z } from "zod";
import { createErrorResponse, getUserAndCaseIds } from "../shared/utils";
import { Id } from "../../../_generated/dataModel";

/**
 * Citation type for library document citations
 */
interface LibraryDocumentCitation {
  id: string;
  type: "doc";
  title: string;
}

/**
 * Return type for listLibraryDocumentsTool handler.
 * Returns either a markdown string or an object with markdown and citations.
 */
export type ListLibraryDocumentsToolResult = string | { markdown: string; citations: LibraryDocumentCitation[] };

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
/**
 * Schema for listLibraryDocumentsTool arguments
 */
const listLibraryDocumentsToolArgs = z.object({
  limit: z.number().int().min(1).max(200).default(10).describe("Maximum number of documents to return (default: 10)"),
  offset: z.number().int().min(0).default(0).describe("Offset for pagination (default: 0)"),
});

/**
 * Type for listLibraryDocumentsTool arguments
 */
type ListLibraryDocumentsToolArgs = z.infer<typeof listLibraryDocumentsToolArgs>;

export const listLibraryDocumentsTool = createTool({
  description: "List all library documents accessible to you with their processing status and chunk counts. Includes both your personal library and all team libraries you have access to. Use this to see what reference documents, templates, and knowledge base articles are available.",
  args: listLibraryDocumentsToolArgs,
  handler: async (ctx: ToolCtx, args: ListLibraryDocumentsToolArgs): Promise<ListLibraryDocumentsToolResult> => {
    try {
      // Verify authentication using agent context
      if (!ctx.userId) {
        return createErrorResponse("No autenticado");
      }

      // Extract userId from agent context using shared utility
      const {caseId, userId} = getUserAndCaseIds(ctx.userId as string);

      console.log("Listing library documents for user:", userId);

      // Get all accessible library documents (personal + team libraries)
      const result = await ctx.runQuery(internal.functions.libraryDocument.getAllAccessibleLibraryDocumentsForAgent, {
        userId: userId as Id<"users">,
        limit: args.limit ?? 10,
        offset: args.offset ?? 0
      });

      // Format document information for the agent
      interface DocumentInfo {
        documentId: string;
        title: string;
        description: string;
        scope: string;
        processingStatus: string;
        totalChunks: number;
        canRead: boolean;
        fileSize?: number;
        tags: string[];
        createdAt: string;
      }
      const documentList: DocumentInfo[] = result.documents.map((doc: { _id: string; title: string; description?: string; teamId?: Id<"teams">; processingStatus?: string; totalChunks?: number; fileSize?: number; tags?: string[]; _creationTime: number }) => ({
        documentId: doc._id,
        title: doc.title,
        description: doc.description || "Sin descripción",
        scope: doc.teamId ? "Equipo" : "Personal",
        processingStatus: doc.processingStatus || "unknown",
        totalChunks: doc.totalChunks || 0,
        canRead: (doc.processingStatus === "completed" || !doc.processingStatus),
        fileSize: doc.fileSize,
        tags: doc.tags || [],
        createdAt: new Date(doc._creationTime).toISOString()
      }));

      const summary: {
        totalDocuments: number;
        currentPage: number;
        personalDocuments: number;
        teamDocuments: number;
        readableDocuments: number;
        processingDocuments: number;
        failedDocuments: number;
      } = {
        totalDocuments: result.totalCount,
        currentPage: documentList.length,
        personalDocuments: documentList.filter(d => d.scope === "Personal").length,
        teamDocuments: documentList.filter(d => d.scope === "Equipo").length,
        readableDocuments: documentList.filter(d => d.canRead).length,
        processingDocuments: documentList.filter(d => d.processingStatus === "processing").length,
        failedDocuments: documentList.filter((d: DocumentInfo) => d.processingStatus === "failed").length
      };

      const limit = args.limit ?? 10;
      const offset = args.offset ?? 0;

      const markdown: string = `# 📚 Documentos de Biblioteca

## Resumen
- **Total de Documentos**: ${summary.totalDocuments}
- **Mostrando**: ${summary.currentPage} documentos (${offset + 1} - ${offset + summary.currentPage})
- **Documentos Personales** (en esta página): ${summary.personalDocuments}
- **Documentos de Equipo** (en esta página): ${summary.teamDocuments}
- **Documentos Legibles** (en esta página): ${summary.readableDocuments}
- **Documentos en Procesamiento** (en esta página): ${summary.processingDocuments}
- **Documentos Fallidos** (en esta página): ${summary.failedDocuments}
- **Hay más documentos**: ${result.hasMore ? `Sí (usa offset: ${result.nextOffset} para ver más)` : 'No'}

## Lista de Documentos
${documentList.length === 0 ? 'No hay documentos en tu biblioteca.' : documentList.map((doc: DocumentInfo, index: number) => `
### ${index + 1}. ${doc.title || 'Sin título'}
- **ID del Documento**: ${doc.documentId}
- **Ámbito**: ${doc.scope}
- **Descripción**: ${doc.description}
- **Estado de Procesamiento**: ${doc.processingStatus}
- **Total de Fragmentos**: ${doc.totalChunks}
- **¿Se Puede Leer?**: ${doc.canRead ? 'Sí' : 'No'}
- **Tamaño del Archivo**: ${doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : 'N/A'}
- **Etiquetas**: ${doc.tags.length > 0 ? doc.tags.join(', ') : 'Sin etiquetas'}
- **Fecha de Creación**: ${new Date(doc.createdAt).toLocaleDateString()}
`).join('\n')}

---
*Lista de documentos de tu biblioteca personal y de equipos.*`;

      // Build citations array from all listed library documents
      console.log(`📚 [Citations] Creating citations from ${documentList.length} listed library documents`);
      const citations: LibraryDocumentCitation[] = documentList.map((doc: DocumentInfo) => {
        const citation = {
          id: doc.documentId,
          type: "doc" as const,
          title: doc.title || doc.description || "Documento de biblioteca",
        };
        console.log(`  📖 Citation created:`, citation);
        return citation;
      });
      console.log(`✅ [Citations] Total citations created: ${citations.length}`);

      if (citations.length > 0) {
        console.log(`📤 [Citations] Returning tool output with ${citations.length} citations`);
        return { markdown, citations };
      }

      return markdown;
    } catch (error) {
      console.error("Error in listLibraryDocumentsTool:", error);
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }
});

