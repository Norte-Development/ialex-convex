import "dotenv/config";
import { Worker, Queue } from "bullmq";
import { logger } from "../middleware/logging";
import { TempFileManager } from "../utils/tempFileManager";
import { JobStateManager } from "../services/stateManager";
import { MemoryMonitor } from "../utils/memoryMonitor";
import { StreamingDownloadService } from "../services/streamingDownloadService";
import { StreamingPdfExtractor } from "../services/streaming/streamingPdfExtractor";
import { StreamingTranscriptionService, TranscriptionMetadata } from "../services/streaming/streamingTranscriptionService";
import { StreamingChunkingService } from "../services/streaming/streamingChunkingService";
import { StreamingEmbeddingService } from "../services/streaming/streamingEmbeddingService";
import { isPdfFile, isAudioFile, isVideoFile } from "../utils/mimeTypeUtils";
import { StreamingJobState } from "../types/jobState";
import { extractDocumentText } from "../services/documentExtractionService";
import { splitPdfForMistralOCR, getPdfPageCount } from "../services/documentSplittingService";
import { Mistral } from '@mistralai/mistralai';
import { timeoutWrappers } from "../utils/timeoutUtils";
import { promises as fs } from 'fs';

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY || "" });

interface JobPayload {
  jobType?: string; // "case-document" or "library-document" discriminator
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
      logger.info('🔍 STREAMING WORKER received job', {
        jobId: job.id,
        jobName: job.name,
        jobType: job.data?.jobType || 'unknown',
        documentId: job.data?.documentId || 'unknown'
      });

      // ONLY process case document jobs
      if (job.data?.jobType && job.data.jobType !== "case-document") {
        logger.warn('⏭️  STREAMING WORKER skipping - wrong jobType', { 
          jobId: job.id,
          jobName: job.name,
          jobType: job.data.jobType,
          expectedJobType: 'case-document'
        });
        return;
      }

      // Also check job name for backward compatibility
      if (job.name !== "process-document") {
        logger.warn('⏭️  STREAMING WORKER skipping - wrong job name', { 
          jobId: job.id,
          jobName: job.name,
          expectedName: 'process-document'
        });
        return;
      }

      const start = Date.now();
      const payload = job.data;
      const tempFileManager = new TempFileManager(job.id!);
      const stateManager = new JobStateManager(job.id!);
      const memMonitor = new MemoryMonitor(job.id!);

      logger.info('🚀 STREAMING PROCESSOR - Processing document', {
        jobId: job.id,
        jobName: job.name,
        documentId: payload.documentId,
        processorType: 'STREAMING',
        features: 'resume-support, streaming-pipeline, chunked-processing'
      });

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
              // Read PDF buffer
              const buffer = await fs.readFile(sourceFilePath);
              const bufferSizeMB = buffer.length / (1024 * 1024);
              const pageCount = await getPdfPageCount(buffer);
              const pageWindow = payload.chunking?.pageWindow ?? 50;

              logger.info('PDF extraction strategy selection', {
                pageCount,
                bufferSizeMB: bufferSizeMB.toFixed(2),
                pageWindow
              });

              // Try Mistral OCR first (better quality)
              try {
                // Mistral OCR limits: 1000 pages AND 50 MB
                if (pageCount <= 1000 && bufferSizeMB <= 50) {
                  // Single Mistral OCR call for small documents
                  logger.info('Using single Mistral OCR call for entire document');
                  
                  const base64Pdf = await encodePdf(buffer);
                  const ocrResponse = await timeoutWrappers.ocrRequest(
                    () => mistral.ocr.process({
                      model: "mistral-ocr-latest",
                      document: {
                        type: "document_url",
                        documentUrl: `data:application/pdf;base64,${base64Pdf}`
                      },
                      includeImageBase64: false
                    }),
                    'Mistral OCR request'
                  );

                  const pages = ocrResponse.pages || [];
                  const pageTexts = pages.map((page) => page.markdown || "").filter(text => text.trim());
                  const fullText = pageTexts.join('\n\n--- Page Break ---\n\n');

                  // Apply page windowing for memory-efficient chunking
                  const textWindows = splitTextIntoPageWindows(fullText, pageWindow);
                  
                  for (let windowIndex = 0; windowIndex < textWindows.length; windowIndex++) {
                    await processTextBatch(
                      textWindows[windowIndex],
                      state,
                      chunkingService,
                      stateManager
                    );

                    await stateManager.updateProgress(state, {
                      pagesExtracted: Math.min((windowIndex + 1) * pageWindow, pageCount),
                      pagesTotal: pageCount
                    });
                  }
                } else {
                  // Large document: split into optimal chunks for Mistral OCR
                  logger.info('Document requires splitting for Mistral OCR');
                  
                  // Calculate optimal chunk size
                  const pagesPerMB = pageCount / bufferSizeMB;
                  const maxPagesForSize = Math.floor(48 * pagesPerMB);
                  const chunkSize = Math.min(1000, maxPagesForSize);
                  
                  logger.info('Optimal chunk size calculated', {
                    chunkSize,
                    estimatedChunks: Math.ceil(pageCount / chunkSize)
                  });

                  const chunks = await splitPdfForMistralOCR(buffer, chunkSize);
                  const startChunk = state.progress.lastOcrChunk || 0;

                  logger.info('Processing Mistral OCR chunks', {
                    totalChunks: chunks.length,
                    startChunk
                  });

                  for (let chunkIndex = startChunk; chunkIndex < chunks.length; chunkIndex++) {
                    // Process chunk with Mistral OCR
                    const chunkText = await processMistralOcrChunk(
                      chunks[chunkIndex],
                      chunkIndex,
                      chunks.length
                    );

                    // Apply page windowing for memory-efficient processing
                    const textWindows = splitTextIntoPageWindows(chunkText, pageWindow);
                    
                    for (const windowText of textWindows) {
                      await processTextBatch(
                        windowText,
                        state,
                        chunkingService,
                        stateManager
                      );
                    }

                    // Update progress after each chunk
                    await stateManager.updateProgress(state, {
                      lastOcrChunk: chunkIndex + 1,
                      pagesExtracted: Math.min((chunkIndex + 1) * chunkSize, pageCount),
                      pagesTotal: pageCount
                    });
                  }
                }

                logger.info('Mistral OCR extraction completed successfully');

              } catch (ocrError) {
                // Fallback to pdfjs if Mistral OCR fails
                logger.warn('Mistral OCR failed, falling back to pdfjs extraction', {
                  error: String(ocrError)
                });

                const pdfExtractor = new StreamingPdfExtractor(tempFileManager);
                
                await pdfExtractor.extractInBatchesWithResume(
                  sourceFilePath,
                  state,
                  {
                    pageWindow,
                    onPageBatch: async (batchText, startPage, endPage) => {
                      await stateManager.updateProgress(state, {
                        pagesExtracted: endPage,
                        lastExtractedPage: endPage
                      });

                      await processTextBatch(
                        batchText,
                        state,
                        chunkingService,
                        stateManager
                      );
                    }
                  }
                );
              }
            } else if (isAudioFile(payload.contentType || '') || isVideoFile(payload.contentType || '')) {
              logger.info('Processing audio/video file with transcription');
              const transcriptionService = new StreamingTranscriptionService(tempFileManager);
              
              // Capture full transcript and metadata
              let transcriptionMetadata: TranscriptionMetadata | undefined;
              
              const transcriptionResult = await transcriptionService.transcribeFile(sourceFilePath, {
                model: 'nova-3',
                language: 'multi',
                minTranscriptLength: 10,
                requireConfidence: 0.5,
                onTranscriptSegment: async (segment, offset, metadata) => {
                  transcriptionMetadata = metadata;
                  
                  await processTextBatch(
                    segment,
                    state,
                    chunkingService,
                    stateManager
                  );
                }
              });

              // Store full transcript to database via callback
              logger.info('Storing full transcript to database', {
                documentId: payload.documentId,
                transcriptLength: transcriptionResult.transcript.length,
                confidence: transcriptionResult.confidence
              });

              try {
                const crypto = await import("crypto");
                const callbackBody = JSON.stringify({
                  documentId: payload.documentId,
                  extractedText: transcriptionResult.transcript,
                  extractedTextLength: transcriptionResult.transcript.length,
                  transcriptionConfidence: transcriptionResult.confidence,
                  transcriptionDuration: transcriptionResult.duration,
                  transcriptionModel: transcriptionResult.model,
                });

                const hmac = payload.hmacSecret
                  ? crypto.createHmac("sha256", payload.hmacSecret).update(callbackBody).digest("hex")
                  : undefined;

                // Extract base URL and construct proper endpoint
                const baseUrl = payload.callbackUrl.replace(/\/webhooks\/.*$/, '');
                const extractedTextUrl = `${baseUrl}/api/document-processor/extracted-text`;

                logger.info('Sending extracted text callback', {
                  url: extractedTextUrl,
                  hasHmac: !!hmac
                });

                const response = await fetch(extractedTextUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(hmac ? { 'X-Convex-Signature': hmac } : {})
                  },
                  body: callbackBody
                });

                if (!response.ok) {
                  throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                }

                logger.info('Successfully stored transcript to database');
              } catch (callbackError) {
                logger.warn('Failed to send extracted text callback', {
                  error: String(callbackError)
                });
                // Don't fail the job - transcript is in chunks anyway
              }

              // Update progress with transcription metadata
              await stateManager.updateProgress(state, {
                pagesTotal: 1,
                pagesExtracted: 1,
                transcriptionWordCount: transcriptionResult.wordCount,
                transcriptionConfidence: transcriptionResult.confidence,
                transcriptionDuration: transcriptionResult.duration
              } as any);
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
        logger.info('Preparing success callback', {
          jobId: job.id,
          documentId: payload.documentId,
          callbackUrl: payload.callbackUrl,
          hasHmacSecret: !!payload.hmacSecret
        });

        const callbackBody = JSON.stringify({
          status: "completed",
          documentId: payload.documentId,
          totalChunks: state.progress.chunksUpserted,
          method: 'streaming',
          durationMs: Date.now() - start,
          resumed: !!state.resumedFrom
        });

        logger.info('Success callback body prepared', {
          jobId: job.id,
          bodyLength: callbackBody.length,
          body: callbackBody
        });

        const crypto = await import("crypto");
        const hmac = payload.hmacSecret
          ? crypto.createHmac("sha256", payload.hmacSecret).update(callbackBody).digest("hex")
          : undefined;

        logger.info('HMAC generated for callback', {
          jobId: job.id,
          hmacGenerated: !!hmac,
          hmacLength: hmac?.length
        });

        try {
          const fetch = (await import('node-fetch')).default;
          logger.info('Sending success callback request', {
            jobId: job.id,
            url: payload.callbackUrl,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Signature': hmac ? 'present' : 'absent'
            }
          });

          const response = await fetch(payload.callbackUrl, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json", 
              ...(hmac ? { "X-Signature": hmac } : {}) 
            },
            body: callbackBody,
          });

          logger.info('Success callback response received', {
            jobId: job.id,
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries())
          });

          const responseText = await response.text();
          logger.info('Success callback response body', {
            jobId: job.id,
            responseBody: responseText,
            responseLength: responseText.length
          });

          if (!response.ok) {
            logger.warn('Success callback returned non-OK status', {
              jobId: job.id,
              status: response.status,
              statusText: response.statusText,
              responseBody: responseText
            });
          }
        } catch (callbackError) {
          logger.error('Success callback request failed', {
            jobId: job.id,
            error: String(callbackError),
            errorStack: callbackError instanceof Error ? callbackError.stack : undefined,
            callbackUrl: payload.callbackUrl
          });
          // Don't throw - we want the job to succeed even if callback fails
        }

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

        // Determine if this is the final attempt
        const totalAttempts = typeof job.opts.attempts === "number" ? job.opts.attempts : 1;
        const isFinalAttempt = job.attemptsMade + 1 >= totalAttempts;
        
        logger.info('Job attempt failed', {
          jobId: job.id,
          documentId: payload.documentId,
          attemptNumber: job.attemptsMade + 1,
          totalAttempts,
          isFinalAttempt,
          willRetry: !isFinalAttempt
        });

        if (isFinalAttempt) {
          logger.info('Preparing failure callback (final attempt)', {
            jobId: job.id,
            documentId: payload.documentId,
            attemptsMade: job.attemptsMade + 1,
            totalAttempts,
            callbackUrl: payload.callbackUrl,
            hasHmacSecret: !!payload.hmacSecret
          });

          const failureBody = JSON.stringify({
            status: "failed",
            documentId: payload.documentId,
            error: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - start,
          });

          logger.info('Failure callback body prepared', {
            jobId: job.id,
            bodyLength: failureBody.length,
            body: failureBody
          });

          const crypto = await import("crypto");
          const hmac = payload.hmacSecret
            ? crypto.createHmac("sha256", payload.hmacSecret).update(failureBody).digest("hex")
            : undefined;

          logger.info('HMAC generated for failure callback', {
            jobId: job.id,
            hmacGenerated: !!hmac,
            hmacLength: hmac?.length
          });

          try {
            const fetch = (await import('node-fetch')).default;
            logger.info('Sending failure callback request', {
              jobId: job.id,
              url: payload.callbackUrl,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Signature': hmac ? 'present' : 'absent'
              }
            });

            const response = await fetch(payload.callbackUrl, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json", 
                ...(hmac ? { "X-Signature": hmac } : {}) 
              },
              body: failureBody,
            });

            logger.info('Failure callback response received', {
              jobId: job.id,
              status: response.status,
              statusText: response.statusText,
              ok: response.ok,
              headers: Object.fromEntries(response.headers.entries())
            });

            const responseText = await response.text();
            logger.info('Failure callback response body', {
              jobId: job.id,
              responseBody: responseText,
              responseLength: responseText.length
            });

            if (!response.ok) {
              logger.warn('Failure callback returned non-OK status', {
                jobId: job.id,
                status: response.status,
                statusText: response.statusText,
                responseBody: responseText
              });
            }
          } catch (callbackError) {
            logger.error('Failure callback request failed', {
              jobId: job.id,
              error: String(callbackError),
              errorStack: callbackError instanceof Error ? callbackError.stack : undefined,
              callbackUrl: payload.callbackUrl
            });
          }
        } else {
          logger.info('Not sending callback - not final attempt', {
            jobId: job.id,
            documentId: payload.documentId,
            attemptsMade: job.attemptsMade + 1,
            totalAttempts
          });
        }

        // Cleanup on final failure only (keep files for resume on non-final attempts)
        if (isFinalAttempt && process.env.AUTO_CLEANUP_ON_FAILURE !== 'false') {
          logger.info('Cleaning up temp files (final attempt failed)', { jobId: job.id });
          await tempFileManager.cleanup();
          await stateManager.cleanup();
        } else if (!isFinalAttempt) {
          logger.info('Keeping temp files for resume (non-final attempt)', { 
            jobId: job.id,
            attemptNumber: job.attemptsMade + 1,
            totalAttempts
          });
        }

        throw error;
      }
    },
    { 
      connection: queue.opts.connection,
      concurrency: Number(process.env.WORKER_CONCURRENCY || 2),
      // ONLY process jobs named "process-document"
      name: "process-document"
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

/**
 * Split OCR text into smaller windows based on page markers
 * This is used to process large Mistral OCR results in memory-efficient batches
 */
function splitTextIntoPageWindows(text: string, pagesPerWindow: number): string[] {
  // Split by page break markers that Mistral OCR uses
  const pageMarkers = /--- Page Break ---|=== Window Break ===/g;
  const pages = text.split(pageMarkers).filter(page => page.trim());
  
  if (pages.length === 0) {
    return [text]; // No page markers found, return full text
  }
  
  // Group pages into windows
  const windows: string[] = [];
  for (let i = 0; i < pages.length; i += pagesPerWindow) {
    const windowPages = pages.slice(i, i + pagesPerWindow);
    windows.push(windowPages.join('\n\n--- Page Break ---\n\n'));
  }
  
  return windows;
}

/**
 * Encode PDF buffer to base64
 */
async function encodePdf(file: Buffer): Promise<string> {
  return file.toString("base64");
}

/**
 * Process a single PDF chunk with Mistral OCR
 * Uses large chunks (up to 1000 pages or 50 MB) to minimize API calls
 */
async function processMistralOcrChunk(
  chunkBuffer: Buffer, 
  chunkIndex: number, 
  totalChunks: number
): Promise<string> {
  try {
    logger.info("Processing PDF chunk with Mistral OCR", {
      chunkIndex: chunkIndex + 1,
      totalChunks,
      chunkSizeMB: (chunkBuffer.length / (1024 * 1024)).toFixed(2)
    });

    // Convert chunk to base64
    const base64Pdf = await encodePdf(chunkBuffer);

    // Send to Mistral OCR
    const ocrResponse = await timeoutWrappers.ocrRequest(
      () => mistral.ocr.process({
        model: "mistral-ocr-latest",
        document: {
          type: "document_url",
          documentUrl: `data:application/pdf;base64,${base64Pdf}`
        },
        includeImageBase64: false
      }),
      'Mistral OCR request'
    );

    const pages = ocrResponse.pages || [];
    if (pages.length === 0) {
      throw new Error("Mistral OCR returned no pages for chunk");
    }

    // Extract text from pages
    const pageTexts = pages.map((page) => page.markdown || "").filter(text => text.trim());
    
    if (pageTexts.length === 0) {
      throw new Error("Mistral OCR returned no readable text for chunk");
    }

    const chunkText = pageTexts.join('\n\n--- Page Break ---\n\n');
    
    logger.info("Mistral OCR chunk completed", {
      chunkIndex: chunkIndex + 1,
      totalChunks,
      pagesInChunk: pages.length,
      textLength: chunkText.length
    });

    return chunkText;
  } catch (error) {
    logger.error("Mistral OCR chunk failed", {
      chunkIndex: chunkIndex + 1,
      totalChunks,
      error: String(error)
    });
    throw error;
  }
}
