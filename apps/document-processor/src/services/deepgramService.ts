import { createClient } from '@deepgram/sdk';
import { logger } from '../middleware/logging.js';
import { timeoutWrappers } from '../utils/timeoutUtils.js';

// Deepgram concurrency limits
const MAX_CONCURRENT_REQUESTS = parseInt(process.env.DEEPGRAM_MAX_CONCURRENT || '100');
const REQUEST_TIMEOUT_MS = parseInt(process.env.DEEPGRAM_REQUEST_TIMEOUT_MS || '300000'); // 5 minutes

// Initialize Deepgram client
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// Queue for managing concurrent requests
class DeepgramQueue {
  private activeRequests = 0;
  private queue: Array<{
    request: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }> = [];

  async enqueue<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Remove from queue if still pending
        const index = this.queue.findIndex(item => item.timeout === timeout);
        if (index !== -1) {
          this.queue.splice(index, 1);
        }
        reject(new Error(`Deepgram request timed out after ${REQUEST_TIMEOUT_MS}ms`));
      }, REQUEST_TIMEOUT_MS);

      this.queue.push({ request, resolve, reject, timeout });

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.activeRequests >= MAX_CONCURRENT_REQUESTS || this.queue.length === 0) {
      return;
    }

    const { request, resolve, reject, timeout } = this.queue.shift()!;
    this.activeRequests++;

    try {
      const result = await request();
      clearTimeout(timeout);
      resolve(result);
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    } finally {
      this.activeRequests--;
      // Process next item in queue
      setImmediate(() => this.processQueue());
    }
  }

  getStats() {
    return {
      activeRequests: this.activeRequests,
      queuedRequests: this.queue.length,
      maxConcurrent: MAX_CONCURRENT_REQUESTS
    };
  }
}

// Global queue instance
const deepgramQueue = new DeepgramQueue();

export interface TranscriptionOptions {
  model?: string;
  language?: string;
  punctuate?: boolean;
  smart_format?: boolean;
}

export interface TranscriptionResult {
  transcript: string;
  confidence?: number;
  duration?: number;
  metadata?: any;
}

/**
 * Transcribes audio using Deepgram with concurrency control
 */
export async function transcribeAudio(
  buffer: Buffer,
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult> {
  const startTime = Date.now();

  try {
    logger.info("Starting Deepgram transcription", {
      bufferSize: buffer.length,
      options,
      queueStats: deepgramQueue.getStats()
    });

    const result = await deepgramQueue.enqueue(async () => {
      const transcriptionOptions = {
        model: options.model || 'nova-2',
        language: options.language,
        punctuate: options.punctuate ?? true,
        smart_format: options.smart_format ?? true,
      };

      logger.debug("Making Deepgram API request", { transcriptionOptions });

      const response = await timeoutWrappers.transcriptionRequest(
        () => deepgram.listen.prerecorded.transcribeFile(buffer, transcriptionOptions),
        'Deepgram transcription'
      );

      if (response.error) {
        logger.error('Deepgram API error', { error: response.error });
        throw new Error(`Deepgram API error: ${response.error.message}`);
      }

      const transcript = response.result?.results?.channels[0]?.alternatives[0]?.transcript || '';
      const confidence = response.result?.results?.channels[0]?.alternatives[0]?.confidence;
      const duration = response.result?.metadata?.duration;

      if (!transcript.trim()) {
        throw new Error("No speech detected in audio file");
      }

      return {
        transcript: transcript.trim(),
        confidence,
        duration,
        metadata: response.result?.metadata
      };
    });

    const processingTime = Date.now() - startTime;

    logger.info("Deepgram transcription completed", {
      transcriptLength: result.transcript.length,
      confidence: result.confidence,
      duration: result.duration,
      processingTimeMs: processingTime,
      queueStats: deepgramQueue.getStats()
    });

    return result;

  } catch (error) {
    const processingTime = Date.now() - startTime;

    logger.error("Deepgram transcription failed", {
      error: String(error),
      processingTimeMs: processingTime,
      queueStats: deepgramQueue.getStats()
    });

    throw new Error(`Deepgram transcription failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Gets current Deepgram queue statistics
 */
export function getDeepgramStats() {
  return deepgramQueue.getStats();
}

/**
 * Checks if Deepgram is available (has API key)
 */
export function isDeepgramAvailable(): boolean {
  return !!process.env.DEEPGRAM_API_KEY;
}
