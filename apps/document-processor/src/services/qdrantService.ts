import "dotenv/config";
import { QdrantClient } from "@qdrant/js-client-rest";
import { createHash } from "crypto";

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY,
});

const COLLECTION = process.env.QDRANT_COLLECTION || "ialex_documents";

function toDeterministicUuid(input: string): string {
  const hash = createHash("sha1").update(input).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  // Set version 5 (name-based, SHA-1)
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  // Set variant to RFC 4122
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32),
  ].join("-");
}

let initialized: Promise<void> | null = null;

export function initQdrant(): Promise<void> {
  if (!initialized) {
    initialized = (async () => {
      try {
        await qdrant.getCollection(COLLECTION);
      } catch {
        await qdrant.createCollection(COLLECTION, {
          vectors: { size: Number(process.env.EMBED_DIM || 1536), distance: "Cosine" },
          optimizers_config: { default_segment_number: 2 },
        });
      }

      const indexes = [
        { field_name: "createdBy", field_schema: "keyword" as const },
        { field_name: "caseId", field_schema: "keyword" as const },
        { field_name: "documentId", field_schema: "keyword" as const },
        { field_name: "documentType", field_schema: "keyword" as const },
        { field_name: "folder", field_schema: "keyword" as const },
      ];
      for (const spec of indexes) {
        try {
          await qdrant.createPayloadIndex(COLLECTION, spec);
        } catch {
          // Index already exists
        }
      }
    })();
  }
  return initialized;
}
export async function upsertChunks(
  createdBy: string,
  caseId: string,
  documentId: string,
  embedded: Array<{ id: string; vector: number[]; text: string; metadata: Record<string, any> }>,
  opts?: { documentType?: string; folder?: string }
) {
  console.log("upserting chunks", embedded.length);
  try{
    await qdrant.upsert(COLLECTION, {
      wait: true,
      points: embedded.map((e) => ({
        id: toDeterministicUuid(`${createdBy}|${caseId}|${documentId}|${e.id}`),
        vector: e.vector,
        payload: {
          createdBy,
          caseId,
          documentId,
          documentType: opts?.documentType ?? (e.metadata?.documentType as string | undefined) ?? "other",
          ...(opts?.folder ? { folder: opts.folder } : {}),
          text: e.text,
          ...e.metadata,
        },
      })),
    });
  } catch (err: any) {
    if (err?.status === 404) {
      await initQdrant();
      await qdrant.upsert(COLLECTION, {
        wait: true,
        points: embedded.map((e) => ({
          id: toDeterministicUuid(`${createdBy}|${caseId}|${documentId}|${e.id}`),
          vector: e.vector,
          payload: {
            createdBy,
            caseId,
            documentId,
            documentType: opts?.documentType ?? (e.metadata?.documentType as string | undefined) ?? "other",
            ...(opts?.folder ? { folder: opts.folder } : {}),
            text: e.text,
            ...e.metadata,
          },
        })),
      });
      return;
    }
    console.error("Error upserting chunks", err);
    throw err;
  }
}


