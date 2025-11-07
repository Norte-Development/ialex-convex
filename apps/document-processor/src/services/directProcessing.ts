import "dotenv/config";
import { logger } from "../middleware/logging";
import { UnifiedStreamingPipeline } from "./streaming/unifiedStreamingPipeline";
import { StreamingEmbeddingService } from "./streaming/streamingEmbeddingService";
import { TempFileManager } from "../utils/tempFileManager";
import {
  CaseJobPayload,
  LibraryJobPayload,
} from "../types/streamingJobPayload";
import { upsertLibraryChunks } from "./qdrantService";
import { embedChunks } from "./embeddingService";
import crypto from "crypto";

export interface ProcessingResult {
  totalChunks: number;
  durationMs: number;
  resumed: boolean;
  method?: string;
}

/**
 * Process a case document directly (synchronously) without BullMQ worker
 */
export async function processCaseDocumentDirectly(
  payload: CaseJobPayload,
  jobId: string,
  attemptNumber: number = 1,
): Promise<ProcessingResult> {
  const start = Date.now();

  logger.info("🚀 DIRECT PROCESSOR - Processing case document", {
    jobId,
    documentId: payload.documentId,
    processorType: "DIRECT_HTTP",
    features: "streaming-pipeline, chunked-processing",
  });

  const pipeline = new UnifiedStreamingPipeline(jobId, payload);

  try {
    await pipeline.initialize();

    const tempFileManager = new TempFileManager(jobId);
    const embeddingService = new StreamingEmbeddingService(tempFileManager);

    // Create embed and upsert function for case documents
    const embedAndUpsertFn = async (
      chunks: Array<{ index: number; text: string }>,
      state: any,
      progressCallback: (embedded: number, upserted: number) => Promise<void>,
    ) => {
      const createdBy = payload.createdBy ?? payload.tenantId;
      return await embeddingService.embedAndUpsertStreamWithResume(
        chunks,
        createdBy,
        payload.caseId,
        payload.documentId,
        state,
        {
          onProgress: progressCallback,
        },
      );
    };

    // Track current phase to avoid sending duplicate progress updates
    let lastPhase: string | undefined;

    // Extract text callback for transcription
    const extractedTextCallback = async (
      extractedText: string,
      metadata: Record<string, unknown>,
    ) => {
      logger.info("Storing full transcript to database", {
        documentId: payload.documentId,
        transcriptLength: extractedText.length,
        confidence: metadata.confidence,
      });

      try {
        const callbackBody = JSON.stringify({
          documentId: payload.documentId,
          extractedText,
          extractedTextLength: extractedText.length,
          transcriptionConfidence: metadata.confidence,
          transcriptionDuration: metadata.duration,
          transcriptionModel: metadata.model,
        });

        const hmac = payload.hmacSecret
          ? crypto
              .createHmac("sha256", payload.hmacSecret)
              .update(callbackBody)
              .digest("hex")
          : undefined;

        const baseUrl = payload.callbackUrl.replace(/\/webhooks\/.*$/, "");
        const extractedTextUrl = `${baseUrl}/api/document-processor/extracted-text`;

        logger.info("Sending extracted text callback", {
          url: extractedTextUrl,
          hasHmac: !!hmac,
        });

        const response = await fetch(extractedTextUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(hmac ? { "X-Convex-Signature": hmac } : {}),
          },
          body: callbackBody,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        logger.info("Successfully stored transcript to database");
      } catch (callbackError) {
        logger.warn("Failed to send extracted text callback", {
          error: String(callbackError),
        });
      }
    };

    // Run the pipeline
    const result = await pipeline.process(
      payload,
      {
        documentIdentifier: payload.documentId,
        metadata: {
          caseId: payload.caseId,
          tenantId: payload.tenantId,
        },
        onProgress: async (update) => {
          logger.debug("Processing progress", update);

          // Only send update when phase changes (not on every progress tick)
          if (update.phase && update.phase !== lastPhase) {
            lastPhase = update.phase;

            try {
              const baseUrl = payload.callbackUrl.replace(
                /\/webhooks\/.*$/,
                "",
              );
              const progressUrl = `${baseUrl}/webhooks/document-progress`;

              const progressBody = JSON.stringify({
                documentId: payload.documentId,
                phase: update.phase,
                progress: update.percent,
              });

              const hmac = payload.hmacSecret
                ? crypto
                    .createHmac("sha256", payload.hmacSecret)
                    .update(progressBody)
                    .digest("hex")
                : undefined;

              await fetch(progressUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(hmac ? { "X-Signature": hmac } : {}),
                },
                body: progressBody,
              });

              logger.info("Phase transition update sent", {
                phase: update.phase,
                progress: update.percent,
              });
            } catch (error) {
              logger.warn("Failed to send progress update", {
                phase: update.phase,
                error: String(error),
              });
            }
          }
        },
        extractedTextCallback,
      },
      embedAndUpsertFn,
      attemptNumber,
    );

    logger.info("Case document processing completed successfully", {
      jobId,
      documentId: payload.documentId,
      totalChunks: result.totalChunks,
      durationMs: result.durationMs,
      resumed: result.resumed,
    });

    // Cleanup
    if (process.env.AUTO_CLEANUP_ON_SUCCESS !== "false") {
      await pipeline.cleanup(true);
    }

    return {
      totalChunks: result.totalChunks,
      durationMs: result.durationMs,
      resumed: result.resumed,
      method: result.method,
    };
  } catch (error) {
    logger.error("Case document processing failed", {
      jobId,
      documentId: payload.documentId,
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Cleanup on failure
    if (process.env.AUTO_CLEANUP_ON_FAILURE !== "false") {
      await pipeline.cleanup(true);
    }

    throw error;
  }
}

/**
 * Process a library document directly (synchronously) without BullMQ worker
 */
export async function processLibraryDocumentDirectly(
  payload: LibraryJobPayload,
  jobId: string,
  attemptNumber: number = 1,
): Promise<ProcessingResult> {
  const start = Date.now();

  logger.info("🚀 DIRECT PROCESSOR - Processing library document", {
    jobId,
    libraryDocumentId: payload.libraryDocumentId,
    processorType: "DIRECT_HTTP",
    features: "streaming-pipeline, chunked-processing",
  });

  const pipeline = new UnifiedStreamingPipeline(jobId, payload);

  try {
    await pipeline.initialize();

    // Track current phase to avoid sending duplicate progress updates
    let lastPhase: string | undefined;

    // Create embed and upsert function for library documents
    const embedAndUpsertFn = async (
      chunks: Array<{ index: number; text: string }>,
      state: any,
      progressCallback: (embedded: number, upserted: number) => Promise<void>,
    ) => {
      // Embed chunks - extract just the text for embedding
      const chunkTexts = chunks.map((c) => c.text);
      const embeddings = await embedChunks(chunkTexts);

      // Upsert to Qdrant with library-specific metadata
      await upsertLibraryChunks(
        payload.createdBy,
        payload.libraryDocumentId,
        payload.userId,
        payload.teamId,
        payload.folderId,
        embeddings,
        {
          documentType: payload.documentType,
        },
      );

      await progressCallback(embeddings.length, embeddings.length);

      return {
        totalEmbedded: embeddings.length,
        totalUpserted: embeddings.length,
        skipped: 0,
      };
    };

    // Extract text callback for transcription
    const extractedTextCallback = async (
      extractedText: string,
      metadata: Record<string, unknown>,
    ) => {
      logger.info("Storing full transcript to database (Library Document)", {
        libraryDocumentId: payload.libraryDocumentId,
        transcriptLength: extractedText.length,
        confidence: metadata.confidence,
      });

      try {
        const callbackBody = JSON.stringify({
          libraryDocumentId: payload.libraryDocumentId,
          extractedText,
          extractedTextLength: extractedText.length,
          transcriptionConfidence: metadata.confidence,
          transcriptionDuration: metadata.duration,
          transcriptionModel: metadata.model,
        });

        const hmac = payload.hmacSecret
          ? crypto
              .createHmac("sha256", payload.hmacSecret)
              .update(callbackBody)
              .digest("hex")
          : undefined;

        const baseUrl = payload.callbackUrl.replace(/\/webhooks\/.*$/, "");
        const extractedTextUrl = `${baseUrl}/api/document-processor/library-extracted-text`;

        logger.info("Sending extracted text callback (Library Document)", {
          url: extractedTextUrl,
          hasHmac: !!hmac,
        });

        const response = await fetch(extractedTextUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(hmac ? { "X-Convex-Signature": hmac } : {}),
          },
          body: callbackBody,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        logger.info(
          "Successfully stored transcript to database (Library Document)",
        );
      } catch (callbackError) {
        logger.warn(
          "Failed to send extracted text callback (Library Document)",
          {
            error: String(callbackError),
          },
        );
      }
    };

    // Run the pipeline
    const result = await pipeline.process(
      payload,
      {
        documentIdentifier: payload.libraryDocumentId,
        metadata: {
          userId: payload.userId,
          teamId: payload.teamId,
          folderId: payload.folderId,
        },
        onProgress: async (update) => {
          logger.debug("Processing progress", update);

          // Only send update when phase changes (not on every progress tick)
          if (update.phase && update.phase !== lastPhase) {
            lastPhase = update.phase;

            try {
              const baseUrl = payload.callbackUrl.replace(
                /\/webhooks\/.*$/,
                "",
              );
              const progressUrl = `${baseUrl}/webhooks/library-document-progress`;

              const progressBody = JSON.stringify({
                libraryDocumentId: payload.libraryDocumentId,
                phase: update.phase,
                progress: update.percent,
              });

              const hmac = payload.hmacSecret
                ? crypto
                    .createHmac("sha256", payload.hmacSecret)
                    .update(progressBody)
                    .digest("hex")
                : undefined;

              await fetch(progressUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(hmac ? { "X-Signature": hmac } : {}),
                },
                body: progressBody,
              });

              logger.info("Phase transition update sent", {
                phase: update.phase,
                progress: update.percent,
              });
            } catch (error) {
              logger.warn("Failed to send progress update", {
                phase: update.phase,
                error: String(error),
              });
            }
          }
        },
        extractedTextCallback,
      },
      embedAndUpsertFn,
      attemptNumber,
    );

    logger.info("Library document processing completed successfully", {
      jobId,
      libraryDocumentId: payload.libraryDocumentId,
      totalChunks: result.totalChunks,
      durationMs: result.durationMs,
      resumed: result.resumed,
    });

    // Cleanup
    if (process.env.AUTO_CLEANUP_ON_SUCCESS !== "false") {
      await pipeline.cleanup(true);
    }

    return {
      totalChunks: result.totalChunks,
      durationMs: result.durationMs,
      resumed: result.resumed,
      method: result.method,
    };
  } catch (error) {
    logger.error("Library document processing failed", {
      jobId,
      libraryDocumentId: payload.libraryDocumentId,
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Cleanup on failure
    if (process.env.AUTO_CLEANUP_ON_FAILURE !== "false") {
      await pipeline.cleanup(true);
    }

    throw error;
  }
}

/**
 * Send processing callback to Convex
 */
export async function sendProcessingCallback(
  callbackUrl: string,
  body: Record<string, any>,
  hmacSecret?: string,
): Promise<void> {
  const callbackBody = JSON.stringify(body);

  const hmac = hmacSecret
    ? crypto.createHmac("sha256", hmacSecret).update(callbackBody).digest("hex")
    : undefined;

  logger.info("Sending processing callback", {
    url: callbackUrl,
    hasHmac: !!hmac,
    status: body.status,
  });

  try {
    const response = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(hmac ? { "X-Signature": hmac } : {}),
      },
      body: callbackBody,
    });

    logger.info("Callback response received", {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    const responseText = await response.text();

    if (!response.ok) {
      logger.warn("Callback returned non-OK status", {
        status: response.status,
        statusText: response.statusText,
        responseBody: responseText,
      });
    }
  } catch (callbackError) {
    logger.error("Callback request failed", {
      error: String(callbackError),
      errorStack:
        callbackError instanceof Error ? callbackError.stack : undefined,
      callbackUrl,
    });
    throw callbackError;
  }
}
