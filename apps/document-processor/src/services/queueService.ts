import "dotenv/config";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { logger } from "../middleware/logging.js";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
  lazyConnect: true,
  connectTimeout: 60000,
  commandTimeout: 900000, // 15 minutes for long document processing operations
  keepAlive: 30000,
  // Better reconnection handling for external Redis
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    // Reconnect on timeout errors and connection issues
    if (err.message.includes('timeout') || 
        err.message.includes('ECONNRESET') || 
        err.message.includes('ECONNREFUSED') ||
        err.message.includes('ETIMEDOUT')) {
      return true;
    }
    return false;
  },
});

// Add connection event handlers
connection.on('connect', () => {
  logger.info('Redis connected successfully');
});

connection.on('ready', () => {
  logger.info('Redis connection ready');
});

connection.on('error', (err) => {
  logger.error('Redis connection error:', { error: err.message, code: 404 });
});

connection.on('close', () => {
  logger.warn('Redis connection closed');
});

connection.on('reconnecting', () => {
  logger.info('Redis reconnecting...');
});

connection.on('end', () => {
  logger.warn('Redis connection ended');
});

export const queue = new Queue("document-processing", { 
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 1000,
    removeOnFail: 1000,
  }
});


