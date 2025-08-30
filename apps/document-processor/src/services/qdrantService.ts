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
  // Default batch size; can be tuned via env variable.
  const defaultBatchSize = Number(process.env.QDRANT_UPSERT_BATCH_SIZE || 128);
  let batchSize = Number.isFinite(defaultBatchSize) && defaultBatchSize > 0 ? defaultBatchSize : 128;

  let index = 0;
  let retryDelayMs = 250;
  while (index < embedded.length) {
    let size = Math.min(batchSize, embedded.length - index);

    // Attempt to upsert the current batch, shrinking the batch size on payload errors.
    // Keep retrying the same window [index, index + size) until it succeeds or size == 1 and still fails.
    // On 404 (collection not found), initialize and retry immediately.
    // On other errors, bubble up after a single attempt.
    // This guards against API limits on request size or points per request.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const batch = embedded.slice(index, index + size);
      const pointStructs = batch.map((e) => ({
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
      }));

      try {
        await qdrant.batchUpdate(COLLECTION, {
          wait: true,
          operations: [
            {
              upsert: { points: pointStructs },
            },
          ],
        });
        // Success: advance window and continue
        index += size;
        break;
      } catch (err: any) {
        // Some deployments or client versions may not support batchUpdate; fallback to upsert
        if (err?.status === 405 || /method\s*not\s*allowed|unknown\s*variant|unsupported\s*operation|batchUpdate/i.test(String(err?.message || err))) {
          try {
            await qdrant.upsert(COLLECTION, { wait: true, points: pointStructs });
            index += size;
            break;
          } catch (innerErr: any) {
            err = innerErr;
          }
        }
        // Collection missing: init and retry same batch
        if (err?.status === 404) {
          await initQdrant();
          continue;
        }

        // Rate limiting or temporary unavailability: backoff and retry same batch
        if (err?.status === 429 || err?.status === 503) {
          await new Promise((r) => setTimeout(r, retryDelayMs));
          retryDelayMs = Math.min(retryDelayMs * 2, 5000);
          continue;
        }

        const message = typeof err?.message === "string" ? err.message : String(err);
        const isPayloadTooLarge = err?.status === 413 || /payload\s*too\s*large|request\s*entity\s*too\s*large|body\s*limit/i.test(message);
        const isBadRequestLikelyDueToSize = err?.status === 400 && /too\s*large|limit|points.*exceed/i.test(message);

        if (isPayloadTooLarge || isBadRequestLikelyDueToSize) {
          if (size <= 1) {
            console.error("Upsert failed even with batch size 1", err);
            throw err;
          }
          // Reduce batch size and retry
          const newSize = Math.max(1, Math.floor(size / 2));
          console.warn(`Upsert payload too large; reducing batch size from ${size} to ${newSize}`);
          size = newSize;
          batchSize = Math.min(batchSize, size); // keep global batch size conservative
          continue;
        }

        console.error("Error upserting chunks", err);
        throw err;
      }
    }
  }
}


