import IORedis from 'ioredis';
import { logger } from '../middleware/logging';
import { StreamingJobState, ProcessingPhase, ProcessingCheckpoint } from '../types/jobState';

const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379");

export class JobStateManager {
  private jobId: string;
  private stateKey: string;

  constructor(jobId: string) {
    this.jobId = jobId;
    this.stateKey = `job:state:${jobId}`;
  }

  /**
   * Initialize or load existing job state
   */
  async initialize(documentId: string, attemptNumber: number): Promise<StreamingJobState> {
    const existing = await this.load();
    
    if (existing && existing.canResume) {
      logger.info('Resuming job from saved state', {
        jobId: this.jobId,
        documentId,
        currentPhase: existing.currentPhase,
        attemptNumber: existing.attemptNumber
      });
      
      existing.attemptNumber = attemptNumber;
      existing.resumedFrom = existing.currentPhase;
      
      return existing;
    }
    
    // Create new state
    const state: StreamingJobState = {
      documentId,
      jobId: this.jobId,
      currentPhase: 'initialized',
      checkpoints: [],
      progress: {
        bytesDownloaded: 0,
        bytesTotal: null,
        pagesExtracted: 0,
        pagesTotal: null,
        lastExtractedPage: 0,
        chunksGenerated: 0,
        lastChunkIndex: 0,
        chunksEmbedded: 0,
        lastEmbeddedIndex: 0,
        chunksUpserted: 0,
        lastUpsertedIndex: 0
      },
      metadata: {},
      startedAt: Date.now(),
      lastProgressAt: Date.now(),
      errorCount: 0,
      attemptNumber,
      canResume: true
    };
    
    await this.save(state);
    return state;
  }

  /**
   * Save current state to Redis
   */
  async save(state: StreamingJobState): Promise<void> {
    state.lastProgressAt = Date.now();
    
    await redis.set(
      this.stateKey,
      JSON.stringify(state),
      'EX',
      60 * 60 * 24 * 7 // 7 days TTL
    );
    
    logger.debug('Job state saved', {
      jobId: this.jobId,
      phase: state.currentPhase,
      progress: state.progress
    });
  }

  /**
   * Load state from Redis
   */
  async load(): Promise<StreamingJobState | null> {
    const data = await redis.get(this.stateKey);
    
    if (!data) {
      return null;
    }
    
    try {
      return JSON.parse(data) as StreamingJobState;
    } catch (error) {
      logger.error('Failed to parse job state', { jobId: this.jobId, error: String(error) });
      return null;
    }
  }

  /**
   * Mark a phase as complete and create checkpoint
   */
  async completePhase(
    state: StreamingJobState,
    phase: ProcessingPhase,
    checkpointData: Record<string, unknown> = {}
  ): Promise<void> {
    const checkpoint: ProcessingCheckpoint = {
      phase,
      timestamp: Date.now(),
      data: checkpointData
    };
    
    state.checkpoints.push(checkpoint);
    state.currentPhase = phase;
    
    await this.save(state);
    
    logger.info('Phase completed', {
      jobId: this.jobId,
      phase,
      checkpointData
    });
  }

  /**
   * Update progress within current phase
   */
  async updateProgress(
    state: StreamingJobState,
    progressUpdate: Partial<StreamingJobState['progress']>
  ): Promise<void> {
    Object.assign(state.progress, progressUpdate);
    await this.save(state);
  }

  /**
   * Record error and update state
   */
  async recordError(
    state: StreamingJobState,
    error: Error,
    phase: ProcessingPhase
  ): Promise<void> {
    state.errorCount++;
    state.lastError = {
      message: error.message,
      phase,
      timestamp: Date.now(),
      stack: error.stack
    };
    
    // Mark as non-resumable if too many errors
    if (state.errorCount > 3) {
      state.canResume = false;
      logger.warn('Job marked as non-resumable due to repeated failures', {
        jobId: this.jobId,
        errorCount: state.errorCount
      });
    }
    
    await this.save(state);
  }

  /**
   * Mark job as completed
   */
  async markCompleted(state: StreamingJobState): Promise<void> {
    state.currentPhase = 'completed';
    state.completedAt = Date.now();
    state.canResume = false;
    
    await this.save(state);
    
    logger.info('Job marked as completed', {
      jobId: this.jobId,
      duration: state.completedAt - state.startedAt
    });
  }

  /**
   * Check if a specific phase has been completed
   */
  hasCompletedPhase(state: StreamingJobState, phase: ProcessingPhase): boolean {
    return state.checkpoints.some(cp => cp.phase === phase);
  }

  /**
   * Get checkpoint data for a specific phase
   */
  getCheckpointData(state: StreamingJobState, phase: ProcessingPhase): Record<string, unknown> | null {
    const checkpoint = state.checkpoints.find(cp => cp.phase === phase);
    return checkpoint?.data || null;
  }

  /**
   * Delete job state (cleanup)
   */
  async cleanup(): Promise<void> {
    await redis.del(this.stateKey);
    logger.debug('Job state cleaned up', { jobId: this.jobId });
  }
}
