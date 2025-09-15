import "dotenv/config";
import OpenAI from "openai";
import { logger } from "../middleware/logging.js";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: false,
  timeout: 60000, // 60 seconds
  maxRetries: 3,
});

export async function embedChunks(chunks: string[]): Promise<Array<{ id: string; vector: number[]; text: string; metadata: Record<string, any> }>> {
  const model = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
  const defaultBatch = Number(process.env.EMBED_BATCH || 64);
  let baseBatchSize = Number.isFinite(defaultBatch) && defaultBatch > 0 ? defaultBatch : 64;
  const maxRetries = Number(process.env.EMBED_MAX_RETRIES || 6);

  const results: Array<{ id: string; vector: number[]; text: string; metadata: Record<string, any> }> = [];

  let i = 0;
  let backoffMs = 250;
  while (i < chunks.length) {
    let size = Math.min(baseBatchSize, chunks.length - i);

    // Attempt to embed current window; shrink on 400-size errors; backoff on 429/503.
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const batch = chunks.slice(i, i + size);
      try {
        logger.debug('Creating embeddings', { batchSize: batch.length, attempt, model });
        const resp = await openai.embeddings.create({ model, input: batch });
        resp.data.forEach((d, idx) => {
          results.push({ id: String(i + idx), vector: d.embedding, text: batch[idx], metadata: { chunkIndex: i + idx } });
        });
        logger.debug('Embeddings created successfully', { batchSize: batch.length });
        i += size;
        break;
      } catch (err: any) {
        attempt += 1;
        const status = err?.status ?? err?.response?.status;
        const message: string = typeof err?.message === "string" ? err.message : String(err);
        const openAiType = err?.error?.type || err?.response?.data?.error?.type;

        const isRateLimit = status === 429 || openAiType === "rate_limit_exceeded";
        const isServerBusy = status === 503 || openAiType === "server_error";
        const isConnectionError = err?.code === 'ECONNRESET' || err?.code === 'ENOTFOUND' || err?.code === 'ETIMEDOUT' || err?.code === 'ECONNREFUSED';
        const isBatchTooLarge = status === 400 && /too\s*many\s*inputs|array\s*is\s*too\s*long|batch\s*too\s*large|maximum\s*context\s*length|max\s*tokens|limit/i.test(message);

        if (isRateLimit || isServerBusy || isConnectionError) {
          if (attempt > maxRetries) {
            logger.error('OpenAI embedding failed after retries', { 
              error: message, 
              status, 
              attempt, 
              maxRetries,
              code: err?.code,
              batchSize: batch.length 
            });
            throw err;
          }
          const jitter = Math.floor(Math.random() * 100);
          const delay = backoffMs + jitter;
          logger.warn('OpenAI embedding retry', { 
            error: message, 
            status, 
            attempt, 
            delay,
            code: err?.code,
            batchSize: batch.length 
          });
          await new Promise((r) => setTimeout(r, delay));
          backoffMs = Math.min(backoffMs * 2, 5000);
          continue;
        }

        if (isBatchTooLarge) {
          if (size <= 1) throw err;
          const newSize = Math.max(1, Math.floor(size / 2));
          baseBatchSize = Math.min(baseBatchSize, newSize);
          size = newSize;
          continue;
        }

        throw err;
      }
    }
  }
  return results;
}


