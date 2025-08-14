'use node'
import {QdrantClient} from '@qdrant/js-client-rest';
import { action } from "../_generated/server";
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

export default client;