import "dotenv/config";
import { Worker, Queue } from "bullmq";
import IORedis from "ioredis";
import fetch from "node-fetch";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { logger } from "../middleware/logging";
import { chunkText } from "../utils/chunking";
import { embedChunks } from "../services/embeddingService";
import { upsertChunks } from "../services/qdrantService";
import { extractDocumentText } from "../services/documentExtractionService";
import { validateFile, validateFileBuffer } from "../utils/fileValidation";
import { timeoutWrappers, TimeoutError } from "../utils/timeoutUtils";

type JobPayload = {
  signedUrl: string;
  contentType?: string;
  tenantId: string; // deprecated alias; keep reading but map to createdBy
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
  fileBuffer?: Buffer | Uint8Array; // For test uploads
};

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
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

export function processDocumentJob(queue: Queue) {
  new Worker<JobPayload>(
    queue.name,
    async (job) => {
      const start = Date.now();
      const payload = job.data;

      try {
        let validation: any = { isValid: true, mimeType: payload.contentType };

        // Validate files - use buffer validation for test uploads, URL validation for regular uploads
        if (payload.fileBuffer) {
          // Test upload validation using buffer
          logger.info("validating test file buffer", {
            documentId: payload.documentId,
            fileName: payload.originalFileName,
            contentType: payload.contentType,
            bufferSize: payload.fileBuffer.length
          });

          validation = validateFileBuffer(payload.fileBuffer, payload.contentType || '', payload.originalFileName);
        } else {
          // Regular upload validation using signed URL
          logger.info("validating file", {
            documentId: payload.documentId,
            fileName: payload.originalFileName,
            contentType: payload.contentType
          });

          validation = await validateFile(payload.signedUrl, payload.originalFileName);
        }

        if (!validation.isValid) {
          logger.error("File validation failed", {
            documentId: payload.documentId,
            errorCode: validation.errorCode,
            errorMessage: validation.errorMessage,
            isTestFile: !!payload.fileBuffer
          });

          // Send failure callback immediately
          const failureBody = JSON.stringify({
            status: "failed",
            documentId: payload.documentId,
            errorCode: validation.errorCode,
            errorMessage: validation.errorMessage,
            durationMs: Date.now() - start,
          });

          const hmac = payload.hmacSecret
            ? await import("crypto").then(({ createHmac }) =>
                createHmac("sha256", payload.hmacSecret!).update(failureBody).digest("hex")
              )
            : undefined;

          try {
            await timeoutWrappers.fileDownload(
              () => fetch(payload.callbackUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(hmac ? { "X-Signature": hmac } : {}) },
                body: failureBody,
              }),
              'failure callback'
            );
          } catch {
            // Swallow callback errors
          }

          throw new Error(`${validation.errorCode}: ${validation.errorMessage}`);
        }

        logger.info("downloading file", {
          documentId: payload.documentId,
          fileName: payload.originalFileName,
          contentType: validation.mimeType,
          contentLength: validation.contentLength
        });

        let buffer: Buffer;

        // Check if we have a file buffer from test upload
        if (payload.fileBuffer) {
          buffer = Buffer.from(payload.fileBuffer);
          logger.info("using uploaded file buffer", { bufferSize: buffer.length });
        } else {
          // Download file from signed URL
          const res = await timeoutWrappers.fileDownload(
            () => fetch(payload.signedUrl),
            'file download'
          );
          if (!res.ok || !res.body) throw new Error(`download failed: ${res.status}`);
          const arrayBuffer = await res.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
        }

        const pageWindow = payload.chunking?.pageWindow ?? 50;
        
        // Extract text using the new multi-format service
        logger.info("extracting text", { 
          documentId: payload.documentId,
          contentType: payload.contentType,
          fileName: payload.originalFileName
        });
        
        const { text: fullText, method } = await timeoutWrappers.extractionProcessing(
          () => extractDocumentText(
            buffer,
            payload.signedUrl,
            payload.originalFileName,
            validation.mimeType || payload.contentType, // Use validated MIME type
            { pageWindow }
          ),
          'document text extraction'
        );

        logger.info("text extraction completed", {
          documentId: payload.documentId,
          method,
          textLength: fullText.length
        });
        console.log("chunking");
        const chunks = await timeoutWrappers.chunkingProcessing(
          () => chunkText(fullText),
          'text chunking'
        );

        console.log("embedding");
        const embeddings = await timeoutWrappers.embeddingRequest(
          () => embedChunks(chunks),
          'chunk embedding'
        );
        const totalChunks = embeddings.length;

        console.log("upserting chunks");

        const createdBy = payload.createdBy ?? payload.tenantId;
        await timeoutWrappers.qdrantUpsert(
          () => upsertChunks(createdBy, payload.caseId, payload.documentId, embeddings, {
            documentType: payload.documentType,
          }),
          'Qdrant chunk upsert'
        );

        console.log("callback");

        // Success callback to Convex
        const callbackBody = JSON.stringify({
          status: "completed",
          documentId: payload.documentId,
          totalChunks,
          method,
          mimeType: validation.mimeType,
          fileSizeBytes: validation.contentLength,
          durationMs: Date.now() - start,
        });

        const hmac = payload.hmacSecret
          ? await import("crypto").then(({ createHmac }) =>
              createHmac("sha256", payload.hmacSecret!).update(callbackBody).digest("hex")
            )
          : undefined;

        await timeoutWrappers.fileDownload(
          () => fetch(payload.callbackUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(hmac ? { "X-Signature": hmac } : {}) },
            body: callbackBody,
          }),
          'success callback'
        );

        console.log("done");

        return { totalChunks };
      } catch (error) {
        const totalAttempts = typeof job.opts.attempts === "number" ? job.opts.attempts : 1;
        const isFinalAttempt = job.attemptsMade + 1 >= totalAttempts;

        if (isFinalAttempt) {
          // Failure callback to Convex on final attempt only
          const errorMessage = error instanceof Error ? error.message : String(error);
          const failureBody = JSON.stringify({
            status: "failed",
            documentId: payload.documentId,
            error: errorMessage,
            durationMs: Date.now() - start,
          });

          const hmac = payload.hmacSecret
            ? await import("crypto").then(({ createHmac }) =>
                createHmac("sha256", payload.hmacSecret!).update(failureBody).digest("hex")
              )
            : undefined;

          try {
            await fetch(payload.callbackUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...(hmac ? { "X-Signature": hmac } : {}) },
              body: failureBody,
            });
          } catch {
            // Swallow callback errors here; job will still be marked failed below
          }
        }

        throw error;
      }
    },
    { connection, concurrency: Number(process.env.WORKER_CONCURRENCY || 2) }
  );
}


