import "dotenv/config";
import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: false 
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
        const resp = await openai.embeddings.create({ model, input: batch });
        resp.data.forEach((d, idx) => {
          results.push({ id: String(i + idx), vector: d.embedding, text: batch[idx], metadata: { chunkIndex: i + idx } });
        });
        i += size;
        break;
      } catch (err: any) {
        attempt += 1;
        const status = err?.status ?? err?.response?.status;
        const message: string = typeof err?.message === "string" ? err.message : String(err);
        const openAiType = err?.error?.type || err?.response?.data?.error?.type;

        const isRateLimit = status === 429 || openAiType === "rate_limit_exceeded";
        const isServerBusy = status === 503 || openAiType === "server_error";
        const isBatchTooLarge = status === 400 && /too\s*many\s*inputs|array\s*is\s*too\s*long|batch\s*too\s*large|maximum\s*context\s*length|max\s*tokens|limit/i.test(message);

        if (isRateLimit || isServerBusy) {
          if (attempt > maxRetries) throw err;
          const jitter = Math.floor(Math.random() * 100);
          await new Promise((r) => setTimeout(r, backoffMs + jitter));
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


