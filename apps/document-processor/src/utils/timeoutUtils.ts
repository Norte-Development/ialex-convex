import { logger } from '../middleware/logging.js';

// Timeout configurations (in milliseconds) - Increased for better stability
export const TIMEOUTS = {
  FILE_VALIDATION: parseInt(process.env.FILE_VALIDATION_TIMEOUT_MS || '30000'), // 30s
  FILE_DOWNLOAD: parseInt(process.env.FILE_DOWNLOAD_TIMEOUT_MS || '600000'), // 10min
  OCR_REQUEST: parseInt(process.env.OCR_REQUEST_TIMEOUT_MS || '900000'), // 15min
  TRANSCRIPTION_REQUEST: parseInt(process.env.TRANSCRIPTION_REQUEST_TIMEOUT_MS || '1200000'), // 20min
  EXTRACTION_PROCESSING: parseInt(process.env.EXTRACTION_PROCESSING_TIMEOUT_MS || '600000'), // 10min
  CHUNKING_PROCESSING: parseInt(process.env.CHUNKING_PROCESSING_TIMEOUT_MS || '120000'), // 2min
  EMBEDDING_REQUEST: parseInt(process.env.EMBEDDING_REQUEST_TIMEOUT_MS || '300000'), // 5min
  QDRANT_UPSERT: parseInt(process.env.QDRANT_UPSERT_TIMEOUT_MS || '60000'), // 1min
};

export class TimeoutError extends Error {
  constructor(message: string, public readonly operation: string, public readonly timeoutMs: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Wraps a promise with a timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const error = new TimeoutError(
        `${operation} timed out after ${timeoutMs}ms`,
        operation,
        timeoutMs
      );
      logger.warn('Operation timed out', {
        operation,
        timeoutMs,
        error: error.message
      });
      reject(error);
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

/**
 * Wraps a function call with timeout and error handling
 */
export async function withTimeoutAndRetry<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName: string,
  maxRetries: number = 1
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug('Starting operation with timeout', {
        operation: operationName,
        attempt,
        maxRetries,
        timeoutMs
      });

      const result = await withTimeout(operation(), timeoutMs, operationName);

      if (attempt > 1) {
        logger.info('Operation succeeded after retry', {
          operation: operationName,
          attempt,
          totalAttempts: attempt
        });
      }

      return result;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      logger.warn('Operation failed', {
        operation: operationName,
        attempt,
        maxRetries,
        error: lastError.message,
        isTimeout: lastError instanceof TimeoutError
      });

      // Don't retry on timeout errors or if this was the last attempt
      if (lastError instanceof TimeoutError || attempt === maxRetries) {
        break;
      }

      // Wait before retry (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Creates a timeout wrapper for specific operation types
 */
export function createTimeoutWrapper(operationType: keyof typeof TIMEOUTS, maxRetries: number = 1) {
  const timeoutMs = TIMEOUTS[operationType];

  return function <T>(operation: () => Promise<T>, operationName?: string): Promise<T> {
    const name = operationName || operationType.toLowerCase().replace('_', ' ');
    return withTimeoutAndRetry(operation, timeoutMs, name, maxRetries);
  };
}

// Pre-configured timeout wrappers with enhanced retry logic
export const timeoutWrappers = {
  fileValidation: createTimeoutWrapper('FILE_VALIDATION', 2), // Retry validation once
  fileDownload: createTimeoutWrapper('FILE_DOWNLOAD', 3), // Retry downloads up to 3 times
  ocrRequest: createTimeoutWrapper('OCR_REQUEST', 3), // Retry OCR up to 3 times
  transcriptionRequest: createTimeoutWrapper('TRANSCRIPTION_REQUEST', 2), // Retry transcription once
  extractionProcessing: createTimeoutWrapper('EXTRACTION_PROCESSING', 2), // Retry extraction once
  chunkingProcessing: createTimeoutWrapper('CHUNKING_PROCESSING', 2), // Retry chunking once
  embeddingRequest: createTimeoutWrapper('EMBEDDING_REQUEST', 3), // Retry embedding up to 3 times
  qdrantUpsert: createTimeoutWrapper('QDRANT_UPSERT', 5), // Retry upsert up to 5 times
};

/**
 * Gets timeout configuration for monitoring/debugging
 */
export function getTimeoutConfig() {
  return {
    timeouts: TIMEOUTS,
    totalMaxTimePerDocument: Object.values(TIMEOUTS).reduce((sum, timeout) => sum + timeout, 0)
  };
}
