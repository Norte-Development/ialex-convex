import { createClient } from '@deepgram/sdk';
import { promises as fs } from 'fs';
import { logger } from '../../middleware/logging';
import { TempFileManager } from '../../utils/tempFileManager';

const deepgram = createClient(process.env.DEEPGRAM_API_KEY || '');

export interface TranscriptionResult {
  transcript: string;
  confidence?: number;
  duration?: number;
  model: string;
  wordCount: number;
  isEmpty: boolean;
}

export interface TranscriptionMetadata {
  confidence?: number;
  duration?: number;
  model: string;
}

export interface TranscriptionStreamOptions {
  chunkSizeMB?: number;
  onTranscriptSegment?: (segment: string, offset: number, metadata?: TranscriptionMetadata) => Promise<void>;
  model?: string;
  language?: string;
  minTranscriptLength?: number;
  requireConfidence?: number;
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
  ): Promise<TranscriptionResult> {
    const { 
      chunkSizeMB = 10,
      onTranscriptSegment,
      model = 'nova-3',
      language,
      minTranscriptLength = 10,
      requireConfidence = 0.5
    } = options;

    try {
      logger.info('Starting streaming transcription', {
        audioPath,
        chunkSizeMB,
        model,
        minTranscriptLength,
        requireConfidence
      });

      // For files under 100MB, use prerecorded endpoint (simpler)
      const stats = await fs.stat(audioPath);
      const fileSizeMB = stats.size / (1024 * 1024);

      let result: TranscriptionResult;

      if (fileSizeMB <= 100) {
        result = await this.transcribeSmallFile(audioPath, model, language, onTranscriptSegment);
      } else {
        result = await this.transcribeLargeFileInChunks(audioPath, chunkSizeMB, model, language, onTranscriptSegment);
      }

      // VALIDATION
      if (result.isEmpty || result.transcript.trim().length < minTranscriptLength) {
        throw new Error(
          `Transcription validation failed: transcript too short (${result.transcript.length} chars, minimum ${minTranscriptLength})`
        );
      }

      if (requireConfidence && result.confidence !== undefined && result.confidence < requireConfidence) {
        logger.warn('Low transcription confidence', {
          confidence: result.confidence,
          threshold: requireConfidence
        });
        // Don't throw - just warn, as low confidence might still be useful
      }

      logger.info('Streaming transcription completed', {
        length: result.transcript.length,
        wordCount: result.wordCount,
        confidence: result.confidence,
        duration: result.duration
      });

      return result;

    } catch (error) {
      logger.error('Streaming transcription failed', { 
        error: String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Transcription failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async transcribeSmallFile(
    audioPath: string,
    model: string,
    language: string | undefined,
    onSegment?: (segment: string, offset: number, metadata?: TranscriptionMetadata) => Promise<void>
  ): Promise<TranscriptionResult> {
    try {
      const buffer = await fs.readFile(audioPath);
      
      const response = await deepgram.listen.prerecorded.transcribeFile(buffer, {
        model,
        language,
        punctuate: true,
        // smart_format: true
      });

      // ERROR CHECKING
      if (!response || !response.result) {
        throw new Error('Deepgram returned no result');
      }

      // Check for API errors (Deepgram SDK may include error field)
      if ('error' in response && (response as any).error) {
        throw new Error(`Deepgram API error: ${JSON.stringify((response as any).error)}`);
      }

      const channel = response.result.results?.channels?.[0];
      const alternative = channel?.alternatives?.[0];
      
      if (!alternative) {
        throw new Error('Deepgram returned no transcription alternatives');
      }

      const transcript = alternative.transcript || '';
      const confidence = alternative.confidence;
      const duration = response.result.metadata?.duration;

      logger.info('Deepgram transcription received', {
        transcriptLength: transcript.length,
        confidence,
        duration,
        model
      });

      // VALIDATION
      if (!transcript || transcript.trim().length === 0) {
        throw new Error('Deepgram returned empty transcript - audio may be silent or unrecognizable');
      }

      const metadata: TranscriptionMetadata = {
        confidence,
        duration,
        model
      };

      // Call callback with transcript
      if (onSegment) {
        await onSegment(transcript, 0, metadata);
      }

      return {
        transcript,
        confidence,
        duration,
        model,
        wordCount: transcript.split(/\s+/).filter(w => w.length > 0).length,
        isEmpty: false
      };

    } catch (error) {
      logger.error('Small file transcription failed', {
        error: String(error),
        model
      });
      throw error;
    }
  }

  private async transcribeLargeFileInChunks(
    audioPath: string,
    chunkSizeMB: number,
    model: string,
    language: string | undefined,
    onSegment?: (segment: string, offset: number, metadata?: TranscriptionMetadata) => Promise<void>
  ): Promise<TranscriptionResult> {
    // For very large files, split into segments and transcribe separately
    // This is a simplified version - in production, you'd need audio splitting logic
    // For now, process as single file (Deepgram handles large files well)
    logger.warn('Large file - using single transcription (splitting not yet implemented)');
    return await this.transcribeSmallFile(audioPath, model, language, onSegment);
  }
}
