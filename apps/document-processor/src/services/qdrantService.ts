import "dotenv/config";
import { QdrantClient } from "@qdrant/js-client-rest";

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY,
});

const COLLECTION = process.env.QDRANT_COLLECTION || "ialex_documents";

export async function ensureCollection() {
  try {
    await qdrant.getCollection(COLLECTION);
  } catch {
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: Number(process.env.EMBED_DIM || 1536), distance: "Cosine" },
      optimizers_config: { default_segment_number: 2 },
    });
    await qdrant.createPayloadIndex(COLLECTION, {
      field_name: "tenantId",
      field_schema: "keyword",
    });
    await qdrant.createPayloadIndex(COLLECTION, {
      field_name: "caseId",
      field_schema: "keyword",
    });
    await qdrant.createPayloadIndex(COLLECTION, {
      field_name: "documentId",
      field_schema: "keyword",
    });
  }
}

export async function upsertChunks(
  tenantId: string,
  caseId: string,
  documentId: string,
  embedded: Array<{ id: string; vector: number[]; text: string; metadata: Record<string, any> }>
) {
  await ensureCollection();
  await qdrant.upsert(COLLECTION, {
    wait: true,
    points: embedded.map((e) => ({
      id: `${tenantId}:${caseId}:${documentId}:${e.id}`,
      vector: e.vector,
      payload: {
        tenantId,
        caseId,
        documentId,
        text: e.text,
        ...e.metadata,
      },
    })),
  });
}


