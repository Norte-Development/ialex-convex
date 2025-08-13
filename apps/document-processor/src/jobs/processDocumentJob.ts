import "dotenv/config";
import { Worker, Queue } from "bullmq";
import IORedis from "ioredis";
import fetch from "node-fetch";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { logger } from "../middleware/logging";
import { extractWithMistralOCR } from "../services/mistralOcrService";
import { extractWithPdfFallback } from "../services/pdfFallbackService";
import { chunkText } from "../utils/chunking";
import { embedChunks } from "../services/embeddingService";
import { upsertChunks } from "../services/qdrantService";

type JobPayload = {
  signedUrl: string;
  contentType?: string;
  tenantId: string;
  caseId: string;
  documentId: string;
  originalFileName?: string;
  callbackUrl: string;
  hmacSecret?: string;
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
        logger.info("downloading file", { documentId: payload.documentId });
        const res = await fetch(payload.signedUrl);
        if (!res.ok || !res.body) throw new Error(`download failed: ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const pageWindow = payload.chunking?.pageWindow ?? 50;
        // Try OCR first, fall back to PDF text extraction on error
        let fullText = "";
        let method = "mistral-ocr-latest";
        try {
          fullText = await extractWithMistralOCR(payload.signedUrl, { pageWindow });
        } catch (err) {
          logger.warn("mistral ocr failed, using fallback", { err: String(err) });
          method = "pdf-fallback";
          fullText = await extractWithPdfFallback(buffer, { pageWindow });
        }
        console.log("chunking");
        const chunks = await chunkText(fullText);

        console.log("embedding");
        const embeddings = await embedChunks(chunks);
        const totalChunks = embeddings.length;

        console.log("upserting chunks");

        await upsertChunks(payload.tenantId, payload.caseId, payload.documentId, embeddings);

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


