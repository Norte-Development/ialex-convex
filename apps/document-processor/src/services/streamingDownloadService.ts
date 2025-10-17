import { Readable } from 'stream';
import { createWriteStream, createReadStream } from 'fs';
import { promises as fs } from 'fs';
import fetch from 'node-fetch';
import { pipeline } from 'stream/promises';
import { logger } from '../middleware/logging';
import { TempFileManager } from '../utils/tempFileManager';
import { StreamingJobState } from '../types/jobState';

export interface DownloadProgress {
  bytesDownloaded: number;
  bytesTotal: number | null;
  percentComplete: number | null;
}

export interface StreamDownloadOptions {
  chunkSize?: number;
  onProgress?: (progress: DownloadProgress) => void;
  maxRetries?: number;
}

export class StreamingDownloadService {
  private tempFileManager: TempFileManager;

  constructor(tempFileManager: TempFileManager) {
    this.tempFileManager = tempFileManager;
  }

  /**
   * Download file to disk using streaming (never load full file to memory)
   * Supports HTTP Range requests for resume capability
   */
  async downloadToFileWithResume(
    signedUrl: string,
    filename: string,
    state: StreamingJobState,
    options: StreamDownloadOptions = {}
  ): Promise<string> {
    const { onProgress, maxRetries = 3 } = options;
    const filePath = this.tempFileManager.getPath(filename);

    // Check if partial download exists
    let startByte = 0;
    try {
      const stats = await fs.stat(filePath);
      startByte = stats.size;
      logger.info('Resuming download from byte', { startByte, filePath });
    } catch {
      startByte = 0;
    }

    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt < maxRetries) {
      try {
        attempt++;
        logger.info('Starting streaming download', { 
          url: signedUrl.substring(0, 50) + '...', 
          attempt,
          filePath,
          resumeFrom: startByte
        });

        const headers: Record<string, string> = {};
        
        // Add Range header if resuming
        if (startByte > 0) {
          headers['Range'] = `bytes=${startByte}-`;
        }

        const response = await fetch(signedUrl, { headers });
        
        if (!response.ok || !response.body) {
          throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        }

        const contentLength = response.headers.get('content-length');
        const totalBytes = contentLength ? parseInt(contentLength, 10) + startByte : null;
        
        let bytesDownloaded = startByte;
        
        // Create transform stream to track progress
        const progressTracker = new Readable({
          read() {}
        });

        response.body.on('data', (chunk: Buffer) => {
          bytesDownloaded += chunk.length;
          
          if (onProgress && totalBytes) {
            onProgress({
              bytesDownloaded,
              bytesTotal: totalBytes,
              percentComplete: (bytesDownloaded / totalBytes) * 100
            });
          }
          
          progressTracker.push(chunk);
        });

        response.body.on('end', () => {
          progressTracker.push(null);
        });

        response.body.on('error', (err) => {
          progressTracker.destroy(err);
        });

        // Stream directly to disk (append mode if resuming)
        const writeStream = createWriteStream(filePath, {
          flags: startByte > 0 ? 'a' : 'w'
        });
        
        await pipeline(progressTracker, writeStream);

        logger.info('Streaming download completed', { 
          filePath, 
          bytesDownloaded,
          totalBytes 
        });

        return filePath;

      } catch (error) {
        lastError = error as Error;
        logger.warn('Streaming download attempt failed', { 
          attempt, 
          maxRetries, 
          error: String(error) 
        });

        if (attempt >= maxRetries) {
          throw new Error(
            `Failed to download file after ${maxRetries} attempts: ${lastError.message}`
          );
        }

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    throw lastError || new Error('Download failed for unknown reason');
  }

  /**
   * Create a read stream for processing downloaded file in chunks
   */
  createReadStream(filename: string, options?: { highWaterMark?: number }): ReturnType<typeof createReadStream> {
    const filePath = this.tempFileManager.getPath(filename);
    return createReadStream(filePath, {
      highWaterMark: options?.highWaterMark || 1024 * 1024 // 1MB chunks
    });
  }
}
