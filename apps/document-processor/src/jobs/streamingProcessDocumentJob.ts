import "dotenv/config";
import { Worker, Queue } from "bullmq";
import IORedis from "ioredis";
import { logger } from "../middleware/logging";
import { TempFileManager } from "../utils/tempFileManager";
import { JobStateManager } from "../services/stateManager";
import { MemoryMonitor } from "../utils/memoryMonitor";
import { StreamingDownloadService } from "../services/streamingDownloadService";
import { StreamingPdfExtractor } from "../services/streaming/streamingPdfExtractor";
import { StreamingTranscriptionService } from "../services/streaming/streamingTranscriptionService";
import { StreamingChunkingService } from "../services/streaming/streamingChunkingService";
import { StreamingEmbeddingService } from "../services/streaming/streamingEmbeddingService";
import { isPdfFile, isAudioFile, isVideoFile } from "../utils/mimeTypeUtils";
import { StreamingJobState } from "../types/jobState";
import { extractDocumentText } from "../services/documentExtractionService";
import { promises as fs } from 'fs';

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
  lazyConnect: true,
  connectTimeout: 60000,
  commandTimeout: 900000,
  keepAlive: 30000,
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) return true;
    if (err.message.includes('timeout') || 
        err.message.includes('ECONNRESET') || 
        err.message.includes('ECONNREFUSED') ||
        err.message.includes('ETIMEDOUT')) return true;
    return false;
  },
});

interface JobPayload {
  signedUrl: string;
  contentType?: string;
  tenantId: string;
  createdBy?: string;
  caseId: string;
  documentId: string;
  originalFileName?: string;
  callbackUrl: string;
  hmacSecret?: string;
  documentType?: string;
  chunking?: {
    maxTokens: number;
    overlapRatio: number;
    pageWindow: number;
  };
  fileBuffer?: Buffer | Uint8Array;
}

export function processStreamingDocumentJobWithResume(queue: Queue) {
  new Worker<JobPayload>(
    queue.name,
    async (job) => {
      const start = Date.now();
      const payload = job.data;
      const tempFileManager = new TempFileManager(job.id!);
      const stateManager = new JobStateManager(job.id!);
      const memMonitor = new MemoryMonitor(job.id!);

      try {
        await tempFileManager.init();
        memMonitor.checkpoint('job-start');

        // Initialize or resume state
        const state = await stateManager.initialize(
          payload.documentId,
          job.attemptsMade + 1
        );

        if (state.resumedFrom) {
          logger.info('Resuming job', {
            jobId: job.id,
            resumedFrom: state.resumedFrom,
            attemptNumber: state.attemptNumber
          });
        }

        // Initialize services
        const downloadService = new StreamingDownloadService(tempFileManager);
        const chunkingService = new StreamingChunkingService(
          tempFileManager,
          payload.chunking?.maxTokens || 400,
          Math.floor((payload.chunking?.maxTokens || 400) * (payload.chunking?.overlapRatio || 0.15))
        );
        const embeddingService = new StreamingEmbeddingService(tempFileManager);

        // ===== PHASE 1: DOWNLOAD (with resume) =====
        if (!stateManager.hasCompletedPhase(state, 'download_complete')) {
          logger.info('Starting download phase', { documentId: payload.documentId });
          state.currentPhase = 'downloading';
          await stateManager.save(state);

          try {
            let sourceFilePath: string;

            // If fileBuffer exists (test upload), write it directly
            if (payload.fileBuffer) {
              sourceFilePath = tempFileManager.getPath('source');
              await fs.writeFile(sourceFilePath, payload.fileBuffer);
              state.progress.bytesDownloaded = payload.fileBuffer.length;
              state.progress.bytesTotal = payload.fileBuffer.length;
              state.progress.downloadedFilePath = sourceFilePath;
              logger.info('File buffer written to disk', { 
                filePath: sourceFilePath, 
                size: payload.fileBuffer.length 
              });
            } else {
              sourceFilePath = await downloadService.downloadToFileWithResume(
                payload.signedUrl,
                'source',
                state,
                {
                  onProgress: async (progress) => {
                    await stateManager.updateProgress(state, {
                      bytesDownloaded: progress.bytesDownloaded,
                      bytesTotal: progress.bytesTotal,
                      downloadedFilePath: tempFileManager.getPath('source')
                    });
                    
                    job.updateProgress({
                      phase: 'downloading',
                      percent: progress.bytesTotal 
                        ? (progress.bytesDownloaded / progress.bytesTotal) * 100 
                        : 0
                    });
                  }
                }
              );
            }

            await stateManager.completePhase(state, 'download_complete', {
              filePath: sourceFilePath,
              fileSize: state.progress.bytesDownloaded
            });
            
            memMonitor.checkpoint('download-complete');
          } catch (error) {
            await stateManager.recordError(state, error as Error, 'downloading');
            throw error;
          }
        } else {
          logger.info('Skipping download phase (already completed)', {
            filePath: state.progress.downloadedFilePath
          });
        }

        // ===== PHASE 2: EXTRACTION (with resume) =====
        if (!stateManager.hasCompletedPhase(state, 'extraction_complete')) {
          logger.info('Starting extraction phase', { documentId: payload.documentId });
          state.currentPhase = 'extracting';
          await stateManager.save(state);

          try {
            const sourceFilePath = state.progress.downloadedFilePath!;

            if (isPdfFile(payload.contentType || '')) {
              const pdfExtractor = new StreamingPdfExtractor(tempFileManager);
              
              await pdfExtractor.extractInBatchesWithResume(
                sourceFilePath,
                state,
                {
                  pageWindow: payload.chunking?.pageWindow ?? 50,
                  onPageBatch: async (batchText, startPage, endPage) => {
                    // Save state after each batch
                    await stateManager.updateProgress(state, {
                      pagesExtracted: endPage,
                      lastExtractedPage: endPage
                    });

                    // Chunk immediately
                    await processTextBatch(
                      batchText,
                      state,
                      chunkingService,
                      stateManager
                    );
                  }
                }
              );
            } else if (isAudioFile(payload.contentType || '') || isVideoFile(payload.contentType || '')) {
              const transcriptionService = new StreamingTranscriptionService(tempFileManager);
              
              await transcriptionService.transcribeFile(sourceFilePath, {
                onTranscriptSegment: async (segment, offset) => {
                  await processTextBatch(
                    segment,
                    state,
                    chunkingService,
                    stateManager
                  );
                }
              });
            } else {
              // Handle other file types using existing extraction
              const buffer = await fs.readFile(sourceFilePath);
              const { text } = await extractDocumentText(
                buffer, 
                payload.signedUrl, 
                payload.originalFileName, 
                payload.contentType
              );
              
              await processTextBatch(text, state, chunkingService, stateManager);
            }

            await stateManager.completePhase(state, 'extraction_complete', {
              totalPages: state.progress.pagesTotal,
              totalChunks: state.progress.chunksGenerated
            });
            
            memMonitor.checkpoint('extraction-complete');
          } catch (error) {
            await stateManager.recordError(state, error as Error, 'extracting');
            throw error;
          }
        } else {
          logger.info('Skipping extraction phase (already completed)', {
            totalChunks: state.progress.chunksGenerated
          });
        }

        // ===== PHASE 3: EMBEDDING & UPSERT (with resume) =====
        if (!stateManager.hasCompletedPhase(state, 'embedding_complete')) {
          logger.info('Starting embedding phase', { documentId: payload.documentId });
          state.currentPhase = 'embedding';
          await stateManager.save(state);

          try {
            // Read all chunks from file
            const allChunks = await chunkingService.readChunksFromIndex(0);
            
            const createdBy = payload.createdBy ?? payload.tenantId;
            const result = await embeddingService.embedAndUpsertStreamWithResume(
              allChunks,
              createdBy,
              payload.caseId,
              payload.documentId,
              state,
              {
                onProgress: async (embedded, upserted) => {
                  await stateManager.updateProgress(state, {
                    chunksEmbedded: embedded,
                    chunksUpserted: upserted
                  });
                  
                  job.updateProgress({
                    phase: 'embedding',
                    chunksEmbedded: embedded,
                    chunksUpserted: upserted,
                    percent: allChunks.length > 0 ? (upserted / allChunks.length) * 100 : 0
                  });
                }
              }
            );

            await stateManager.completePhase(state, 'embedding_complete', {
              totalEmbedded: result.totalEmbedded,
              totalUpserted: result.totalUpserted,
              skipped: result.skipped
            });
            
            memMonitor.checkpoint('embedding-complete');
          } catch (error) {
            await stateManager.recordError(state, error as Error, 'embedding');
            throw error;
          }
        } else {
          logger.info('Skipping embedding phase (already completed)', {
            totalUpserted: state.progress.chunksUpserted
          });
        }

        // ===== SUCCESS =====
        await stateManager.markCompleted(state);
        
        const memorySummary = memMonitor.summary();
        logger.info('Job completed successfully', {
          jobId: job.id,
          documentId: payload.documentId,
          totalChunks: state.progress.chunksUpserted,
          durationMs: Date.now() - start,
          memory: memorySummary,
          resumed: !!state.resumedFrom
        });

        // Send success callback
        const callbackBody = JSON.stringify({
          status: "completed",
          documentId: payload.documentId,
          totalChunks: state.progress.chunksUpserted,
          method: 'streaming',
          durationMs: Date.now() - start,
          resumed: !!state.resumedFrom
        });

        const crypto = await import("crypto");
        const hmac = payload.hmacSecret
          ? crypto.createHmac("sha256", payload.hmacSecret).update(callbackBody).digest("hex")
          : undefined;

        const fetch = (await import('node-fetch')).default;
        await fetch(payload.callbackUrl, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json", 
            ...(hmac ? { "X-Signature": hmac } : {}) 
          },
          body: callbackBody,
        });

        // Cleanup
        if (process.env.AUTO_CLEANUP_ON_SUCCESS !== 'false') {
          await tempFileManager.cleanup();
          await stateManager.cleanup();
        }

        return {
          totalChunks: state.progress.chunksUpserted,
          durationMs: Date.now() - start,
          resumed: !!state.resumedFrom
        };

      } catch (error) {
        logger.error('Job failed', {
          jobId: job.id,
          documentId: payload.documentId,
          error: String(error)
        });

        // Don't cleanup temp files on failure (for resume)
        // Send failure callback
        const totalAttempts = typeof job.opts.attempts === "number" ? job.opts.attempts : 1;
        const isFinalAttempt = job.attemptsMade + 1 >= totalAttempts;

        if (isFinalAttempt) {
          const failureBody = JSON.stringify({
            status: "failed",
            documentId: payload.documentId,
            error: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - start,
          });

          const crypto = await import("crypto");
          const hmac = payload.hmacSecret
            ? crypto.createHmac("sha256", payload.hmacSecret).update(failureBody).digest("hex")
            : undefined;

          try {
            const fetch = (await import('node-fetch')).default;
            await fetch(payload.callbackUrl, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json", 
                ...(hmac ? { "X-Signature": hmac } : {}) 
              },
              body: failureBody,
            });
          } catch (callbackError) {
            logger.error('Callback failed', { error: String(callbackError) });
          }

          // Cleanup on final failure
          if (process.env.AUTO_CLEANUP_ON_FAILURE !== 'false') {
            await tempFileManager.cleanup();
          }
        }

        throw error;
      }
    },
    { 
      connection, 
      concurrency: Number(process.env.WORKER_CONCURRENCY || 2) 
    }
  );
}

// Helper function
async function processTextBatch(
  text: string,
  state: StreamingJobState,
  chunkingService: StreamingChunkingService,
  stateManager: JobStateManager
): Promise<void> {
  await chunkingService.processTextStreamWithResume(text, state, {});
  await stateManager.save(state);
}
