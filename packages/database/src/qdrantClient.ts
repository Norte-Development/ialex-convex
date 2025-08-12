import { QdrantClient } from "@qdrant/js-client-rest";

export function createQdrantClient() {
  const url = process.env.QDRANT_URL;
  if (!url) throw new Error("QDRANT_URL is required");
  return new QdrantClient({ url, apiKey: process.env.QDRANT_API_KEY });
}


