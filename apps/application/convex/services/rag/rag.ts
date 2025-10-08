// convex/rag.ts
import { components } from "../../../_generated/api";
import { RAG } from "@convex-dev/rag";
// Any AI SDK model that supports embeddings will work.
import { openai } from "@ai-sdk/openai";

export const rag = new RAG(components.rag, {
  textEmbeddingModel: openai.textEmbeddingModel("text-embedding-3-small"),
  embeddingDimension: 1536, // Needs to match your embedding model
  filterNames: [
    "caseId",
    "documentId", 
    "documentType",
    "createdBy",
    "folder"
  ],
});


