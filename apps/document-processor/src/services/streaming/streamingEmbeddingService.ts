import OpenAI from "openai";
import { logger } from '../../middleware/logging';
import { upsertChunks } from '../qdrantService';
import { TempFileManager } from '../../utils/tempFileManager';
import { StreamingJobState } from '../../types/jobState';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000,
  maxRetries: 3,
});

export interface EmbeddingStreamOptions {
  embedBatchSize?: number;
  upsertBatchSize?: number;
  onProgress?: (embedded: number, upserted: number) => Promise<void>;
}

export class StreamingEmbeddingService {
  private tempFileManager: TempFileManager;
  private model: string;
  private embeddingsFile: string = 'embeddings.jsonl';

  constructor(tempFileManager: TempFileManager, model = 'text-embedding-3-small') {
    this.tempFileManager = tempFileManager;
    this.model = model;
  }

  /**
   * Embed and upsert chunks incrementally (no full-array accumulation)
   * Supports resume by skipping already embedded chunks
   */
  async embedAndUpsertStreamWithResume(
    chunks: Array<{ index: number; text: string }>,
    createdBy: string,
    caseId: string,
    documentId: string,
    state: StreamingJobState,
    options: EmbeddingStreamOptions = {}
  ): Promise<{ totalEmbedded: number; totalUpserted: number; skipped: number }> {
    const { 
      embedBatchSize = 64,
      upsertBatchSize = 20,
      onProgress 
    } = options;

    // Skip chunks already embedded
    const chunksToProcess = chunks.filter(chunk => chunk.index >= state.progress.lastEmbeddedIndex);
    
    if (chunksToProcess.length === 0) {
      logger.info('All chunks already embedded, skipping', {
        totalChunks: chunks.length,
        lastEmbeddedIndex: state.progress.lastEmbeddedIndex
      });
      
      return {
        totalEmbedded: state.progress.chunksEmbedded,
        totalUpserted: state.progress.chunksUpserted,
        skipped: chunks.length
      };
    }

    logger.info('Embedding chunks with resume', {
      totalChunks: chunks.length,
      toProcess: chunksToProcess.length,
      skipped: chunks.length - chunksToProcess.length,
      resumingFrom: state.progress.lastEmbeddedIndex
    });

    let totalEmbedded = state.progress.chunksEmbedded;
    let totalUpserted = state.progress.chunksUpserted;
    let embeddingBuffer: Array<{ id: string; vector: number[]; text: string; metadata: Record<string, unknown> }> = [];

    // Process chunks in embedding batches
    for (let i = 0; i < chunksToProcess.length; i += embedBatchSize) {
      const batch = chunksToProcess.slice(i, Math.min(i + embedBatchSize, chunksToProcess.length));
      
      try {
        logger.debug('Embedding batch', { 
          start: batch[0].index, 
          size: batch.length,
          total: chunksToProcess.length 
        });

        const resp = await openai.embeddings.create({ 
          model: this.model, 
          input: batch.map(c => c.text)
        });

        resp.data.forEach((d, idx) => {
          const chunk = batch[idx];
          embeddingBuffer.push({
            id: String(chunk.index),
            vector: d.embedding,
            text: chunk.text,
            metadata: { chunkIndex: chunk.index }
          });
        });

        totalEmbedded += batch.length;

        // Save embeddings to file for potential resume
        await this.appendEmbeddingsToFile(
          embeddingBuffer.slice(-batch.length)
        );

        // Update state progress
        state.progress.chunksEmbedded = totalEmbedded;
        state.progress.lastEmbeddedIndex = batch[batch.length - 1].index + 1;

        // Upsert when buffer reaches threshold
        if (embeddingBuffer.length >= upsertBatchSize) {
          await this.upsertBatch(
            createdBy,
            caseId,
            documentId,
            embeddingBuffer,
            state
          );
          
          totalUpserted += embeddingBuffer.length;
          state.progress.chunksUpserted = totalUpserted;
          state.progress.lastUpsertedIndex = embeddingBuffer[embeddingBuffer.length - 1].metadata.chunkIndex as number + 1;
          
          embeddingBuffer = [];

          if (onProgress) {
            await onProgress(totalEmbedded, totalUpserted);
          }
        }

      } catch (error) {
        logger.error('Embedding batch failed', { 
          startIndex: batch[0].index,
          endIndex: batch[batch.length - 1].index,
          error: String(error) 
        });
        throw error;
      }
    }

    // Upsert remaining buffer
    if (embeddingBuffer.length > 0) {
      await this.upsertBatch(
        createdBy,
        caseId,
        documentId,
        embeddingBuffer,
        state
      );
      
      totalUpserted += embeddingBuffer.length;
      state.progress.chunksUpserted = totalUpserted;
      state.progress.lastUpsertedIndex = embeddingBuffer[embeddingBuffer.length - 1].metadata.chunkIndex as number + 1;
      
      if (onProgress) {
        await onProgress(totalEmbedded, totalUpserted);
      }
    }

    logger.info('Streaming embedding and upsert completed', { 
      totalEmbedded, 
      totalUpserted 
    });

    return {
      totalEmbedded,
      totalUpserted,
      skipped: chunks.length - chunksToProcess.length
    };
  }

  private async upsertBatch(
    createdBy: string,
    caseId: string,
    documentId: string,
    embeddings: Array<{ id: string; vector: number[]; text: string; metadata: Record<string, unknown> }>,
    state: StreamingJobState
  ): Promise<void> {
    try {
      await upsertChunks(createdBy, caseId, documentId, embeddings, {});
      logger.debug('Upserted batch', { 
        count: embeddings.length,
        lastIndex: embeddings[embeddings.length - 1].metadata.chunkIndex 
      });
    } catch (error) {
      logger.error('Upsert batch failed', { 
        count: embeddings.length,
        error: String(error) 
      });
      throw error;
    }
  }

  private async appendEmbeddingsToFile(
    embeddings: Array<{ id: string; vector: number[]; text: string; metadata: Record<string, unknown> }>
  ): Promise<void> {
    const lines = embeddings.map(emb => JSON.stringify(emb));
    await this.tempFileManager.appendFile(this.embeddingsFile, lines.join('\n') + '\n');
  }
}
