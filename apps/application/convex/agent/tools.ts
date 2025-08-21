import { createTool, ToolCtx, getThreadMetadata} from "@convex-dev/agent";
import { components } from "../_generated/api";
import { z } from "zod";
import { api, internal } from "../_generated/api";

/**
 * Tool for searching legal legislation using hybrid search (dense + sparse embeddings).
 * Supports filtering by category, date range, and jurisdiction.
 * 
 * @description Searches legal legislation using hybrid search (dense + sparse embeddings). Supports filtering by category, date range, and jurisdiction.
 * @param {Object} args - Search parameters
 * @param {string} args.query - The search query text
 * @param {string} [args.jurisdiccion="nacional"] - Jurisdiction to search in (e.g., 'nacional', 'provincial'). Defaults to 'nacional'
 * @param {string|string[]} [args.category] - Category or categories to filter by (e.g., 'disposicion', 'ley', 'decreto')
 * @param {string} [args.startDate] - Start date for date range filter (ISO format or parseable date string)
 * @param {string} [args.endDate] - End date for date range filter (ISO format or parseable date string)
 * @returns {Promise<Object>} Search results with legislation data or error information
 * @throws {Error} When the search API request fails
 * 
 * @example
 * // Search for contract law in national jurisdiction
 * await searchLegislationTool.handler(ctx, {
 *   query: "contract law",
 *   jurisdiccion: "nacional",
 *   category: ["ley", "decreto"]
 * });
 */
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
    }).required({query: true}),
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


	/**
	 * Tool for editing Escritos by text-based operations.
	 * Uses applyTextBasedOperations mutation to apply changes.
	 */
	export const editEscritoTool = createTool({
	  description:
	    "Edit an Escrito by finding and replacing text content. Much easier than position-based editing - just provide the text to find and what to replace it with.",
	  args: z
	    .object({
	      escritoId: z.string().describe("The Escrito ID (Convex doc id)"),
	      edits: z
	        .array(
	          z.union([
	            // Replace
	            z.object({
	              type: z.literal("replace"),
	              findText: z.string(),
	              replaceText: z.string(),
	              contextBefore: z.string().optional(),
	              contextAfter: z.string().optional(),
	              replaceAll: z.boolean().optional().default(false),
	            }),
	            // Insert
	            z.object({
	              type: z.literal("insert"),
	              insertText: z.string(),
	              afterText: z.string().optional(),
	              beforeText: z.string().optional(),
	            }),
	            // Delete
	            z.object({
	              type: z.literal("delete"),
	              deleteText: z.string(),
	              contextBefore: z.string().optional(),
	              contextAfter: z.string().optional(),
	            }),
	          ])
	        )
	        .min(1),
	    })
	    .required({ escritoId: true, edits: true }),
	  handler: async (
	    ctx: ToolCtx,
	    { escritoId, edits }: { escritoId: string; edits: any[] }
	  ) => {
	    if (!ctx.userId) throw new Error("Not authenticated");
	
	    // Load Escrito
	    const escrito = await ctx.runQuery(api.functions.documents.getEscrito, {
	      escritoId: escritoId as any,
	    });
	    if (!escrito) return { error: "Escrito not found" };
	
	    // Apply text-based operations directly using the new mutation
	    const result = await ctx.runMutation(
	      api.functions.escritosTransforms.applyTextBasedOperations,
	      {
	        escritoId: escritoId as any,
	        edits,
	      }
	    );
	
	    return {
	      ok: true,
	      message: `Applied ${edits.length} edits successfully`,
	      editsApplied: edits.length,
	      result,
	    };
	  },
	} as any);



export const getEscritoTool = createTool({
  description: "Get the content of an Escrito",
  args: z.object({
    escritoId: z.string().describe("The Escrito ID (Convex doc id)"),
  }).required({escritoId: true}),
  handler: async (ctx: ToolCtx, { escritoId }: { escritoId: string }) => {
    const escrito = await ctx.runQuery(api.functions.documents.getEscrito, { escritoId: escritoId as any });
    
    if (!escrito) {
      return { error: "Escrito not found" };
    }

    console.log("escrito", escrito);

    // Get the actual document content using prosemirror
    const documentContent = await ctx.runQuery(api.prosemirror.getSnapshot, { id: escrito.prosemirrorId });
    
    return {
      content: documentContent
    };
  }
} as any);

/**
 * Tool for searching court decisions and legal precedents (fallos) using dense embeddings.
 * Useful for finding relevant case law and judicial decisions.
 * 
 * @description Searches court decisions and legal precedents (fallos) using dense embeddings. Useful for finding relevant case law and judicial decisions.
 * @param {Object} args - Search parameters
 * @param {string} args.query - The search query text to find relevant court decisions
 * @param {number} [args.limit=10] - Maximum number of results to return (default: 10)
 * @returns {Promise<Object>} Search results with court decisions data
 * @throws {Error} When the fallos search API request fails
 * 
 * @example
 * // Search for contract dispute precedents
 * await searchFallosTool.handler(ctx, {
 *   query: "contract dispute resolution",
 *   limit: 5
 * });
 */
export const searchFallosTool = createTool({
    description: "Search court decisions and legal precedents (fallos) using dense embeddings. Useful for finding relevant case law and judicial decisions.",
    args: z.object({
        query: z.string().describe("The search query text to find relevant court decisions"),
        limit: z.number().optional().default(10).describe("Maximum number of results to return (default: 10)")
    }).required({query: true}),
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

/**
 * Tool for searching case documents using dense embeddings with semantic chunk clustering.
 * Provides coherent context by grouping related chunks and expanding context windows.
 * 
 * @description Searches case documents using dense embeddings with semantic chunk clustering. Provides coherent context by grouping related chunks and expanding context windows.
 * @param {Object} args - Search parameters
 * @param {string} args.query - The search query text to find relevant case documents
 * @param {number} [args.limit=10] - Maximum number of initial results to return (default: 10)
 * @param {number} [args.contextWindow=4] - Number of adjacent chunks to include for context expansion (default: 4)
 * @returns {Promise<Object>} Search results with clustered document chunks and context
 * @throws {Error} When user is not authenticated or not in a case context
 * 
 * @example
 * // Search for contract-related documents in current case
 * await searchCaseDocumentsTool.handler(ctx, {
 *   query: "contract terms and conditions",
 *   limit: 15,
 *   contextWindow: 6
 * });
 */
export const searchCaseDocumentsTool = createTool({
  description: "Search case documents using dense embeddings with semantic chunk clustering. Provides coherent context by grouping related chunks and expanding context windows.",
  args: z.object({
    query: z.string().describe("The search query text to find relevant case documents"),
    limit: z.number().optional().default(10).describe("Maximum number of initial results to return (default: 10)"),
    contextWindow: z.number().optional().default(4).describe("Number of adjacent chunks to include for context expansion (default: 4)")
  }).required({query: true}),
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

/**
 * Tool for reading a document progressively, chunk by chunk.
 * Use this to read through entire documents sequentially without overwhelming token limits.
 * Perfect for systematic document analysis.
 * 
 * @description Reads a document progressively, chunk by chunk. Use this to read through entire documents sequentially without overwhelming token limits. Perfect for systematic document analysis.
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
  description: "Read a document progressively, chunk by chunk. Use this to read through entire documents sequentially without overwhelming token limits. Perfect for systematic document analysis.",
  args: z.object({
    documentId: z.string().describe("The ID of the document to read"),
    chunkIndex: z.number().optional().default(0).describe("Which chunk to read (0-based index). Start with 0 for the beginning."),
    chunkCount: z.number().optional().default(1).describe("Number of consecutive chunks to read (default: 1). Use higher values to read multiple chunks at once.")
  }).required({documentId: true}),
  handler: async (ctx: ToolCtx, { documentId, chunkIndex, chunkCount }: { documentId: string, chunkIndex: number, chunkCount: number }) => {
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

    // Validate chunkCount
    if (chunkCount < 1) {
      throw new Error("Chunk count must be at least 1");
    }
    
    if (chunkCount > 10) {
      throw new Error("Cannot read more than 10 chunks at once to avoid overwhelming token limits");
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

    // Calculate the actual number of chunks to read
    const actualChunkCount = Math.min(chunkCount, totalChunks - chunkIndex);

    // Fetch multiple chunks from Qdrant
    const chunksContent = await ctx.runAction(api.rag.qdrant.getDocumentChunksByRange, {
      documentId,
      caseId,
      startIndex: chunkIndex,
      endIndex: chunkIndex + actualChunkCount - 1
    });

    if (!chunksContent || chunksContent.length === 0) {
      throw new Error(`No chunks found in range ${chunkIndex} to ${chunkIndex + actualChunkCount - 1}`);
    }

    // Combine chunks content
    const combinedContent = chunksContent.join('\n\n');

    return {
      documentId,
      documentTitle: document.title,
      chunkIndex,
      chunkCount: actualChunkCount,
      totalChunks,
      content: combinedContent,
      hasMoreChunks: chunkIndex + actualChunkCount < totalChunks,
      nextChunkIndex: chunkIndex + actualChunkCount,
      progress: `${chunkIndex + actualChunkCount}/${totalChunks}`,
      isLastChunk: chunkIndex + actualChunkCount >= totalChunks,
      chunksRead: actualChunkCount
    };
  }
} as any);

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
    documentId: z.string().describe("The ID of the document to search within"),
    query: z.string().describe("The search query to find relevant content within the document"),
    limit: z.number().optional().default(5).describe("Maximum number of relevant chunks to return (default: 5)")
  }).required({documentId: true, query: true}),
  handler: async (ctx: ToolCtx, { documentId, query, limit }: { documentId: string, query: string, limit: number }) => {
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
      throw new Error(`Document is not ready for querying. Status: ${document.processingStatus}`);
    }

    // Validate limit
    if (limit < 1) {
      throw new Error("Limit must be at least 1");
    }
    
    if (limit > 20) {
      throw new Error("Cannot return more than 20 chunks at once to avoid overwhelming token limits");
    }

    // Perform semantic search within the specific document
    const searchResults = await ctx.runAction(api.rag.qdrant.searchDocumentChunks, {
      documentId,
      caseId,
      query,
      limit
    });

    if (!searchResults || searchResults.length === 0) {
      return {
        documentId,
        documentTitle: document.title,
        query,
        results: [],
        message: "No relevant content found for the given query in this document."
      };
    }

    return {
      documentId,
      documentTitle: document.title,
      query,
      results: searchResults,
      totalResults: searchResults.length,
      message: `Found ${searchResults.length} relevant chunk(s) in the document.`
    };
  }
} as any);

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
