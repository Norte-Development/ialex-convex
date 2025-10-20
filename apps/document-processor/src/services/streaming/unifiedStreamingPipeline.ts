import { promises as fs } from 'fs';
import { logger } from '../../middleware/logging';
import { TempFileManager } from '../../utils/tempFileManager';
import { JobStateManager } from '../stateManager';
import { MemoryMonitor } from '../../utils/memoryMonitor';
import { StreamingDownloadService } from '../streamingDownloadService';
import { StreamingPdfExtractor } from './streamingPdfExtractor';
import { StreamingTranscriptionService, TranscriptionMetadata } from './streamingTranscriptionService';
import { StreamingChunkingService } from './streamingChunkingService';
import { StreamingEmbeddingService } from './streamingEmbeddingService';
import { isPdfFile, isAudioFile, isVideoFile } from '../../utils/mimeTypeUtils';
import { StreamingJobState } from '../../types/jobState';
import { extractDocumentText } from '../documentExtractionService';
import { splitPdfForMistralOCR, getPdfPageCount } from '../documentSplittingService';
import { Mistral } from '@mistralai/mistralai';
import { timeoutWrappers } from '../../utils/timeoutUtils';
import { JobPayload } from '../../types/streamingJobPayload';

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY || "" });

export interface PipelineConfig {
  documentIdentifier: string;
  metadata: Record<string, unknown>;
  onProgress?: (update: { phase: string; percent?: number; [key: string]: unknown }) => void;
  extractedTextCallback?: (extractedText: string, metadata: Record<string, unknown>) => Promise<void>;
}

export interface EmbedAndUpsertFn {
  (
    chunks: Array<{ index: number; text: string }>, 
    state: StreamingJobState, 
    progressCallback: (embedded: number, upserted: number) => Promise<void>
  ): Promise<{ totalEmbedded: number; totalUpserted: number; skipped: number }>;
}

export interface PipelineResult {
  totalChunks: number;
  method?: string;
  resumed: boolean;
  durationMs: number;
}

export class UnifiedStreamingPipeline {
  private tempFileManager: TempFileManager;
  private stateManager: JobStateManager;
  private memMonitor: MemoryMonitor;
  private downloadService: StreamingDownloadService;
  private chunkingService: StreamingChunkingService;
  private embeddingService: StreamingEmbeddingService;

  constructor(jobId: string, payload: JobPayload) {
    this.tempFileManager = new TempFileManager(jobId);
    this.stateManager = new JobStateManager(jobId);
    this.memMonitor = new MemoryMonitor(jobId);
    this.downloadService = new StreamingDownloadService(this.tempFileManager);
    this.chunkingService = new StreamingChunkingService(
      this.tempFileManager,
      payload.chunking?.maxTokens || 400,
      Math.floor((payload.chunking?.maxTokens || 400) * (payload.chunking?.overlapRatio || 0.15))
    );
    this.embeddingService = new StreamingEmbeddingService(this.tempFileManager);
  }

  async initialize(): Promise<void> {
    await this.tempFileManager.init();
  }

  async cleanup(autoCleanup: boolean = true): Promise<void> {
    if (autoCleanup) {
      await this.tempFileManager.cleanup();
      await this.stateManager.cleanup();
    }
  }

  async process(
    payload: JobPayload,
    config: PipelineConfig,
    embedAndUpsertFn: EmbedAndUpsertFn,
    attemptNumber: number
  ): Promise<PipelineResult> {
    const start = Date.now();
    
    // Initialize or load state
    const state = await this.stateManager.initialize(config.documentIdentifier, attemptNumber);
    
    this.memMonitor.checkpoint('initialized');

    if (state.resumedFrom) {
      logger.info('Resuming job from saved state', {
        documentIdentifier: config.documentIdentifier,
        resumedFrom: state.resumedFrom,
        attemptNumber: state.attemptNumber
      });
    }

    // PHASE 1: DOWNLOAD
    await this.downloadPhase(payload, state, config);

    // PHASE 2: EXTRACTION
    await this.extractionPhase(payload, state, config);

    // PHASE 3: EMBEDDING & UPSERT
    await this.embeddingPhase(state, config, embedAndUpsertFn);

    // SUCCESS
    await this.stateManager.markCompleted(state);
    
    const memorySummary = this.memMonitor.summary();
    logger.info('Pipeline completed successfully', {
      documentIdentifier: config.documentIdentifier,
      totalChunks: state.progress.chunksUpserted,
      durationMs: Date.now() - start,
      memory: memorySummary,
      resumed: !!state.resumedFrom
    });

    return {
      totalChunks: state.progress.chunksUpserted,
      method: state.metadata.method,
      resumed: !!state.resumedFrom,
      durationMs: Date.now() - start
    };
  }

  private async downloadPhase(
    payload: JobPayload,
    state: StreamingJobState,
    config: PipelineConfig
  ): Promise<void> {
    if (!this.stateManager.hasCompletedPhase(state, 'download_complete')) {
      logger.info('Starting download phase', { documentIdentifier: config.documentIdentifier });
      state.currentPhase = 'downloading';
      await this.stateManager.save(state);

      try {
        let sourceFilePath: string;

        if (payload.fileBuffer) {
          sourceFilePath = this.tempFileManager.getPath('source');
          await fs.writeFile(sourceFilePath, payload.fileBuffer);
          state.progress.bytesDownloaded = payload.fileBuffer.length;
          state.progress.bytesTotal = payload.fileBuffer.length;
          state.progress.downloadedFilePath = sourceFilePath;
          logger.info('File buffer written to disk', { 
            filePath: sourceFilePath, 
            size: payload.fileBuffer.length 
          });
        } else {
          sourceFilePath = await this.downloadService.downloadToFileWithResume(
            payload.signedUrl,
            'source',
            state,
            {
              onProgress: async (progress) => {
                await this.stateManager.updateProgress(state, {
                  bytesDownloaded: progress.bytesDownloaded,
                  bytesTotal: progress.bytesTotal,
                  downloadedFilePath: this.tempFileManager.getPath('source')
                });
                
                config.onProgress?.({
                  phase: 'downloading',
                  percent: progress.bytesTotal 
                    ? (progress.bytesDownloaded / progress.bytesTotal) * 100 
                    : 0
                });
              }
            }
          );
        }

        await this.stateManager.completePhase(state, 'download_complete', {
          filePath: sourceFilePath,
          fileSize: state.progress.bytesDownloaded
        });
        
        this.memMonitor.checkpoint('download-complete');
      } catch (error) {
        await this.stateManager.recordError(state, error as Error, 'downloading');
        throw error;
      }
    } else {
      logger.info('Skipping download phase (already completed)', {
        filePath: state.progress.downloadedFilePath
      });
    }
  }

  private async extractionPhase(
    payload: JobPayload,
    state: StreamingJobState,
    config: PipelineConfig
  ): Promise<void> {
    if (!this.stateManager.hasCompletedPhase(state, 'extraction_complete')) {
      logger.info('Starting extraction phase', { documentIdentifier: config.documentIdentifier });
      state.currentPhase = 'extracting';
      await this.stateManager.save(state);

      try {
        const sourceFilePath = state.progress.downloadedFilePath!;

        if (isPdfFile(payload.contentType || '')) {
          await this.extractPdf(payload, sourceFilePath, state);
        } else if (isAudioFile(payload.contentType || '') || isVideoFile(payload.contentType || '')) {
          await this.extractMediaTranscription(payload, sourceFilePath, state, config);
        } else {
          await this.extractOtherFormats(payload, sourceFilePath, state);
        }

        await this.stateManager.completePhase(state, 'extraction_complete', {
          totalPages: state.progress.pagesTotal,
          totalChunks: state.progress.chunksGenerated
        });
        
        this.memMonitor.checkpoint('extraction-complete');
      } catch (error) {
        await this.stateManager.recordError(state, error as Error, 'extracting');
        throw error;
      }
    } else {
      logger.info('Skipping extraction phase (already completed)', {
        totalChunks: state.progress.chunksGenerated
      });
    }
  }

  private async extractPdf(
    payload: JobPayload,
    sourceFilePath: string,
    state: StreamingJobState
  ): Promise<void> {
    const buffer = await fs.readFile(sourceFilePath);
    const bufferSizeMB = buffer.length / (1024 * 1024);
    const pageCount = await getPdfPageCount(buffer);
    const pageWindow = payload.chunking?.pageWindow ?? 50;

    logger.info('PDF extraction strategy selection', {
      pageCount,
      bufferSizeMB: bufferSizeMB.toFixed(2),
      pageWindow
    });

    try {
      if (pageCount <= 1000 && bufferSizeMB <= 50) {
        await this.extractPdfWithSingleMistralOcr(buffer, pageCount, pageWindow, state);
      } else {
        await this.extractLargePdfWithMistralOcr(buffer, pageCount, bufferSizeMB, pageWindow, state);
      }
      state.metadata.method = 'mistral-ocr';
      logger.info('Mistral OCR extraction completed successfully');
    } catch (ocrError) {
      logger.warn('Mistral OCR failed, falling back to pdfjs extraction', {
        error: String(ocrError)
      });
      await this.extractPdfWithPdfjs(sourceFilePath, pageWindow, state);
      state.metadata.method = 'pdfjs';
    }
  }

  private async extractPdfWithSingleMistralOcr(
    buffer: Buffer,
    pageCount: number,
    pageWindow: number,
    state: StreamingJobState
  ): Promise<void> {
    logger.info('Using single Mistral OCR call for entire document');
    
    const base64Pdf = buffer.toString("base64");
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

    const textWindows = splitTextIntoPageWindows(fullText, pageWindow);
    
    for (let windowIndex = 0; windowIndex < textWindows.length; windowIndex++) {
      await processTextBatch(
        textWindows[windowIndex],
        state,
        this.chunkingService,
        this.stateManager
      );

      await this.stateManager.updateProgress(state, {
        pagesExtracted: Math.min((windowIndex + 1) * pageWindow, pageCount),
        pagesTotal: pageCount
      });
    }
  }

  private async extractLargePdfWithMistralOcr(
    buffer: Buffer,
    pageCount: number,
    bufferSizeMB: number,
    pageWindow: number,
    state: StreamingJobState
  ): Promise<void> {
    logger.info('Document requires splitting for Mistral OCR');
    
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
      const chunkText = await processMistralOcrChunk(
        chunks[chunkIndex],
        chunkIndex,
        chunks.length
      );

      const textWindows = splitTextIntoPageWindows(chunkText, pageWindow);
      
      for (const windowText of textWindows) {
        await processTextBatch(
          windowText,
          state,
          this.chunkingService,
          this.stateManager
        );
      }

      await this.stateManager.updateProgress(state, {
        lastOcrChunk: chunkIndex + 1,
        pagesExtracted: Math.min((chunkIndex + 1) * chunkSize, pageCount),
        pagesTotal: pageCount
      });
    }
  }

  private async extractPdfWithPdfjs(
    sourceFilePath: string,
    pageWindow: number,
    state: StreamingJobState
  ): Promise<void> {
    const pdfExtractor = new StreamingPdfExtractor(this.tempFileManager);
    
    await pdfExtractor.extractInBatchesWithResume(
      sourceFilePath,
      state,
      {
        pageWindow,
        onPageBatch: async (batchText, startPage, endPage) => {
          await this.stateManager.updateProgress(state, {
            pagesExtracted: endPage,
            lastExtractedPage: endPage
          });

          await processTextBatch(
            batchText,
            state,
            this.chunkingService,
            this.stateManager
          );
        }
      }
    );
  }

  private async extractMediaTranscription(
    payload: JobPayload,
    sourceFilePath: string,
    state: StreamingJobState,
    config: PipelineConfig
  ): Promise<void> {
    logger.info('Processing audio/video file with transcription');
    const transcriptionService = new StreamingTranscriptionService(this.tempFileManager);
    
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
          this.chunkingService,
          this.stateManager
        );
      }
    });

    // Call extracted text callback if provided
    if (config.extractedTextCallback) {
      await config.extractedTextCallback(transcriptionResult.transcript, {
        length: transcriptionResult.transcript.length,
        confidence: transcriptionResult.confidence,
        duration: transcriptionResult.duration,
        model: transcriptionResult.model
      });
    }

    await this.stateManager.updateProgress(state, {
      pagesTotal: 1,
      pagesExtracted: 1,
      transcriptionWordCount: transcriptionResult.wordCount,
      transcriptionConfidence: transcriptionResult.confidence,
      transcriptionDuration: transcriptionResult.duration
    } as any);

    state.metadata.method = 'transcription';
  }

  private async extractOtherFormats(
    payload: JobPayload,
    sourceFilePath: string,
    state: StreamingJobState
  ): Promise<void> {
    const buffer = await fs.readFile(sourceFilePath);
    const { text, method } = await extractDocumentText(
      buffer, 
      payload.signedUrl, 
      payload.originalFileName, 
      payload.contentType
    );
    
    await processTextBatch(text, state, this.chunkingService, this.stateManager);
    state.metadata.method = method;
  }

  private async embeddingPhase(
    state: StreamingJobState,
    config: PipelineConfig,
    embedAndUpsertFn: EmbedAndUpsertFn
  ): Promise<void> {
    if (!this.stateManager.hasCompletedPhase(state, 'embedding_complete')) {
      logger.info('Starting embedding phase', { documentIdentifier: config.documentIdentifier });
      state.currentPhase = 'embedding';
      await this.stateManager.save(state);

      try {
        const allChunks = await this.chunkingService.readChunksFromIndex(0);
        
        const result = await embedAndUpsertFn(
          allChunks,
          state,
          async (embedded, upserted) => {
            await this.stateManager.updateProgress(state, {
              chunksEmbedded: embedded,
              chunksUpserted: upserted
            });
            
            config.onProgress?.({
              phase: 'embedding',
              chunksEmbedded: embedded,
              chunksUpserted: upserted,
              percent: allChunks.length > 0 ? (upserted / allChunks.length) * 100 : 0
            });
          }
        );

        await this.stateManager.completePhase(state, 'embedding_complete', {
          totalEmbedded: result.totalEmbedded,
          totalUpserted: result.totalUpserted,
          skipped: result.skipped
        });
        
        this.memMonitor.checkpoint('embedding-complete');
      } catch (error) {
        await this.stateManager.recordError(state, error as Error, 'embedding');
        throw error;
      }
    } else {
      logger.info('Skipping embedding phase (already completed)', {
        totalUpserted: state.progress.chunksUpserted
      });
    }
  }
}

// Helper functions
async function processTextBatch(
  text: string,
  state: StreamingJobState,
  chunkingService: StreamingChunkingService,
  stateManager: JobStateManager
): Promise<void> {
  await chunkingService.processTextStreamWithResume(text, state, {});
  await stateManager.save(state);
}

function splitTextIntoPageWindows(text: string, pagesPerWindow: number): string[] {
  const pageMarkers = /--- Page Break ---|=== Window Break ===/g;
  const pages = text.split(pageMarkers).filter(page => page.trim());
  
  if (pages.length === 0) {
    return [text];
  }
  
  const windows: string[] = [];
  for (let i = 0; i < pages.length; i += pagesPerWindow) {
    const windowPages = pages.slice(i, i + pagesPerWindow);
    windows.push(windowPages.join('\n\n--- Page Break ---\n\n'));
  }
  
  return windows;
}

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

    const base64Pdf = chunkBuffer.toString("base64");

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

