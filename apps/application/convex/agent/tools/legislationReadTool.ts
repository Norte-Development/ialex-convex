import { createTool, ToolCtx } from "@convex-dev/agent";
import { api, internal } from "../../_generated/api";
import { z } from "zod";

/**
 * Unified legislation reader tool.
 * Operations:
 * - query: semantic search within a single legislation document, optional context expansion
 * - read: adaptive read; returns full Mongo content if short enough, else chunked via Qdrant
 * - chunkCount: get total chunk count for a document (from Qdrant)
 */
export const legislationReadTool = createTool({
  description:
    "Read legislation: query within a document, adaptive read (full or chunked), or get chunk count.",
  args: z
    .object({
      operation: z.enum(["query", "read", "chunkCount"]).describe("Which operation to perform"),
      // Common
      documentId: z.string().optional().describe("The ID of the legislation document to read. This is the document_id field in the legislation collection. You must corroborate that the document_id is valid before using this tool. Only use it if you previously found the document_id in a previous search."),
      // Query-specific
      query: z.string().optional(),
      limit: z.number().optional(),
      contextWindow: z.number().optional(),
      // Read-specific
      chunkIndex: z.number().optional(),
      chunkCount: z.number().optional(),
      preferFullIfShort: z.boolean().optional(),
      wordLimit: z.number().optional(),
    })
    .required({ operation: true }),
  handler: async (ctx: ToolCtx, args: any) => {
    const operation = args.operation as string;

    if (!ctx.userId) {
      return { kind: "error", error: "Not authenticated" };
    }

    switch (operation) {
      case "query": {
        if (!args.documentId || typeof args.documentId !== "string" || args.documentId.trim().length === 0) {
          return { kind: "error", error: "Invalid documentId: must be a non-empty string" };
        }
        if (!args.query || typeof args.query !== "string" || args.query.trim().length === 0) {
          return { kind: "error", error: "Invalid query: must be a non-empty string" };
        }
        const document_id = args.documentId.trim();
        const query = args.query.trim();
        const limit = typeof args.limit === "number" ? Math.min(Math.max(1, args.limit), 20) : 5;
        const contextWindow = typeof args.contextWindow === "number" ? Math.min(Math.max(0, args.contextWindow), 20) : 0;

        const results = await ctx.runAction(api.rag.qdrantUtils.legislation.searchDocumentChunks, {
          document_id,
          query,
          limit,
          contextWindow,
        });

        return { kind: "query", documentId: document_id, query, results };
      }

      case "read": {
        if (!args.documentId || typeof args.documentId !== "string" || args.documentId.trim().length === 0) {
          return { kind: "error", error: "Invalid documentId: must be a non-empty string" };
        }
        const documentId = args.documentId.trim();
        const chunkIndex = typeof args.chunkIndex === "number" ? Math.max(0, args.chunkIndex) : 0;
        const chunkCount = typeof args.chunkCount === "number" ? Math.min(Math.max(1, args.chunkCount), 10) : 1;
        const preferFullIfShort = args.preferFullIfShort !== false; // default true
        const wordLimit = typeof args.wordLimit === "number" ? Math.min(Math.max(100, args.wordLimit), 5000) : 1000;

        // Try Mongo full content fetch first (metadata call used in finder returns content when available)
        const normative = await ctx.runAction(api.functions.legislation.getNormativeById, {
          jurisdiction: "",
          id: documentId,
        });

        const rawText: string | null =
          (normative?.content as string) || (normative?.texto as string) ||
          (Array.isArray((normative as any)?.articulos)
            ? ((normative as any).articulos as Array<{ texto?: string }>).
                map((a) => a?.texto || "").filter(Boolean).join("\n\n")
            : null);

        const wordCount = rawText ? rawText.trim().split(/\s+/).length : 0;

        if (preferFullIfShort && rawText && wordCount <= wordLimit) {
          return {
            kind: "read",
            mode: "full",
            documentId,
            wordCount,
            content: rawText,
          };
        }

        // Fallback to chunked reading from Qdrant
        const totalChunks: number = await ctx.runAction(api.rag.qdrantUtils.legislation.getDocumentChunkCount, {
          document_id: documentId,
        });

        if (chunkIndex >= totalChunks) {
          // Fallback: return empty result for out-of-bounds chunk index
          return {
            kind: "read",
            mode: "chunked",
            documentId,
            chunkIndex,
            chunkCount: 0,
            totalChunks,
            content: "",
            hasMore: false,
            nextChunkIndex: totalChunks,
            message: `Chunk index is out of bounds, returning empty result. Total chunks: ${totalChunks}`,
          };
        }

        const actualCount = Math.min(chunkCount, Math.max(0, totalChunks - chunkIndex));
        const chunks = await ctx.runAction(api.rag.qdrantUtils.legislation.getDocumentChunksByRange, {
          document_id: documentId,
          startIndex: chunkIndex,
          endIndex: chunkIndex + actualCount - 1,
        });

        if (!chunks || chunks.length === 0) {
          return {
            kind: "read",
            mode: "chunked",
            documentId,
            chunkIndex,
            chunkCount: 0,
            totalChunks,
            content: "",
            hasMore: chunkIndex < totalChunks - 1,
            nextChunkIndex: Math.min(totalChunks, chunkIndex + 1),
          };
        }

        const combined = chunks.join("\n\n");
        return {
          kind: "read",
          mode: "chunked",
          documentId,
          chunkIndex,
          chunkCount: actualCount,
          totalChunks,
          content: combined,
          hasMore: chunkIndex + actualCount < totalChunks,
          nextChunkIndex: chunkIndex + actualCount,
        };
      }

      case "chunkCount": {
        if (!args.documentId || typeof args.documentId !== "string" || args.documentId.trim().length === 0) {
          return { kind: "error", error: "Invalid documentId: must be a non-empty string" };
        }
        const document_id = args.documentId.trim();
        const totalChunks: number = await ctx.runAction(api.rag.qdrantUtils.legislation.getDocumentChunkCount, { document_id });
        return { kind: "chunkCount", documentId: document_id, totalChunks };
      }

      default:
        return { kind: "error", error: `Unsupported operation: ${operation}` };
    }
  },
} as any);


