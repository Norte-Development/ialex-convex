import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { logger } from '../../middleware/logging';
import { TempFileManager } from '../../utils/tempFileManager';
import { StreamingJobState } from '../../types/jobState';

export interface ChunkingStreamOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  onChunkBatch?: (chunks: string[], startIndex: number) => Promise<void>;
  batchSize?: number;
}

export class StreamingChunkingService {
  private tempFileManager: TempFileManager;
  private splitter: RecursiveCharacterTextSplitter;
  private chunksFile: string = 'chunks.jsonl';

  constructor(tempFileManager: TempFileManager, chunkSize = 1000, chunkOverlap = 0) {
    this.tempFileManager = tempFileManager;
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap
    });
  }

  /**
   * Process text incrementally - chunk as segments arrive
   * Supports resume by tracking chunk indices
   */
  async processTextStreamWithResume(
    textSegment: string,
    state: StreamingJobState,
    options: ChunkingStreamOptions = {}
  ): Promise<string[]> {
    const { batchSize = 10, onChunkBatch } = options;

    const chunks = await this.splitter.splitText(textSegment);

    // Start indexing from last chunk index
    let currentIndex = state.progress.lastChunkIndex;

    // Append chunks to persistent file
    await this.appendChunksToFile(chunks, currentIndex);

    // Process in batches
    if (onChunkBatch) {
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, Math.min(i + batchSize, chunks.length));
        await onChunkBatch(batch, currentIndex + i);
      }
    }

    // Update state
    state.progress.lastChunkIndex = currentIndex + chunks.length;
    state.progress.chunksGenerated = currentIndex + chunks.length;
    state.progress.chunksFilePath = this.chunksFile;

    return chunks;
  }

  /**
   * Append chunks to JSONL file with index tracking
   */
  private async appendChunksToFile(chunks: string[], startIndex: number): Promise<void> {
    const lines = chunks.map((chunk, idx) => 
      JSON.stringify({ 
        index: startIndex + idx, 
        text: chunk 
      })
    );
    
    await this.tempFileManager.appendFile(this.chunksFile, lines.join('\n') + '\n');
  }

  /**
   * Read chunks from file starting from a specific index
   */
  async readChunksFromIndex(startIndex: number): Promise<Array<{ index: number; text: string }>> {
    try {
      const content = await this.tempFileManager.readFile(this.chunksFile);
      
      const allChunks = content
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line) as { index: number; text: string });
      
      return allChunks.filter(chunk => chunk.index >= startIndex);
    } catch (error) {
      logger.warn('No existing chunks file found', { error: String(error) });
      return [];
    }
  }

  /**
   * Get total chunk count from file
   */
  async getChunkCount(): Promise<number> {
    try {
      const content = await this.tempFileManager.readFile(this.chunksFile);
      return content.trim().split('\n').filter(Boolean).length;
    } catch {
      return 0;
    }
  }
}
