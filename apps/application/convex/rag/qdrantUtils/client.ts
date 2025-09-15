'use node'

import {QdrantClient} from '@qdrant/js-client-rest';

console.log("Qdrant configuration:", {
  url: process.env.QDRANT_URL ? "Set" : "Missing",
  apiKey: process.env.QDRANT_API_KEY ? "Set" : "Missing"
});

export const client = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
  // Avoid noisy warnings if minor versions differ
  checkCompatibility: false as any,
});

export default client;
