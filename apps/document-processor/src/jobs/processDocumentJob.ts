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

      logger.info("downloading file", { documentId: payload.documentId });
      const res = await fetch(payload.signedUrl);
      if (!res.ok || !res.body) throw new Error(`download failed: ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const pageWindow = payload.chunking?.pageWindow ?? 50;
      // Try OCR first in windowed fashion
      let fullText = "";
      try {
        fullText = await extractWithMistralOCR(buffer, { pageWindow });
      } catch (err) {
        logger.warn("mistral ocr failed, using fallback", { err: String(err) });
        fullText = await extractWithPdfFallback(buffer, { pageWindow });
      }

      const chunks = await chunkText(fullText);

      const embeddings = await embedChunks(chunks);
      const totalChunks = embeddings.length;

      await upsertChunks(payload.tenantId, payload.caseId, payload.documentId, embeddings);

      // Callback to Convex
      const callbackBody = JSON.stringify({
        status: "completed",
        documentId: payload.documentId,
        totalChunks,
        method: "mistral-ocr-primary",
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

      return { totalChunks };
    },
    { connection, concurrency: Number(process.env.WORKER_CONCURRENCY || 2) }
  );
}


