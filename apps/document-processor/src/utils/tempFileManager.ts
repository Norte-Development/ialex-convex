import fs from 'fs/promises';
import path from 'path';
import { logger } from '../middleware/logging';

const TEMP_DIR = process.env.TEMP_DIR || '/tmp/document-processor';

export class TempFileManager {
  private jobId: string;
  private jobDir: string;

  constructor(jobId: string) {
    this.jobId = jobId;
    this.jobDir = path.join(TEMP_DIR, jobId);
  }

  async init(): Promise<void> {
    await fs.mkdir(this.jobDir, { recursive: true });
  }

  getPath(filename: string): string {
    return path.join(this.jobDir, filename);
  }

  async writeStream(filename: string): Promise<fs.FileHandle> {
    return await fs.open(this.getPath(filename), 'w');
  }

  async readStream(filename: string): Promise<fs.FileHandle> {
    return await fs.open(this.getPath(filename), 'r');
  }

  async appendFile(filename: string, data: string): Promise<void> {
    await fs.appendFile(this.getPath(filename), data, 'utf-8');
  }

  async readFile(filename: string): Promise<string> {
    return await fs.readFile(this.getPath(filename), 'utf-8');
  }

  async cleanup(): Promise<void> {
    try {
      await fs.rm(this.jobDir, { recursive: true, force: true });
      logger.info('Cleaned up temp files', { jobId: this.jobId });
    } catch (error) {
      logger.warn('Failed to clean up temp files', { 
        jobId: this.jobId, 
        error: String(error) 
      });
    }
  }

  async exists(filename: string): Promise<boolean> {
    try {
      await fs.access(this.getPath(filename));
      return true;
    } catch {
      return false;
    }
  }
}
