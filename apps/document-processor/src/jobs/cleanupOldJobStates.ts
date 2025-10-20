import IORedis from 'ioredis';
import { logger } from '../middleware/logging';
import { promises as fs } from 'fs';
import path from 'path';
import { StreamingJobState } from '../types/jobState';

const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379");
const TEMP_DIR = process.env.TEMP_DIR || '/tmp/document-processor';

export async function cleanupOldJobStates(): Promise<void> {
  const maxAge = parseInt(process.env.JOB_STATE_TTL_DAYS || '7') * 24 * 60 * 60 * 1000;
  const now = Date.now();

  try {
    const keys = await redis.keys('job:state:*');
    let cleaned = 0;

    for (const key of keys) {
      const stateStr = await redis.get(key);
      if (!stateStr) continue;

      const state: StreamingJobState = JSON.parse(stateStr);
      const age = now - state.startedAt;

      // Clean up old completed or failed jobs
      if (age > maxAge && (state.currentPhase === 'completed' || !state.canResume)) {
        await redis.del(key);
        
        // Also clean up temp files
        const jobId = key.replace('job:state:', '');
        const jobDir = path.join(TEMP_DIR, jobId);
        
        try {
          await fs.rm(jobDir, { recursive: true, force: true });
        } catch (fsError) {
          logger.warn('Failed to cleanup temp directory', { jobId, error: String(fsError) });
        }
        
        cleaned++;
      }
    }

    logger.info('Cleanup completed', { cleaned, total: keys.length });
  } catch (error) {
    logger.error('Cleanup failed', { error: String(error) });
  }
}

// Run every hour
export function startCleanupScheduler(): void {
  setInterval(cleanupOldJobStates, 60 * 60 * 1000);
  logger.info('Cleanup scheduler started');
}
