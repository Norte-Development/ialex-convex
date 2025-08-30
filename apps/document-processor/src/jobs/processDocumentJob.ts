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
};

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null
});

export function processDocumentJob(queue: Queue) {
  new Worker<JobPayload>(
    queue.name,
    async (job) => {
      const start = Date.now();
      const payload = job.data;

      try {
        logger.info("downloading file", { 
          documentId: payload.documentId,
          fileName: payload.originalFileName,
          contentType: payload.contentType
        });
        
        const res = await fetch(payload.signedUrl);
        if (!res.ok || !res.body) throw new Error(`download failed: ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const pageWindow = payload.chunking?.pageWindow ?? 50;
        
        // Extract text using the new multi-format service
        logger.info("extracting text", { 
          documentId: payload.documentId,
          contentType: payload.contentType,
          fileName: payload.originalFileName
        });
        
        const { text: fullText, method } = await extractDocumentText(
          buffer,
          payload.signedUrl,
          payload.originalFileName,
          payload.contentType,
          { pageWindow }
        );

        logger.info("text extraction completed", {
          documentId: payload.documentId,
          method,
          textLength: fullText.length
        });
        console.log("chunking");
        const chunks = await chunkText(fullText);

        console.log("embedding");
        const embeddings = await embedChunks(chunks);
        const totalChunks = embeddings.length;

        console.log("upserting chunks");

        const createdBy = payload.createdBy ?? payload.tenantId;
        await upsertChunks(createdBy, payload.caseId, payload.documentId, embeddings, {
          documentType: payload.documentType,
        });

        console.log("callback");

        // Success callback to Convex
        const callbackBody = JSON.stringify({
          status: "completed",
          documentId: payload.documentId,
          totalChunks,
          method,
          durationMs: Date.now() - start,
        });

        const hmac = payload.hmacSecret
          ? await import("crypto").then(({ createHmac }) =>
              createHmac("sha256", payload.hmacSecret!).update(callbackBody).digest("hex")
            )
          : undefined;

        await fetch(payload.callbackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(hmac ? { "X-Signature": hmac } : {}) },
          body: callbackBody,
        });

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


