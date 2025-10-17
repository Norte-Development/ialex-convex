import "dotenv/config";
import express, { Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { queue } from "./services/queueService";
import { initQdrant, initLibraryQdrant } from "./services/qdrantService";
import { logger } from "./middleware/logging";
import { processDocumentJob } from "./jobs/processDocumentJob";
import { processLibraryDocumentJob } from "./jobs/processLibraryDocumentJob";
import { getDeepgramStats } from "./services/deepgramService";
import { getTimeoutConfig } from "./utils/timeoutUtils";
import { getSupportedFormats } from "./services/mediaProcessingService";
import { FILE_SIZE_LIMITS, SUPPORTED_MIME_TYPES, MIME_TYPE_PATTERNS, getFileSizeLimit } from "./utils/fileValidation";
import { getErrorStats } from "./utils/errorTaxonomy";
import { processStreamingDocumentJobWithResume } from "./jobs/streamingProcessDocumentJob";
import { startCleanupScheduler } from "./jobs/cleanupOldJobStates";
// @ts-ignore
import multer from "multer";
import * as path from "path";

const app = express();
app.use(express.json({ limit: "10mb" }));

// Configure multer for file uploads (for testing)
const storage = multer.memoryStorage();

// Custom file filter to validate file types and sizes
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Validate file type
  const isSupported = SUPPORTED_MIME_TYPES.has(file.mimetype) ||
    Object.values(MIME_TYPE_PATTERNS).some(pattern => pattern.test(file.mimetype));

  if (!isSupported) {
    const error = new Error(`Unsupported file type: ${file.mimetype}`) as any;
    error.code = 'UNSUPPORTED_MIME_TYPE';
    return cb(error);
  }

  cb(null, true);
};

// Custom limits function that respects our FILE_SIZE_LIMITS
const getFileSizeLimitForUpload = (mimetype: string): number => {
  const limit = getFileSizeLimit(mimetype);
  // Default fallback (shouldn't happen since we validate types first)
  return limit || 100 * 1024 * 1024; // 100MB
};

const upload = multer({
  storage: storage,
  fileFilter,
  limits: {
    // Set to the maximum of all our supported file size limits
    // This allows multer to accept files up to our largest limit, then we validate specifically
    fileSize: Math.max(...Object.values(FILE_SIZE_LIMITS))
  }
});

// Wrapper to handle multer errors properly
const handleUpload = (req: Request, res: Response, next: any) => {
  const uploadSingle = upload.single('file');
  uploadSingle(req, res, (error: any) => {
    if (error) {
      // Handle multer errors
      if (error.code === 'UNSUPPORTED_MIME_TYPE') {
        logger.warn("Unsupported file type", {
          fileName: req.file?.originalname,
          error: error.message
        });
        return res.status(400).json({
          error: "Unsupported file type",
          code: "UNSUPPORTED_MIME_TYPE",
          message: error.message,
          details: {
            supportedTypes: Array.from(SUPPORTED_MIME_TYPES)
          }
        });
      }

      // Handle other multer errors
      if (error.code === 'LIMIT_FILE_SIZE') {
        logger.warn("File too large", {
          fileName: req.file?.originalname,
          error: error.message
        });
        return res.status(413).json({
          error: "File too large",
          code: "FILE_TOO_LARGE",
          message: error.message
        });
      }

      // Handle any other multer errors
      if (error.code && error.code.startsWith('LIMIT_')) {
        logger.warn("Multer limit error", {
          fileName: req.file?.originalname,
          errorCode: error.code,
          error: error.message
        });
        return res.status(400).json({
          error: "File upload error",
          code: error.code,
          message: error.message
        });
      }

      // Handle any other errors
      logger.error("Unexpected upload error", { error: String(error), stack: error.stack });
      return res.status(500).json({
        error: "File upload error",
        code: "UPLOAD_ERROR",
        message: "An error occurred during file upload"
      });
    }
    next();
  });
};

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      deepgram: getDeepgramStats()
    }
  });
});

// Metrics endpoint
app.get("/metrics", (_req: Request, res: Response) => {
  const timeoutConfig = getTimeoutConfig();
  const supportedFormats = getSupportedFormats();
  const errorStats = getErrorStats();

  res.json({
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      deepgram: getDeepgramStats()
    },
    limits: {
      fileSizes: Object.entries(FILE_SIZE_LIMITS).reduce((acc, [mime, bytes]) => {
        acc[mime] = {
          bytes,
          mb: Math.round(bytes / (1024 * 1024))
        };
        return acc;
      }, {} as Record<string, { bytes: number; mb: number }>),
      timeouts: timeoutConfig.timeouts,
      supportedFormats,
      concurrency: {
        maxWorkers: parseInt(process.env.WORKER_CONCURRENCY || '2'),
        maxConcurrentOCR: parseInt(process.env.MAX_CONCURRENT_OCR_REQUESTS || '3')
      }
    },
    errorTaxonomy: errorStats,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    }
  });
});

// Test endpoint for direct file uploads (bypasses signed URL requirement)
app.post("/test-process-document", handleUpload, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const {
      tenantId,
      createdBy,
      caseId,
      documentId,
      originalFileName,
      callbackUrl,
      hmacSecret,
      chunking
    } = req.body;

    // Validate file size against our custom limits
    const sizeLimit = getFileSizeLimitForUpload(req.file.mimetype);
    if (req.file.size > sizeLimit) {
      const limitMB = Math.round(sizeLimit / (1024 * 1024));
      const actualMB = Math.round(req.file.size / (1024 * 1024));
      logger.warn("File too large in test upload", {
        fileName: req.file.originalname,
        size: req.file.size,
        limit: sizeLimit,
        mimeType: req.file.mimetype
      });
      return res.status(413).json({
        error: "File too large",
        code: "FILE_TOO_LARGE",
        message: `File too large: ${actualMB}MB exceeds limit of ${limitMB}MB for ${req.file.mimetype}`,
        details: {
          fileSize: req.file.size,
          limit: sizeLimit,
          mimeType: req.file.mimetype
        }
      });
    }

    // Create a temporary file URL (for testing purposes)
    const tempFileUrl = `file://${req.file.originalname}`;

    // Add the file to the job queue
    const jobData = {
      signedUrl: tempFileUrl,
      contentType: req.file.mimetype,
      tenantId: tenantId || 'test-tenant',
      createdBy: createdBy || tenantId || 'test-user',
      caseId: caseId || 'test-case',
      documentId: documentId || `test-doc-${Date.now()}`,
      documentType: undefined,
      originalFileName: originalFileName || req.file.originalname,
      callbackUrl: callbackUrl || 'http://localhost:3000/test-callback',
      hmacSecret: hmacSecret || 'test-secret',
      chunking: chunking ? JSON.parse(chunking) : undefined,
      // Store the file buffer for processing
      fileBuffer: req.file.buffer
    };

    const job = await queue.add("process-document", jobData, {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    });

    logger.info("queued test document", {
      jobId: job.id,
      documentId: jobData.documentId,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });
    res.json({ jobId: job.id });

  } catch (error: any) {
    logger.error("Failed to queue test document", { error: String(error) });
    res.status(500).json({ error: "Failed to queue test document processing" });
  }
});

// Test endpoint for library document uploads (bypasses signed URL requirement)
app.post("/test-process-library-document", handleUpload, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const {
      createdBy,
      libraryDocumentId,
      userId,
      teamId,
      folderId,
      originalFileName,
      callbackUrl,
      hmacSecret,
      chunking,
      documentType
    } = req.body;

    // Validate file size against our custom limits
    const sizeLimit = getFileSizeLimitForUpload(req.file.mimetype);
    if (req.file.size > sizeLimit) {
      const limitMB = Math.round(sizeLimit / (1024 * 1024));
      const actualMB = Math.round(req.file.size / (1024 * 1024));
      logger.warn("File too large in test library upload", {
        fileName: req.file.originalname,
        size: req.file.size,
        limit: sizeLimit,
        mimeType: req.file.mimetype
      });
      return res.status(413).json({
        error: "File too large",
        code: "FILE_TOO_LARGE",
        message: `File too large: ${actualMB}MB exceeds limit of ${limitMB}MB for ${req.file.mimetype}`,
        details: {
          fileSize: req.file.size,
          limit: sizeLimit,
          mimeType: req.file.mimetype
        }
      });
    }

    // Create a temporary file URL (for testing purposes)
    const tempFileUrl = `file://${req.file.originalname}`;

    // Add the file to the job queue
    const jobData = {
      signedUrl: tempFileUrl,
      contentType: req.file.mimetype,
      createdBy: createdBy || 'test-user',
      libraryDocumentId: libraryDocumentId || `test-library-doc-${Date.now()}`,
      userId: userId || undefined,
      teamId: teamId || undefined,
      folderId: folderId || undefined,
      documentType: documentType || undefined,
      originalFileName: originalFileName || req.file.originalname,
      callbackUrl: callbackUrl || 'http://localhost:3000/test-callback',
      hmacSecret: hmacSecret || 'test-secret',
      chunking: chunking ? JSON.parse(chunking) : undefined,
      // Store the file buffer for processing
      fileBuffer: req.file.buffer
    };

    const job = await queue.add("process-library-document", jobData, {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    });

    logger.info("queued test library document", {
      jobId: job.id,
      libraryDocumentId: jobData.libraryDocumentId,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });
    res.json({ jobId: job.id });

  } catch (error: any) {
    logger.error("Failed to queue test library document", { error: String(error) });
    res.status(500).json({ error: "Failed to queue test library document processing" });
  }
});

// Ingestion endpoint
const ingestSchema = z.object({
  signedUrl: z.string().url(),
  contentType: z.string().optional(),
  // Backwards compatibility: accept tenantId but prefer createdBy
  tenantId: z.string(),
  createdBy: z.string().optional(),
  caseId: z.string(),
  documentId: z.string(),
  documentType: z.string().optional(),
  originalFileName: z.string().optional(),
  callbackUrl: z.string().url(),
  hmacSecret: z.string().optional(),
  chunking: z
    .object({
      maxTokens: z.number().min(64).max(2048).default(400),
      overlapRatio: z.number().min(0).max(0.5).default(0.15),
      pageWindow: z.number().min(1).max(100).default(50),
    })
    .optional(),
});

// Library document ingestion schema
const libraryIngestSchema = z.object({
  signedUrl: z.string().url(),
  contentType: z.string().optional(),
  createdBy: z.string(),
  libraryDocumentId: z.string(),
  userId: z.string().optional(),
  teamId: z.string().optional(),
  folderId: z.string().optional(),
  documentType: z.string().optional(),
  originalFileName: z.string().optional(),
  callbackUrl: z.string().url(),
  hmacSecret: z.string().optional(),
  chunking: z
    .object({
      maxTokens: z.number().min(64).max(2048).default(400),
      overlapRatio: z.number().min(0).max(0.5).default(0.15),
      pageWindow: z.number().min(1).max(100).default(50),
    })
    .optional(),
});

app.post("/process-document", async (req: Request, res: Response) => {
  try {
    const parsed = ingestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const job = await queue.add("process-document", parsed.data, {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    });
    logger.info("queued document", { jobId: job.id, documentId: parsed.data.documentId });
    res.json({ jobId: job.id });
  } catch (error) {
    logger.error("Failed to queue document", { error: String(error) });
    res.status(500).json({ error: "Failed to queue document processing" });
  }
});

app.post("/process-library-document", async (req: Request, res: Response) => {
  try {
    const parsed = libraryIngestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const job = await queue.add("process-library-document", parsed.data, {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    });
    logger.info("queued library document", { jobId: job.id, libraryDocumentId: parsed.data.libraryDocumentId });
    res.json({ jobId: job.id });
  } catch (error) {
    logger.error("Failed to queue library document", { error: String(error) });
    res.status(500).json({ error: "Failed to queue library document processing" });
  }
});

// Optional: simple polling status
app.get("/status/:id", async (req: Request, res: Response) => {
  try {
    const job = await queue.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: "not found" });
    const state = await job.getState();
    const progress = job.progress;
    res.json({ state, progress, attemptsMade: job.attemptsMade });
  } catch (error) {
    logger.error("Failed to get job status", { error: String(error) });
    res.status(500).json({ error: "Failed to get job status" });
  }
});

// Resume stats endpoint
app.get("/resume-stats", async (_req: Request, res: Response) => {
  try {
    const IORedis = (await import('ioredis')).default;
    const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379");
    const keys = await redis.keys('job:state:*');
    const states = await Promise.all(
      keys.map(async key => {
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
      })
    );

    const validStates = states.filter(s => s !== null);

    const stats = {
      total: validStates.length,
      byPhase: validStates.reduce((acc: Record<string, number>, s) => {
        acc[s.currentPhase] = (acc[s.currentPhase] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      resumable: validStates.filter(s => s.canResume).length,
      resumed: validStates.filter(s => s.resumedFrom).length,
      failed: validStates.filter(s => s.errorCount > 0).length,
      avgProgress: validStates.reduce((sum, s) => {
        const total = s.progress.chunksGenerated || 1;
        const done = s.progress.chunksUpserted || 0;
        return sum + (done / total);
      }, 0) / (validStates.length || 1)
    };

    await redis.quit();
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get resume stats', { error: String(error) });
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// HMAC helper for callbacks
function signBody(body: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

// Worker registration
const useStreaming = process.env.USE_STREAMING_PROCESSOR === 'true';

if (useStreaming) {
  try {
    processStreamingDocumentJobWithResume(queue);
    logger.info("Streaming document processor registered successfully");
  } catch (error) {
    logger.error("Failed to register streaming document processor", { error: String(error) });
  }
} else {
  try {
    processDocumentJob(queue);
    logger.info("Document processing worker registered successfully");
  } catch (error) {
    logger.error("Failed to register document processing worker", { error: String(error) });
  }
}

try {
  processLibraryDocumentJob(queue);
  logger.info("Library document processing worker registered successfully");
} catch (error) {
  logger.error("Failed to register library document processing worker", { error: String(error) });
}

// Start cleanup scheduler if streaming is enabled
if (useStreaming && process.env.ENABLE_JOB_RESUME === 'true') {
  startCleanupScheduler();
  logger.info("Streaming cleanup scheduler started");
}

// Custom error handler for multer errors (must be after all routes)
app.use((err: any, req: Request, res: Response, next: any) => {
  // Handle multer errors
  if (err.code === 'UNSUPPORTED_MIME_TYPE') {
    logger.warn("Unsupported file type", {
      fileName: req.file?.originalname,
      error: err.message
    });
    return res.status(400).json({
      error: "Unsupported file type",
      code: "UNSUPPORTED_MIME_TYPE",
      message: err.message,
      details: {
        supportedTypes: Array.from(SUPPORTED_MIME_TYPES)
      }
    });
  }

  // Handle other multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    logger.warn("File too large", {
      fileName: req.file?.originalname,
      error: err.message
    });
    return res.status(413).json({
      error: "File too large",
      code: "FILE_TOO_LARGE",
      message: err.message
    });
  }

  // Handle any other multer errors
  if (err.code && err.code.startsWith('LIMIT_')) {
    logger.warn("Multer limit error", {
      fileName: req.file?.originalname,
      errorCode: err.code,
      error: err.message
    });
    return res.status(400).json({
      error: "File upload error",
      code: err.code,
      message: err.message
    });
  }

  // Log unexpected errors
  logger.error("Unexpected error", { error: String(err), stack: err.stack });
  
  // Return generic error for unexpected cases
  res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred"
  });
});

const port = process.env.PORT || 4001;
app.listen(port, async () => {
  try {
    await initQdrant();
    logger.info("Qdrant initialized");
  } catch (e) {
    logger.error("Qdrant init failed", { error: String(e) });
  }
  try {
    await initLibraryQdrant();
    logger.info("Library Qdrant collection initialized");
  } catch (e) {
    logger.error("Library Qdrant init failed", { error: String(e) });
  }
  logger.info(`document-processor listening on ${port}`);
});


