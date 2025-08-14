import { createTool, ToolCtx, getThreadMetadata} from "@convex-dev/agent";
import { components } from "../_generated/api";
import { z } from "zod";
import { api, internal } from "../_generated/api";

export const searchLegislationTool = createTool({
    description: "Search legal legislation using hybrid search (dense + sparse embeddings). Supports filtering by category, date range, and jurisdiction.",
    args: z.object({
        query: z.string().describe("The search query text"),
        jurisdiccion: z.string().optional().default("nacional").describe("Jurisdiction to search in (e.g., 'nacional', 'provincial'). Defaults to 'nacional'"),
        category: z.union([
            z.string(),
            z.array(z.string())
        ]).optional().describe("Category or categories to filter by (e.g., 'disposicion', 'ley', 'decreto')"),
        startDate: z.string().optional().describe("Start date for date range filter (ISO format or parseable date string)"),
        endDate: z.string().optional().describe("End date for date range filter (ISO format or parseable date string)")
    }),
    handler: async (ctx: any, args: any) => {
      try {
        const response = await fetch(`${process.env.SEARCH_API_URL}/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.SEARCH_API_KEY!
            },
            body: JSON.stringify(args)
        });
        
        if (!response.ok) {
            return {
                results: [],
                error: "Error searching legislation. Try again later."
            }
        }
        
        const data = await response.json();
        return data;
      } catch (error) {
        console.error("Error searching legislation:", error);
        return {
          results: [],
          error: "Error searching legislation. Try again later."
        }
      }
    },
} as any);

// export const searchDocumentsTool = createTool({
//     description: "Search user and team documents using hybrid search. Useful for finding specific documents within the legal case management system.",
//     args: z.object({
//         query: z.string().describe("The search query text to find relevant documents"),
//         user_id: z.string().optional().describe("Filter documents by specific user ID"),
//         team_id: z.string().optional().describe("Filter documents by specific team ID"),
//         limit: z.number().optional().default(30).describe("Maximum number of results to return (default: 30)")
//     }),
//     handler: async (ctx: any, args: any) => {
//         const response = await fetch(`${process.env.FLASK_API_URL}/search_documents`, {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//                 'X-API-Key': process.env.SEARCH_API_KEY!
//             },
//             body: JSON.stringify(args)
//         });
        
//         if (!response.ok) {
//             throw new Error(`Document search failed: ${response.statusText}`);
//         }
        
//         const data = await response.json();
//         return data;
//     },
// } as any);

export const searchFallosTool = createTool({
    description: "Search court decisions and legal precedents (fallos) using dense embeddings. Useful for finding relevant case law and judicial decisions.",
    args: z.object({
        query: z.string().describe("The search query text to find relevant court decisions"),
        limit: z.number().optional().default(10).describe("Maximum number of results to return (default: 10)")
    }),
    handler: async (ctx: any, args: any) => {
        const response = await fetch(`${process.env.SEARCH_API_URL}/search_fallos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.SEARCH_API_KEY!
            },
            body: JSON.stringify(args)
        });
        
        if (!response.ok) {
            throw new Error(`Fallos search failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
    },
} as any);


export const searchCaseDocumentsTool = createTool({
  description: "Search case documents using dense embeddings with semantic chunk clustering. Provides coherent context by grouping related chunks and expanding context windows.",
  args: z.object({
    query: z.string().describe("The search query text to find relevant case documents"),
    limit: z.number().optional().default(10).describe("Maximum number of initial results to return (default: 10)"),
    contextWindow: z.number().optional().default(4).describe("Number of adjacent chunks to include for context expansion (default: 4)")
  }),
  handler: async (ctx: ToolCtx, {query, limit, contextWindow}: {query: string, limit: number, contextWindow: number}) => {
    // Use userId directly from ctx instead of getCurrentUserFromAuth
    if (!ctx.userId) {
      throw new Error("Not authenticated");
    }
    
    // Extract caseId from thread metadata
    if (!ctx.threadId) {
      throw new Error("No thread context available");
    }
    
    const { userId: threadUserId } = await getThreadMetadata(ctx, components.agent, { threadId: ctx.threadId });
    
    // Extract caseId from threadUserId format: "case:${caseId}_${userId}"
    if (!threadUserId?.startsWith("case:")) {
      throw new Error("This tool can only be used within a case context");
    }

    const caseId = threadUserId.substring(5).split("_")[0]; // Remove "case:" prefix and get caseId part

    // Call the action to perform the search with clustering
    return await ctx.runAction(api.rag.qdrant.searchCaseDocumentsWithClustering, {
      query,
      caseId,
      limit,
      contextWindow
    });
  }
} as any);

export const readDocumentTool = createTool({
  description: "Read a document progressively, chunk by chunk. Use this to read through entire documents sequentially without overwhelming token limits. Perfect for systematic document analysis.",
  args: z.object({
    documentId: z.string().describe("The ID of the document to read"),
    chunkIndex: z.number().optional().default(0).describe("Which chunk to read (0-based index). Start with 0 for the beginning.")
  }),
  handler: async (ctx: ToolCtx, { documentId, chunkIndex }: { documentId: string, chunkIndex: number }) => {
    // Verify authentication using agent context
    if (!ctx.userId) {
      throw new Error("Not authenticated");
    }
    
    // Extract caseId from thread metadata
    if (!ctx.threadId) {
      throw new Error("No thread context available");
    }
    
    const { userId: threadUserId } = await getThreadMetadata(ctx, components.agent, { threadId: ctx.threadId });
    
    // Extract caseId from threadUserId format: "case:${caseId}_${userId}"
    if (!threadUserId?.startsWith("case:")) {
      throw new Error("This tool can only be used within a case context");
    }

    const caseId = threadUserId.substring(5).split("_")[0]; // Remove "case:" prefix and get caseId part

    // Get document metadata using internal helper (bypasses permission checks)
    const document = await ctx.runQuery(internal.functions.documents.getDocumentForAgent, { 
      documentId: documentId as any
    });
    
    if (!document) {
      throw new Error("Document not found");
    }

    // Verify document belongs to the current case
    if (document.caseId !== caseId) {
      throw new Error("Document does not belong to the current case");
    }

    // Check if document is processed
    if (document.processingStatus !== "completed") {
      throw new Error(`Document is not ready for reading. Status: ${document.processingStatus}`);
    }

    // Get total chunks (prefer DB field, fallback to Qdrant count)
    let totalChunks = document.totalChunks || 0;
    if (totalChunks === 0) {
      totalChunks = await ctx.runAction(api.rag.qdrant.getDocumentChunkCount, {
        documentId,
        caseId
      });
    }

    // Validate chunk index
    if (chunkIndex < 0) {
      throw new Error("Chunk index cannot be negative");
    }
    
    if (chunkIndex >= totalChunks) {
      throw new Error(`Chunk index ${chunkIndex} is beyond document length (${totalChunks} chunks)`);
    }

    // Fetch the specific chunk from Qdrant
    const chunkContent = await ctx.runAction(api.rag.qdrant.getDocumentChunkByIndex, {
      documentId,
      caseId,
      chunkIndex
    });

    if (!chunkContent) {
      throw new Error(`Chunk ${chunkIndex} not found in document`);
    }

    return {
      documentId,
      documentTitle: document.title,
      chunkIndex,
      totalChunks,
      content: chunkContent,
      hasMoreChunks: chunkIndex < totalChunks - 1,
      nextChunkIndex: chunkIndex + 1,
      progress: `${chunkIndex + 1}/${totalChunks}`,
      isLastChunk: chunkIndex === totalChunks - 1
    };
  }
} as any);

export const listCaseDocumentsTool = createTool({
  description: "List all documents in the current case with their processing status and chunk counts. Use this to see what documents are available for reading.",
  args: z.object({}),
  handler: async (ctx: ToolCtx, {}) => {
    // Verify authentication using agent context
    if (!ctx.userId) {
      throw new Error("Not authenticated");
    }
    
    // Extract caseId from thread metadata
    if (!ctx.threadId) {
      throw new Error("No thread context available");
    }
    
    const { userId: threadUserId } = await getThreadMetadata(ctx, components.agent, { threadId: ctx.threadId });
    
    // Extract caseId from threadUserId format: "case:${caseId}_${userId}"
    if (!threadUserId?.startsWith("case:")) {
      throw new Error("This tool can only be used within a case context");
    }

    const caseId = threadUserId.substring(5).split("_")[0]; // Remove "case:" prefix and get caseId part

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

    return {
      summary,
      documents: documentList
    };
  }
} as any);
