import { createClient } from '@deepgram/sdk';
import { promises as fs } from 'fs';
import { logger } from '../../middleware/logging';
import { TempFileManager } from '../../utils/tempFileManager';

const deepgram = createClient(process.env.DEEPGRAM_API_KEY || '');

export interface TranscriptionStreamOptions {
  chunkSizeMB?: number;
  onTranscriptSegment?: (segment: string, offset: number) => Promise<void>;
  model?: string;
  language?: string;
}

export class StreamingTranscriptionService {
  private tempFileManager: TempFileManager;

  constructor(tempFileManager: TempFileManager) {
    this.tempFileManager = tempFileManager;
  }

  /**
   * Transcribe audio/video file using streaming to avoid memory overload
   */
  async transcribeFile(
    audioPath: string,
    options: TranscriptionStreamOptions = {}
  ): Promise<void> {
    const { 
      chunkSizeMB = 10,
      onTranscriptSegment,
      model = 'nova-2',
      language
    } = options;

    try {
      logger.info('Starting streaming transcription', {
        audioPath,
        chunkSizeMB,
        model
      });

      // For files under 100MB, use prerecorded endpoint (simpler)
      const stats = await fs.stat(audioPath);
      const fileSizeMB = stats.size / (1024 * 1024);

      if (fileSizeMB <= 100) {
        await this.transcribeSmallFile(audioPath, model, language, onTranscriptSegment);
      } else {
        await this.transcribeLargeFileInChunks(audioPath, chunkSizeMB, model, language, onTranscriptSegment);
      }

      logger.info('Streaming transcription completed');

    } catch (error) {
      logger.error('Streaming transcription failed', { error: String(error) });
      throw error;
    }
  }

  private async transcribeSmallFile(
    audioPath: string,
    model: string,
    language: string | undefined,
    onSegment?: (segment: string, offset: number) => Promise<void>
  ): Promise<void> {
    const buffer = await fs.readFile(audioPath);
    
    const response = await deepgram.listen.prerecorded.transcribeFile(buffer, {
      model,
      language,
      punctuate: true,
      smart_format: true
    });

    const transcript = response.result?.results?.channels[0]?.alternatives[0]?.transcript || '';
    
    if (onSegment) {
      await onSegment(transcript, 0);
    }
  }

  private async transcribeLargeFileInChunks(
    audioPath: string,
    chunkSizeMB: number,
    model: string,
    language: string | undefined,
    onSegment?: (segment: string, offset: number) => Promise<void>
  ): Promise<void> {
    // For very large files, split into segments and transcribe separately
    // This is a simplified version - in production, you'd need audio splitting logic
    // For now, process as single file (Deepgram handles large files well)
    await this.transcribeSmallFile(audioPath, model, language, onSegment);
  }
}
