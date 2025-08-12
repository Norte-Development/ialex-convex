import "dotenv/config";
import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: false 
});

export async function embedChunks(chunks: string[]): Promise<Array<{ id: string; vector: number[]; text: string; metadata: Record<string, any> }>> {
  const model = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
  const batchSize = Number(process.env.EMBED_BATCH || 64);
  const results: Array<{ id: string; vector: number[]; text: string; metadata: Record<string, any> }> = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const resp = await openai.embeddings.create({ model, input: batch });
    resp.data.forEach((d, idx) => {
      results.push({ id: String(i + idx), vector: d.embedding, text: batch[idx], metadata: { chunkIndex: i + idx } });
    });
  }
  return results;
}


