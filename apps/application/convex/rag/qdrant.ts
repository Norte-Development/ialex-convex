'use node'
import {QdrantClient} from '@qdrant/js-client-rest';
import { action, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";

console.log("Qdrant configuration:", {
  url: process.env.QDRANT_URL ? "Set" : "Missing",
  apiKey: process.env.QDRANT_API_KEY ? "Set" : "Missing"
});

const client = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
  // Avoid noisy warnings if minor versions differ
  checkCompatibility: false as any,
});

/**
 * Action that performs semantic chunk clustering and context window expansion for case documents.
 * Located in qdrant.ts to avoid setTimeout issues with the Qdrant client.
 * Returns the combined text from relevant document chunks.
 */
export const searchCaseDocumentsWithClustering = action({
  args: {
    query: v.string(),
    caseId: v.string(),
    limit: v.number(),
    contextWindow: v.number(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const { query, caseId, limit, contextWindow } = args;

    try {
      console.log("Starting search with params:", { query, caseId, limit, contextWindow });

      // Test connection first
      console.log("Testing Qdrant connection...");
      try {
        const collections = await client.getCollections();
        console.log("Qdrant connection successful, collections:", collections.collections?.map(c => c.name));
      } catch (connError) {
        console.error("Qdrant connection failed:", connError);
        const errorMessage = connError instanceof Error ? connError.message : String(connError);
        throw new Error(`Cannot connect to Qdrant: ${errorMessage}`);
      }

      const vector = await embed({
        model: openai.textEmbeddingModel("text-embedding-3-small"),
        value: query,
      });

      console.log("Generated embedding, vector length:", vector.embedding.length);

      // Step 1: Initial search to get candidates
      console.log("Attempting Qdrant search...");
      const initialResults = await client.search('ialex_documents', {
        vector: vector.embedding,
        limit: limit * 2, // Get more candidates for clustering
        filter: {
          must: [
            {
              key: "caseId",
              match: {
                value: caseId,
              }
            }
          ]
        }
      });

      console.log("Initial search completed, results:", initialResults.length);

      // Step 2: Group results by documentId and identify clusters
      const documentClusters = new Map<string, Array<any>>();
      
      for (const result of initialResults) {
        const documentId = result.payload?.documentId;
        if (!documentId) continue;
        
        if (!documentClusters.has(documentId as string)) {
          documentClusters.set(documentId as string, []);
        }
        documentClusters.get(documentId as string)!.push(result);
      }

      // Step 3: For each cluster, expand context by retrieving adjacent chunks
      const expandedResults = [];
      
      for (const [documentId, chunks] of documentClusters) {
        // Sort chunks by score to prioritize the best ones
        chunks.sort((a, b) => (b.score || 0) - (a.score || 0));
        
        // Take the top chunk(s) from this document
        const topChunks = chunks.slice(0, Math.max(1, Math.floor(limit / documentClusters.size)));
        
        for (const topChunk of topChunks) {
          const chunkIndex = topChunk.payload?.chunkIndex;
          if (typeof chunkIndex !== 'number') {
            expandedResults.push(topChunk);
            continue;
          }

          // Calculate the range of adjacent chunks to retrieve
          const startIndex = Math.max(0, chunkIndex - contextWindow);
          const endIndex = chunkIndex + contextWindow;

          // Query for adjacent chunks
          const adjacentChunks = await client.search('ialex_documents', {
            vector: vector.embedding, // Use same vector for consistency
            limit: 100, // Large limit to get all potential adjacent chunks
            filter: {
              must: [
                {
                  key: "caseId",
                  match: { value: caseId }
                },
                {
                  key: "documentId", 
                  match: { value: documentId }
                },
                {
                  key: "chunkIndex",
                  range: {
                    gte: startIndex,
                    lte: endIndex
                  }
                }
              ]
            }
          });

          // Sort adjacent chunks by chunkIndex to maintain document order
          adjacentChunks.sort((a, b) => {
            const aIndex = (a.payload?.chunkIndex as number) || 0;
            const bIndex = (b.payload?.chunkIndex as number) || 0;
            return aIndex - bIndex;
          });

          // Step 4: Merge adjacent chunks into coherent text
          if (adjacentChunks.length > 1) {
            const mergedText = adjacentChunks
              .map(chunk => (chunk.payload?.text as string) || '')
              .filter(text => text.trim().length > 0)
              .join(' ');

            // Create a merged result with the highest score from the group
            const mergedResult = {
              ...topChunk,
              payload: {
                ...topChunk.payload,
                text: mergedText,
                chunkIndex: chunkIndex, // Keep original chunk index as reference
                expandedChunks: adjacentChunks.length,
                contextWindow: `${startIndex}-${endIndex}`
              }
            };
            
            expandedResults.push(mergedResult);
          } else {
            // If no adjacent chunks found, keep the original
            expandedResults.push(topChunk);
          }
        }
      }

      // Step 5: Sort final results by score and limit
      expandedResults.sort((a, b) => (b.score || 0) - (a.score || 0));
      
      // Extract and combine just the text content
      const combinedTexts = expandedResults.slice(0, limit).map(result => {
        const text = result.payload?.text as string || '';
        return text.trim();
      }).filter(text => text.length > 0);
      
      // Join all texts with double newlines for clear separation
      const finalText = combinedTexts.join('\n\n');
      
      console.log("Returning combined text, length:", finalText.length);
      return finalText;
      
    } catch (error) {
      console.error("Error in searchCaseDocumentsWithClustering:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      const errorName = error instanceof Error ? error.name : typeof error;
      
      console.error("Error details:", {
        message: errorMessage,
        stack: errorStack,
        name: errorName
      });
      throw new Error(`Search failed: ${errorMessage}`);
    }
  }
});

/**
 * Action that retrieves a specific document chunk by index from Qdrant.
 * Used for progressive document reading instead of similarity search.
 */
export const getDocumentChunkByIndex = action({
  args: {
    documentId: v.string(),
    caseId: v.string(),
    chunkIndex: v.number()
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const { documentId, caseId, chunkIndex } = args;

    try {
      console.log("Fetching chunk by index:", { documentId, caseId, chunkIndex });

      // Test connection first
      try {
        await client.getCollections();
      } catch (connError) {
        console.error("Qdrant connection failed:", connError);
        const errorMessage = connError instanceof Error ? connError.message : String(connError);
        throw new Error(`Cannot connect to Qdrant: ${errorMessage}`);
      }

      const collectionName = `ialex_documents`;

      // Use scroll API with metadata filters to find specific chunk
      const results = await client.scroll(collectionName, {
        filter: {
          must: [
            {
              key: "documentId",
              match: { value: documentId }
            },
            {
              key: "chunkIndex", 
              match: { value: chunkIndex }
            }
          ]
        },
        with_payload: true,
        with_vector: false // We don't need vectors for content retrieval
      });

      console.log("Qdrant scroll results:", {
        pointsFound: results.points?.length || 0,
        chunkIndex
      });

      if (!results.points || results.points.length === 0) {
        console.log("No chunk found for index:", chunkIndex);
        return null;
      }

      const chunk = results.points[0];
      const chunkText = chunk.payload?.text;

      if (typeof chunkText !== 'string') {
        console.error("Invalid chunk text format:", typeof chunkText);
        return null;
      }

      console.log("Successfully retrieved chunk:", {
        chunkIndex,
        textLength: chunkText.length
      });

      return chunkText;

    } catch (error) {
      console.error("Error fetching chunk by index:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch chunk: ${errorMessage}`);
    }
  }
});

/**
 * Action that retrieves multiple consecutive document chunks by range from Qdrant.
 * Used for reading multiple chunks at once in progressive document reading.
 */
export const getDocumentChunksByRange = action({
  args: {
    documentId: v.string(),
    caseId: v.string(),
    startIndex: v.number(),
    endIndex: v.number()
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const { documentId, caseId, startIndex, endIndex } = args;

    try {
      console.log("Fetching chunks by range:", { documentId, caseId, startIndex, endIndex });

      // Test connection first
      try {
        await client.getCollections();
      } catch (connError) {
        console.error("Qdrant connection failed:", connError);
        const errorMessage = connError instanceof Error ? connError.message : String(connError);
        throw new Error(`Cannot connect to Qdrant: ${errorMessage}`);
      }

      const collectionName = `ialex_documents`;

      // Use scroll API with metadata filters to find chunks in range
      const results = await client.scroll(collectionName, {
        filter: {
          must: [
            {
              key: "documentId",
              match: { value: documentId }
            },
            {
              key: "chunkIndex",
              range: {
                gte: startIndex,
                lte: endIndex
              }
            }
          ]
        },
        with_payload: true,
        with_vector: false // We don't need vectors for content retrieval
      });

      console.log("Qdrant scroll results:", {
        pointsFound: results.points?.length || 0,
        startIndex,
        endIndex
      });

      if (!results.points || results.points.length === 0) {
        console.log("No chunks found in range:", { startIndex, endIndex });
        return [];
      }

      // Sort chunks by chunkIndex to maintain document order
      const sortedChunks = results.points.sort((a, b) => {
        const aIndex = (a.payload?.chunkIndex as number) || 0;
        const bIndex = (b.payload?.chunkIndex as number) || 0;
        return aIndex - bIndex;
      });

      // Extract text content from chunks
      const chunksText = sortedChunks.map(chunk => {
        const chunkText = chunk.payload?.text;
        if (typeof chunkText !== 'string') {
          console.error("Invalid chunk text format:", typeof chunkText);
          return '';
        }
        return chunkText;
      }).filter(text => text.length > 0);

      console.log("Successfully retrieved chunks:", {
        startIndex,
        endIndex,
        chunksRetrieved: chunksText.length,
        totalTextLength: chunksText.reduce((sum, text) => sum + text.length, 0)
      });

      return chunksText;

    } catch (error) {
      console.error("Error fetching chunks by range:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch chunks: ${errorMessage}`);
    }
  }
});

/**
 * Action that performs semantic search within a specific document.
 * Searches for the most relevant chunks within a single document based on a query.
 */
export const searchDocumentChunks = action({
  args: {
    documentId: v.string(),
    caseId: v.string(),
    query: v.string(),
    limit: v.number()
  },
  returns: v.array(v.object({
    chunkIndex: v.number(),
    text: v.string(),
    score: v.number()
  })),
  handler: async (ctx, args) => {
    const { documentId, caseId, query, limit } = args;

    try {
      console.log("Searching document chunks:", { documentId, caseId, query, limit });

      // Test connection first
      try {
        await client.getCollections();
      } catch (connError) {
        console.error("Qdrant connection failed:", connError);
        const errorMessage = connError instanceof Error ? connError.message : String(connError);
        throw new Error(`Cannot connect to Qdrant: ${errorMessage}`);
      }

      const vector = await embed({
        model: openai.textEmbeddingModel("text-embedding-3-small"),
        value: query,
      });

      console.log("Generated embedding, vector length:", vector.embedding.length);

      // Perform semantic search within the specific document
      const results = await client.search('ialex_documents', {
        vector: vector.embedding,
        limit: limit,
        filter: {
          must: [
            {
              key: "documentId",
              match: { value: documentId }
            },
            {
              key: "caseId",
              match: { value: caseId }
            }
          ]
        }
      });

      console.log("Document search completed, results:", results.length);

      // Format results
      const formattedResults = results.map(result => ({
        chunkIndex: (result.payload?.chunkIndex as number) || 0,
        text: (result.payload?.text as string) || '',
        score: result.score || 0
      })).filter(result => result.text.length > 0);

      // Sort by score (highest first)
      formattedResults.sort((a, b) => b.score - a.score);

      console.log("Returning formatted results:", {
        query,
        resultsCount: formattedResults.length,
        topScore: formattedResults[0]?.score || 0
      });

      return formattedResults;

    } catch (error) {
      console.error("Error searching document chunks:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Search failed: ${errorMessage}`);
    }
  }
});

/**
 * Action that gets the total number of chunks for a document from Qdrant.
 * Used to determine document length for progressive reading.
 */
export const getDocumentChunkCount = action({
  args: {
    documentId: v.string(),
    caseId: v.string()
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const { documentId, caseId } = args;

    try {
      console.log("Getting chunk count for document:", { documentId, caseId });

      // Test connection first
      try {
        await client.getCollections();
      } catch (connError) {
        console.error("Qdrant connection failed:", connError);
        const errorMessage = connError instanceof Error ? connError.message : String(connError);
        throw new Error(`Cannot connect to Qdrant: ${errorMessage}`);
      }

      const collectionName = `case-${caseId}`;

      // Use scroll API to count all chunks for this document
      const results = await client.scroll(collectionName, {
        filter: {
          must: [
            {
              key: "documentId",
              match: { value: documentId }
            }
          ]
        },
        limit: 10000, // Large limit to get all chunks
        with_payload: false, // Only need count, not content
        with_vector: false
      });

      const count = results.points?.length || 0;
      
      console.log("Document chunk count:", { documentId, count });
      
      return count;

    } catch (error) {
      console.error("Error getting chunk count:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get chunk count: ${errorMessage}`);
    }
  }
});

/**
 * Action that deletes all chunks for a specific document from Qdrant.
 * Used when a document is deleted from the system.
 */
export const deleteDocumentChunks = internalAction({
  args: {
    documentId: v.string(),
    caseId: v.string()
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const { documentId, caseId } = args;

    try {
      console.log("Deleting document chunks from Qdrant:", { documentId, caseId });

      // Test connection first
      try {
        await client.getCollections();
      } catch (connError) {
        console.error("Qdrant connection failed:", connError);
        const errorMessage = connError instanceof Error ? connError.message : String(connError);
        throw new Error(`Cannot connect to Qdrant: ${errorMessage}`);
      }

      const collectionName = `ialex_documents`;

      // First, find all points for this document
      const results = await client.scroll(collectionName, {
        filter: {
          must: [
            {
              key: "documentId",
              match: { value: documentId }
            },
            {
              key: "caseId",
              match: { value: caseId }
            }
          ]
        },
        limit: 10000, // Large limit to get all chunks
        with_payload: false,
        with_vector: false
      });

      if (!results.points || results.points.length === 0) {
        console.log("No chunks found for document:", documentId);
        return true;
      }

      // Extract point IDs for deletion
      const pointIds = results.points.map(point => point.id);
      
      console.log(`Found ${pointIds.length} chunks to delete for document:`, documentId);

      // Delete all points for this document
      await client.delete(collectionName, {
        wait: true,
        points: pointIds
      });

      console.log("Successfully deleted document chunks:", { documentId, chunksDeleted: pointIds.length });
      return true;

    } catch (error) {
      console.error("Error deleting document chunks:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to delete document chunks: ${errorMessage}`);
    }
  }
});

export default client;