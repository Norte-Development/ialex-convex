import { createTool, ToolCtx, getThreadMetadata} from "@convex-dev/agent";
import { components } from "../_generated/api";
import { z } from "zod";
import { api, internal } from "../_generated/api";

// Helper function to validate edit types
function validateEditType(type: string): boolean {
  const validTypes = [
    "replace", "insert", "delete",
    "addMark", "removeMark", "replaceMark",
    "addParagraph"
  ];
  return validTypes.includes(type);
}

// Helper function to validate mark types
function validateMarkType(markType: string): boolean {
  const validMarkTypes = ["bold", "italic", "code", "strike", "underline"];
  return validMarkTypes.includes(markType);
}

// Helper function to validate paragraph types
function validateParagraphType(paragraphType: string): boolean {
  const validParagraphTypes = ["paragraph", "heading", "blockquote", "bulletList", "orderedList", "codeBlock"];
  return validParagraphTypes.includes(paragraphType);
}



	/**
	 * Tool for editing Escritos by text-based operations including text manipulation and mark formatting.
	 * Uses applyTextBasedOperations mutation to apply changes.
	 * 
	 * @description Edit an Escrito by finding and replacing text content, adding/removing formatting marks, and manipulating text. Much easier than position-based editing - just provide the text to find and what to replace it with, or specify mark operations.
	 * @param {Object} args - Edit parameters
	 * @param {string} args.escritoId - The Escrito ID (Convex doc id)
	 * @param {Array} args.edits - Array of edit operations to apply
	 * @returns {Promise<Object>} Result of the edit operations
	 * @throws {Error} When the edit operations fail
	 * 
	 * @example
	 * // Replace text with context
	 * await editEscritoTool.handler(ctx, {
	 *   escritoId: "escrito_123",
	 *   edits: [{
	 *     type: "replace",
	 *     findText: "old text",
	 *     replaceText: "new text",
	 *     contextBefore: "This is",
	 *     contextAfter: "here"
	 *   }]
	 * });
	 * 
	 * // Add bold formatting
	 * await editEscritoTool.handler(ctx, {
	 *   escritoId: "escrito_123", 
	 *   edits: [{
	 *     type: "add_mark",
	 *     text: "important text",
	 *     markType: "bold"
	 *   }]
	 * });
	 * 
	 * // Change italic to bold
	 * await editEscritoTool.handler(ctx, {
	 *   escritoId: "escrito_123",
	 *   edits: [{
	 *     type: "replace_mark", 
	 *     text: "emphasized text",
	 *     oldMarkType: "italic",
	 *     newMarkType: "bold"
	 *   }]
	 * });
	 * 
	 * // Add new paragraph
	 * await editEscritoTool.handler(ctx, {
	 *   escritoId: "escrito_123",
	 *   edits: [{
	 *     type: "add_paragraph",
	 *     content: "This is a new paragraph",
	 *     paragraphType: "paragraph",
	 *     afterText: "end of section"
	 *   }]
	 * });
	 */
	export const editEscritoTool = createTool({
	  description:
	    "Edit an Escrito by finding and replacing text content, adding/removing formatting marks, manipulating paragraph structure, and transforming document elements. Much easier than position-based editing - just provide the text to find and what to replace it with, or specify mark/paragraph operations.",
	  args: z
	    .object({
	      escritoId: z.string().describe("The Escrito ID (Convex doc id)"),
	      edits: z.array(
	        z.object({
	          type: z.string().optional().describe("Edit operation type: replace, insert, delete, addMark, removeMark, replaceMark, addParagraph"),
	          // Replace operation fields
	          findText: z.string().optional().describe("Text to find and replace"),
	          replaceText: z.string().optional().describe("Text to replace it with"),
	          // Insert/Delete operation fields
	          insertText: z.string().optional().describe("Text to insert"),
	          deleteText: z.string().optional().describe("Text to delete"),
	          // Common context fields
	          contextBefore: z.string().optional().describe("Text that should appear before (for precise targeting)"),
	          contextAfter: z.string().optional().describe("Text that should appear after (for precise targeting)"),
	          // Mark operation fields
	          text: z.string().optional().describe("Text to apply mark operation to"),
	          markType: z.string().optional().describe("Mark type: bold, italic, code, strike, underline"),
	          oldMarkType: z.string().optional().describe("Current mark type for replaceMark"),
	          newMarkType: z.string().optional().describe("New mark type for replaceMark"),
	          // Paragraph operation fields
	          content: z.string().optional().describe("Content for new paragraph"),
	          paragraphType: z.string().optional().describe("Paragraph type: paragraph, heading, blockquote, bulletList, orderedList, codeBlock"),
	          headingLevel: z.number().optional().describe("Heading level (1-6, required for heading type)"),
	          afterText: z.string().optional().describe("Insert after this text"),
	          beforeText: z.string().optional().describe("Insert before this text"),
	          // Other options
	          replaceAll: z.boolean().optional().describe("Replace all occurrences (for replace operations)")
	        })
	      ).min(1).describe("Array of edit operations to apply"),
	    })
	    .required({ escritoId: true, edits: true }),
	  handler: async (
	    ctx: ToolCtx,
	    { escritoId, edits }: { escritoId: string; edits: any[] }
	  ) => {
	    if (!ctx.userId) throw new Error("Not authenticated");

	    // Validate inputs in handler for better error control
	    if (!escritoId || typeof escritoId !== 'string') {
	      throw new Error("Invalid escritoId: must be a non-empty string");
	    }

	    if (!Array.isArray(edits) || edits.length === 0) {
	      throw new Error("Invalid edits: must be a non-empty array");
	    }

	    // Validate each edit operation
	    for (let i = 0; i < edits.length; i++) {
	      const edit = edits[i];
	      if (!edit || typeof edit !== 'object') {
	        throw new Error(`Invalid edit at index ${i}: must be an object`);
	      }

	      if (!edit.type || typeof edit.type !== 'string') {
	        throw new Error(`Invalid edit type at index ${i}: must have a valid type`);
	      }

	      if (!validateEditType(edit.type)) {
	        throw new Error(`Invalid edit type at index ${i}: '${edit.type}' is not supported. Valid types: replace, insert, delete, addMark, removeMark, replaceMark, addParagraph`);
	      }

	      // Validate mark-related operations
	      if (edit.type === 'addMark' || edit.type === 'removeMark') {
	        if (!edit.text || typeof edit.text !== 'string') {
	          throw new Error(`Invalid ${edit.type} at index ${i}: must have text property`);
	        }
	        if (!edit.markType || typeof edit.markType !== 'string') {
	          throw new Error(`Invalid ${edit.type} at index ${i}: must have markType property`);
	        }
	        if (!validateMarkType(edit.markType)) {
	          throw new Error(`Invalid markType '${edit.markType}' at index ${i}: must be one of bold, italic, code, strike, underline`);
	        }
	      }

	      // Validate replaceMark operation
	      if (edit.type === 'replaceMark') {
	        if (!edit.text || typeof edit.text !== 'string') {
	          throw new Error(`Invalid ${edit.type} at index ${i}: must have text property`);
	        }
	        if (!edit.oldMarkType || typeof edit.oldMarkType !== 'string') {
	          throw new Error(`Invalid ${edit.type} at index ${i}: must have oldMarkType property`);
	        }
	        if (!edit.newMarkType || typeof edit.newMarkType !== 'string') {
	          throw new Error(`Invalid ${edit.type} at index ${i}: must have newMarkType property`);
	        }
	        if (!validateMarkType(edit.oldMarkType)) {
	          throw new Error(`Invalid oldMarkType '${edit.oldMarkType}' at index ${i}: must be one of bold, italic, code, strike, underline`);
	        }
	        if (!validateMarkType(edit.newMarkType)) {
	          throw new Error(`Invalid newMarkType '${edit.newMarkType}' at index ${i}: must be one of bold, italic, code, strike, underline`);
	        }
	      }

	      // Validate addParagraph operation
	      if (edit.type === 'addParagraph') {
	        if (!edit.content || typeof edit.content !== 'string') {
	          throw new Error(`Invalid ${edit.type} at index ${i}: must have content property`);
	        }
	        if (!edit.paragraphType || typeof edit.paragraphType !== 'string') {
	          throw new Error(`Invalid ${edit.type} at index ${i}: must have paragraphType property`);
	        }
	        if (!validateParagraphType(edit.paragraphType)) {
	          throw new Error(`Invalid paragraphType '${edit.paragraphType}' at index ${i}: must be one of paragraph, heading, blockquote, bulletList, orderedList, codeBlock`);
	        }
	        if (edit.paragraphType === 'heading' && (!edit.headingLevel || typeof edit.headingLevel !== 'number' || edit.headingLevel < 1 || edit.headingLevel > 6)) {
	          throw new Error(`Invalid ${edit.type} at index ${i}: heading type requires headingLevel between 1 and 6`);
	        }
	      }

	      // Validate replace operation
	      if (edit.type === 'replace') {
	        if (!edit.findText || typeof edit.findText !== 'string') {
	          throw new Error(`Invalid ${edit.type} at index ${i}: must have findText property`);
	        }
	        if (!edit.replaceText || typeof edit.replaceText !== 'string') {
	          throw new Error(`Invalid ${edit.type} at index ${i}: must have replaceText property`);
	        }
	      }

	      // Validate insert operation
	      if (edit.type === 'insert') {
	        if (!edit.insertText || typeof edit.insertText !== 'string') {
	          throw new Error(`Invalid ${edit.type} at index ${i}: must have insertText property`);
	        }
	      }

	      // Validate delete operation
	      if (edit.type === 'delete') {
	        if (!edit.deleteText || typeof edit.deleteText !== 'string') {
	          throw new Error(`Invalid ${edit.type} at index ${i}: must have deleteText property`);
	        }
	      }
	    }

	    // Load Escrito
	    const escrito = await ctx.runQuery(api.functions.documents.getEscrito, {
	      escritoId: escritoId as any,
	    });
	    if (!escrito) {
	      throw new Error(`Escrito not found with ID: ${escritoId}`);
	    }

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
    escritoId: z.any().describe("The Escrito ID (Convex doc id)"),
  }).required({escritoId: true}),
  handler: async (ctx: ToolCtx, args: any) => {
    // Validate inputs in handler
    if (!args.escritoId || typeof args.escritoId !== 'string' || args.escritoId.trim().length === 0) {
      throw new Error("Invalid escritoId: must be a non-empty string");
    }

    const escritoId = args.escritoId.trim();

    const escrito = await ctx.runQuery(api.functions.documents.getEscrito, { escritoId: escritoId as any });

    if (!escrito) {
      throw new Error(`Escrito not found with ID: ${escritoId}`);
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
        query: z.any().describe("The search query text to find relevant court decisions"),
        limit: z.any().optional().describe("Maximum number of results to return (default: 10)")
    }).required({query: true}),
    handler: async (ctx: any, args: any) => {
        // Validate inputs in handler
        if (!args.query || typeof args.query !== 'string' || args.query.trim().length === 0) {
            throw new Error("Invalid query: must be a non-empty string");
        }

        const limit = args.limit !== undefined ? args.limit : 10;

        if (typeof limit !== 'number' || limit < 1 || limit > 100) {
            throw new Error("Invalid limit: must be a number between 1 and 100");
        }

        const validatedArgs = {
            query: args.query.trim(),
            limit: Math.min(limit, 100) // Cap at 100 to prevent abuse
        };

        const response = await fetch(`${process.env.SEARCH_API_URL}/search_fallos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.SEARCH_API_KEY!
            },
            body: JSON.stringify(validatedArgs)
        });

        if (!response.ok) {
            throw new Error(`Fallos search failed: ${response.status} ${response.statusText}`);
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
    query: z.any().describe("The search query text to find relevant case documents"),
    limit: z.any().optional().describe("Maximum number of initial results to return (default: 10)"),
    contextWindow: z.any().optional().describe("Number of adjacent chunks to include for context expansion (default: 4)")
  }).required({query: true}),
  handler: async (ctx: ToolCtx, args: any) => {
    // Validate inputs in handler
    if (!args.query || typeof args.query !== 'string' || args.query.trim().length === 0) {
      throw new Error("Invalid query: must be a non-empty string");
    }

    const limit = args.limit !== undefined ? args.limit : 10;
    if (typeof limit !== 'number' || limit < 1 || limit > 50) {
      throw new Error("Invalid limit: must be a number between 1 and 50");
    }

    const contextWindow = args.contextWindow !== undefined ? args.contextWindow : 4;
    if (typeof contextWindow !== 'number' || contextWindow < 1 || contextWindow > 20) {
      throw new Error("Invalid contextWindow: must be a number between 1 and 20");
    }

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
      query: args.query.trim(),
      caseId,
      limit: Math.min(limit, 50), // Cap at 50 to prevent abuse
      contextWindow: Math.min(contextWindow, 20) // Cap at 20 to prevent abuse
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
    documentId: z.any().describe("The ID of the document to read"),
    chunkIndex: z.any().optional().describe("Which chunk to read (0-based index). Start with 0 for the beginning."),
    chunkCount: z.any().optional().describe("Number of consecutive chunks to read (default: 1). Use higher values to read multiple chunks at once.")
  }).required({documentId: true}),
  handler: async (ctx: ToolCtx, args: any) => {
    // Validate inputs in handler
    if (!args.documentId || typeof args.documentId !== 'string' || args.documentId.trim().length === 0) {
      throw new Error("Invalid documentId: must be a non-empty string");
    }

    const chunkIndex = args.chunkIndex !== undefined ? args.chunkIndex : 0;
    if (typeof chunkIndex !== 'number' || chunkIndex < 0) {
      throw new Error("Invalid chunkIndex: must be a non-negative number");
    }

    const chunkCount = args.chunkCount !== undefined ? args.chunkCount : 1;
    if (typeof chunkCount !== 'number' || chunkCount < 1 || chunkCount > 10) {
      throw new Error("Invalid chunkCount: must be a number between 1 and 10");
    }

    const documentId = args.documentId.trim();
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
    documentId: z.any().describe("The ID of the document to search within"),
    query: z.any().describe("The search query to find relevant content within the document"),
    limit: z.any().optional().describe("Maximum number of relevant chunks to return (default: 5)")
  }).required({documentId: true, query: true}),
  handler: async (ctx: ToolCtx, args: any) => {
    // Validate inputs in handler
    if (!args.documentId || typeof args.documentId !== 'string' || args.documentId.trim().length === 0) {
      throw new Error("Invalid documentId: must be a non-empty string");
    }

    if (!args.query || typeof args.query !== 'string' || args.query.trim().length === 0) {
      throw new Error("Invalid query: must be a non-empty string");
    }

    const limit = args.limit !== undefined ? args.limit : 5;
    if (typeof limit !== 'number' || limit < 1 || limit > 20) {
      throw new Error("Invalid limit: must be a number between 1 and 20");
    }

    const documentId = args.documentId.trim();
    const query = args.query.trim();
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
  handler: async (ctx: ToolCtx, args: any) => {
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
