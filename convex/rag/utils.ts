import { defaultChunker } from "@convex-dev/rag";

/**
 * TODO: IMPLEMENT DOCUMENT CHUNKING STRATEGY
 * Placeholder function for chunking document content.
 * 
 * @param content - The document text content
 * @param config - Chunking configuration
 * @returns Promise<Array> - Array of chunks with metadata
 */
export const chunkDocumentContent = async (content: string) => {

   const chunks = defaultChunker(content, {
    minLines: 1,
    minCharsSoftLimit: 100,
    maxCharsSoftLimit: 1000,
    maxCharsHardLimit: 10000,
    delimiter: "\n\n",
    
   })

   return chunks;
    
  };