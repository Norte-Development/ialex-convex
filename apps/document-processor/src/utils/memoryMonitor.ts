import { logger } from '../middleware/logging';

export class MemoryMonitor {
  private jobId: string;
  private startMem: NodeJS.MemoryUsage;
  private peakMem: number = 0;

  constructor(jobId: string) {
    this.jobId = jobId;
    this.startMem = process.memoryUsage();
  }

  checkpoint(label: string): void {
    const mem = process.memoryUsage();
    const heapUsedMB = mem.heapUsed / (1024 * 1024);
    
    if (heapUsedMB > this.peakMem) {
      this.peakMem = heapUsedMB;
    }

    logger.info('Memory checkpoint', {
      jobId: this.jobId,
      label,
      heapUsedMB: heapUsedMB.toFixed(2),
      heapTotalMB: (mem.heapTotal / (1024 * 1024)).toFixed(2),
      rssMB: (mem.rss / (1024 * 1024)).toFixed(2),
      peakMB: this.peakMem.toFixed(2)
    });
  }

  summary(): { startMB: number; peakMB: number; currentMB: number } {
    const current = process.memoryUsage();
    return {
      startMB: this.startMem.heapUsed / (1024 * 1024),
      peakMB: this.peakMem,
      currentMB: current.heapUsed / (1024 * 1024)
    };
  }
}
