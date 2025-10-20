export interface ProcessingCheckpoint {
  phase: ProcessingPhase;
  timestamp: number;
  data: Record<string, unknown>; // Phase-specific checkpoint data
}

export type ProcessingPhase = 
  | 'initialized'
  | 'downloading'
  | 'download_complete'
  | 'extracting'
  | 'extraction_complete'
  | 'chunking'
  | 'chunking_complete'
  | 'embedding'
  | 'embedding_complete'
  | 'upserting'
  | 'upsert_complete'
  | 'completed'
  | 'failed';

export interface StreamingJobState {
  documentId: string;
  jobId: string;
  
  // Current phase
  currentPhase: ProcessingPhase;
  
  // Checkpoints for each completed phase
  checkpoints: ProcessingCheckpoint[];
  
  // Progress tracking (granular)
  progress: {
    // Download
    bytesDownloaded: number;
    bytesTotal: number | null;
    downloadedFilePath?: string;
    
    // Extraction
    pagesExtracted: number;
    pagesTotal: number | null;
    lastExtractedPage: number;
    lastOcrChunk?: number; // For Mistral OCR chunking resume support
    extractedTextFilePath?: string;
    
    // Transcription (for audio/video files)
    transcriptionWordCount?: number;
    transcriptionConfidence?: number;
    transcriptionDuration?: number;
    
    // Chunking
    chunksGenerated: number;
    chunksFilePath?: string; // JSONL file with all chunks
    lastChunkIndex: number;
    
    // Embedding
    chunksEmbedded: number;
    lastEmbeddedIndex: number;
    embeddingsFilePath?: string; // JSONL file with embeddings
    
    // Upserting
    chunksUpserted: number;
    lastUpsertedIndex: number;
    lastUpsertedChunkId?: string;
  };
  
  // Metadata
  metadata: {
    contentType?: string;
    originalFileName?: string;
    fileSizeBytes?: number;
    totalPages?: number;
    method?: string;
  };
  
  // Timing
  startedAt: number;
  lastProgressAt: number;
  completedAt?: number;
  
  // Error tracking
  errorCount: number;
  lastError?: {
    message: string;
    phase: ProcessingPhase;
    timestamp: number;
    stack?: string;
  };
  
  // Resume tracking
  attemptNumber: number;
  canResume: boolean;
  resumedFrom?: ProcessingPhase;
}
