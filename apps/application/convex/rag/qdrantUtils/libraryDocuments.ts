'use node'

import { action, internalAction } from "../../_generated/server";
import { v } from "convex/values";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import { client } from "./client";

/**
 * Action that performs semantic chunk clustering and context window expansion for library documents.
 * Returns the combined text from relevant library document chunks.
 * Searches across user's personal library and all accessible team libraries.
 */
export const searchLibraryDocumentsWithClustering = action({
  args: {
    query: v.string(),
    userId: v.string(),
    teamIds: v.array(v.string()),
    limit: v.number(),
    contextWindow: v.number(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const { query, userId, teamIds, limit, contextWindow } = args;

    try {
      console.log("Starting library search with params:", { query, userId, teamIds, limit, contextWindow });

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

      // Build filter to include personal library + all team libraries
      const shouldFilters = [
        {
          key: "userId",
          match: { value: userId }
        }
      ];

      // Add team filters
      for (const teamId of teamIds) {
        shouldFilters.push({
          key: "teamId",
          match: { value: teamId }
        });
      }

      // Step 1: Initial search to get candidates
      console.log("Attempting Qdrant search for library documents...");
      const initialResults = await client.search('ialex_library_documents', {
        vector: vector.embedding,
        limit: limit * 2, // Get more candidates for clustering
        filter: {
          should: shouldFilters
        }
      });

      console.log("Initial library search completed, results:", initialResults.length);

      if (initialResults.length === 0) {
        console.log("No results found in library");
        return "";
      }

      // Step 2: Group results by libraryDocumentId and identify clusters
      const documentClusters = new Map<string, Array<any>>();

      for (const result of initialResults) {
        const libraryDocumentId = result.payload?.libraryDocumentId;
        if (!libraryDocumentId) continue;

        if (!documentClusters.has(libraryDocumentId as string)) {
          documentClusters.set(libraryDocumentId as string, []);
        }
        documentClusters.get(libraryDocumentId as string)!.push(result);
      }

      // Step 3: For each cluster, expand context by retrieving adjacent chunks
      const expandedResults = [];

      for (const [libraryDocumentId, chunks] of documentClusters) {
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

          // Build filter for adjacent chunks
          const adjacentFilter: any = {
            must: [
              {
                key: "libraryDocumentId",
                match: { value: libraryDocumentId }
              },
              {
                key: "chunkIndex",
                range: {
                  gte: startIndex,
                  lte: endIndex
                }
              }
            ]
          };

          // Query for adjacent chunks
          const adjacentChunks = await client.search('ialex_library_documents', {
            vector: vector.embedding, // Use same vector for consistency
            limit: 100, // Large limit to get all potential adjacent chunks
            filter: adjacentFilter
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

      console.log("Returning combined library text, length:", finalText.length);
      return finalText;

    } catch (error) {
      console.error("Error in searchLibraryDocumentsWithClustering:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      const errorName = error instanceof Error ? error.name : typeof error;

      console.error("Error details:", {
        message: errorMessage,
        stack: errorStack,
        name: errorName
      });
      throw new Error(`Library search failed: ${errorMessage}`);
    }
  }
});

/**
 * Action that retrieves a specific library document chunk by index from Qdrant.
 * Used for progressive document reading instead of similarity search.
 */
export const getLibraryDocumentChunkByIndex = action({
  args: {
    libraryDocumentId: v.string(),
    chunkIndex: v.number()
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const { libraryDocumentId, chunkIndex } = args;

    try {
      console.log("Fetching library chunk by index:", { libraryDocumentId, chunkIndex });

      // Test connection first
      try {
        await client.getCollections();
      } catch (connError) {
        console.error("Qdrant connection failed:", connError);
        const errorMessage = connError instanceof Error ? connError.message : String(connError);
        throw new Error(`Cannot connect to Qdrant: ${errorMessage}`);
      }

      const collectionName = `ialex_library_documents`;

      // Use scroll API with metadata filters to find specific chunk
      const results = await client.scroll(collectionName, {
        filter: {
          must: [
            {
              key: "libraryDocumentId",
              match: { value: libraryDocumentId }
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

      console.log("Successfully retrieved library chunk:", {
        chunkIndex,
        textLength: chunkText.length
      });

      return chunkText;

    } catch (error) {
      console.error("Error fetching library chunk by index:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch library chunk: ${errorMessage}`);
    }
  }
});

/**
 * Action that retrieves multiple consecutive library document chunks by range from Qdrant.
 * Used for reading multiple chunks at once in progressive document reading.
 */
export const getLibraryDocumentChunksByRange = action({
  args: {
    libraryDocumentId: v.string(),
    startIndex: v.number(),
    endIndex: v.number()
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const { libraryDocumentId, startIndex, endIndex } = args;

    try {
      console.log("Fetching library chunks by range:", { libraryDocumentId, startIndex, endIndex });

      // Test connection first
      try {
        await client.getCollections();
      } catch (connError) {
        console.error("Qdrant connection failed:", connError);
        const errorMessage = connError instanceof Error ? connError.message : String(connError);
        throw new Error(`Cannot connect to Qdrant: ${errorMessage}`);
      }

      const collectionName = `ialex_library_documents`;

      // Use scroll API with metadata filters to find chunks in range
      const results = await client.scroll(collectionName, {
        filter: {
          must: [
            {
              key: "libraryDocumentId",
              match: { value: libraryDocumentId }
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
        console.log("No library chunks found in range:", { startIndex, endIndex });
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

      console.log("Successfully retrieved library chunks:", {
        startIndex,
        endIndex,
        chunksRetrieved: chunksText.length,
        totalTextLength: chunksText.reduce((sum, text) => sum + text.length, 0)
      });

      return chunksText;

    } catch (error) {
      console.error("Error fetching library chunks by range:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch library chunks: ${errorMessage}`);
    }
  }
});

/**
 * Action that performs semantic search within a specific library document.
 * Searches for the most relevant chunks within a single document based on a query.
 */
export const searchLibraryDocumentChunks = action({
  args: {
    libraryDocumentId: v.string(),
    query: v.string(),
    limit: v.number()
  },
  returns: v.array(v.object({
    chunkIndex: v.number(),
    text: v.string(),
    score: v.number()
  })),
  handler: async (ctx, args) => {
    const { libraryDocumentId, query, limit } = args;

    try {
      console.log("Searching library document chunks:", { libraryDocumentId, query, limit });

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

      // Perform semantic search within the specific library document
      const results = await client.search('ialex_library_documents', {
        vector: vector.embedding,
        limit: limit,
        filter: {
          must: [
            {
              key: "libraryDocumentId",
              match: { value: libraryDocumentId }
            }
          ]
        }
      });

      console.log("Library document search completed, results:", results.length);

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
      console.error("Error searching library document chunks:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Search failed: ${errorMessage}`);
    }
  }
});

/**
 * Action that gets the total number of chunks for a library document from Qdrant.
 * Used to determine document length for progressive reading.
 */
export const getLibraryDocumentChunkCount = action({
  args: {
    libraryDocumentId: v.string()
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const { libraryDocumentId } = args;

    try {
      console.log("Getting chunk count for library document:", { libraryDocumentId });

      // Test connection first
      try {
        await client.getCollections();
      } catch (connError) {
        console.error("Qdrant connection failed:", connError);
        const errorMessage = connError instanceof Error ? connError.message : String(connError);
        throw new Error(`Cannot connect to Qdrant: ${errorMessage}`);
      }

      const collectionName = `ialex_library_documents`;

      // Use scroll API to count all chunks for this document
      const results = await client.scroll(collectionName, {
        filter: {
          must: [
            {
              key: "libraryDocumentId",
              match: { value: libraryDocumentId }
            }
          ]
        },
        limit: 10000, // Large limit to get all chunks
        with_payload: false, // Only need count, not content
        with_vector: false
      });

      const count = results.points?.length || 0;

      console.log("Library document chunk count:", { libraryDocumentId, count });

      return count;

    } catch (error) {
      console.error("Error getting library chunk count:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get chunk count: ${errorMessage}`);
    }
  }
});

/**
 * Action that deletes all chunks for a specific library document from Qdrant.
 * Used when a library document is deleted from the system.
 */
export const deleteLibraryDocumentChunksFromQdrant = internalAction({
  args: {
    libraryDocumentId: v.string()
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const { libraryDocumentId } = args;

    try {
      console.log("Deleting library document chunks from Qdrant:", { libraryDocumentId });

      // Test connection first
      try {
        await client.getCollections();
      } catch (connError) {
        console.error("Qdrant connection failed:", connError);
        const errorMessage = connError instanceof Error ? connError.message : String(connError);
        throw new Error(`Cannot connect to Qdrant: ${errorMessage}`);
      }

      const collectionName = `ialex_library_documents`;

      // First, find all points for this library document
      const results = await client.scroll(collectionName, {
        filter: {
          must: [
            {
              key: "libraryDocumentId",
              match: { value: libraryDocumentId }
            }
          ]
        },
        limit: 10000, // Large limit to get all chunks
        with_payload: false,
        with_vector: false
      });

      if (!results.points || results.points.length === 0) {
        console.log("No chunks found for library document:", libraryDocumentId);
        return true;
      }

      // Extract point IDs for deletion
      const pointIds = results.points.map(point => point.id);

      console.log(`Found ${pointIds.length} chunks to delete for library document:`, libraryDocumentId);

      // Delete all points for this library document
      await client.delete(collectionName, {
        wait: true,
        points: pointIds
      });

      console.log("Successfully deleted library document chunks:", { libraryDocumentId, chunksDeleted: pointIds.length });
      return true;

    } catch (error) {
      console.error("Error deleting library document chunks:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to delete library document chunks: ${errorMessage}`);
    }
  }
});

