import "dotenv/config";
import { Worker, Queue } from "bullmq";
import { logger } from "../middleware/logging";
import { UnifiedStreamingPipeline } from "../services/streaming/unifiedStreamingPipeline";
import { StreamingEmbeddingService } from "../services/streaming/streamingEmbeddingService";
import { TempFileManager } from "../utils/tempFileManager";
import { CaseJobPayload } from "../types/streamingJobPayload";

export function processStreamingDocumentJobWithResume(queue: Queue) {
  new Worker<CaseJobPayload>(
    queue.name,
    async (job) => {
      logger.info('🔍 STREAMING WORKER received job', {
        jobId: job.id,
        jobName: job.name,
        jobType: job.data?.jobType || 'case-document',
        documentId: job.data?.documentId || 'unknown'
      });

      // ONLY process case document jobs
      if (job.data?.jobType && job.data.jobType !== "case-document") {
        logger.warn('⏭️  STREAMING WORKER skipping - wrong jobType', { 
          jobId: job.id,
          jobName: job.name,
          jobType: job.data.jobType,
          expectedJobType: 'case-document'
        });
        return;
      }

      // Also check job name for backward compatibility
      if (job.name !== "process-document") {
        logger.warn('⏭️  STREAMING WORKER skipping - wrong job name', { 
          jobId: job.id,
          jobName: job.name,
          expectedName: 'process-document'
        });
        return;
      }

      const start = Date.now();
      const payload = job.data;

      logger.info('🚀 STREAMING PROCESSOR - Processing document', {
        jobId: job.id,
        jobName: job.name,
        documentId: payload.documentId,
        processorType: 'STREAMING',
        features: 'resume-support, streaming-pipeline, chunked-processing'
      });

      const pipeline = new UnifiedStreamingPipeline(job.id!, payload);

      try {
        await pipeline.initialize();

        const tempFileManager = new TempFileManager(job.id!);
        const embeddingService = new StreamingEmbeddingService(tempFileManager);

        // Create embed and upsert function for case documents
        const embedAndUpsertFn = async (
          chunks: Array<{ index: number; text: string }>,
          state: any,
          progressCallback: (embedded: number, upserted: number) => Promise<void>
        ) => {
          const createdBy = payload.createdBy ?? payload.tenantId;
          return await embeddingService.embedAndUpsertStreamWithResume(
            chunks,
            createdBy,
            payload.caseId,
            payload.documentId,
                state,
                {
              onProgress: progressCallback
            }
          );
        };

        // Extract text callback for transcription
        const extractedTextCallback = async (extractedText: string, metadata: Record<string, unknown>) => {
              logger.info('Storing full transcript to database', {
                documentId: payload.documentId,
            transcriptLength: extractedText.length,
            confidence: metadata.confidence
              });

              try {
                const crypto = await import("crypto");
                const callbackBody = JSON.stringify({
                  documentId: payload.documentId,
              extractedText,
              extractedTextLength: extractedText.length,
              transcriptionConfidence: metadata.confidence,
              transcriptionDuration: metadata.duration,
              transcriptionModel: metadata.model,
                });

                const hmac = payload.hmacSecret
                  ? crypto.createHmac("sha256", payload.hmacSecret).update(callbackBody).digest("hex")
                  : undefined;

                const baseUrl = payload.callbackUrl.replace(/\/webhooks\/.*$/, '');
                const extractedTextUrl = `${baseUrl}/api/document-processor/extracted-text`;

                logger.info('Sending extracted text callback', {
                  url: extractedTextUrl,
                  hasHmac: !!hmac
                });

                const response = await fetch(extractedTextUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(hmac ? { 'X-Convex-Signature': hmac } : {})
                  },
                  body: callbackBody
                });

                if (!response.ok) {
                  throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                }

                logger.info('Successfully stored transcript to database');
              } catch (callbackError) {
                logger.warn('Failed to send extracted text callback', {
                  error: String(callbackError)
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
              tenantId: payload.tenantId
            },
            onProgress: (update) => {
              job.updateProgress(update);
            },
            extractedTextCallback
          },
          embedAndUpsertFn,
          job.attemptsMade + 1
        );

        logger.info('Job completed successfully', {
          jobId: job.id,
          documentId: payload.documentId,
          totalChunks: result.totalChunks,
          durationMs: result.durationMs,
          resumed: result.resumed
        });

        // Send success callback
        logger.info('Preparing success callback', {
          jobId: job.id,
          documentId: payload.documentId,
          callbackUrl: payload.callbackUrl,
          hasHmacSecret: !!payload.hmacSecret
        });

        const callbackBody = JSON.stringify({
          status: "completed",
          documentId: payload.documentId,
          totalChunks: result.totalChunks,
          method: result.method || 'streaming',
          durationMs: result.durationMs,
          resumed: result.resumed
        });

        logger.info('Success callback body prepared', {
          jobId: job.id,
          bodyLength: callbackBody.length,
          body: callbackBody
        });

        const crypto = await import("crypto");
        const hmac = payload.hmacSecret
          ? crypto.createHmac("sha256", payload.hmacSecret).update(callbackBody).digest("hex")
          : undefined;

        logger.info('HMAC generated for callback', {
          jobId: job.id,
          hmacGenerated: !!hmac,
          hmacLength: hmac?.length
        });

        try {
          const fetch = (await import('node-fetch')).default;
          logger.info('Sending success callback request', {
            jobId: job.id,
            url: payload.callbackUrl,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Signature': hmac ? 'present' : 'absent'
            }
          });

          const response = await fetch(payload.callbackUrl, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json", 
              ...(hmac ? { "X-Signature": hmac } : {}) 
            },
            body: callbackBody,
          });

          logger.info('Success callback response received', {
            jobId: job.id,
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries())
          });

          const responseText = await response.text();
          logger.info('Success callback response body', {
            jobId: job.id,
            responseBody: responseText,
            responseLength: responseText.length
          });

          if (!response.ok) {
            logger.warn('Success callback returned non-OK status', {
              jobId: job.id,
              status: response.status,
              statusText: response.statusText,
              responseBody: responseText
            });
          }
        } catch (callbackError) {
          logger.error('Success callback request failed', {
            jobId: job.id,
            error: String(callbackError),
            errorStack: callbackError instanceof Error ? callbackError.stack : undefined,
            callbackUrl: payload.callbackUrl
          });
        }

        // Cleanup
        if (process.env.AUTO_CLEANUP_ON_SUCCESS !== 'false') {
          await pipeline.cleanup(true);
        }

        return {
          totalChunks: result.totalChunks,
          durationMs: result.durationMs,
          resumed: result.resumed
        };

      } catch (error) {
        logger.error('Job failed', {
          jobId: job.id,
          documentId: payload.documentId,
          error: String(error)
        });

        const totalAttempts = typeof job.opts.attempts === "number" ? job.opts.attempts : 1;
        const isFinalAttempt = job.attemptsMade + 1 >= totalAttempts;
        
        logger.info('Job attempt failed', {
          jobId: job.id,
          documentId: payload.documentId,
          attemptNumber: job.attemptsMade + 1,
          totalAttempts,
          isFinalAttempt,
          willRetry: !isFinalAttempt
        });

        if (isFinalAttempt) {
          logger.info('Preparing failure callback (final attempt)', {
            jobId: job.id,
            documentId: payload.documentId,
            attemptsMade: job.attemptsMade + 1,
            totalAttempts,
            callbackUrl: payload.callbackUrl,
            hasHmacSecret: !!payload.hmacSecret
          });

          const failureBody = JSON.stringify({
            status: "failed",
            documentId: payload.documentId,
            error: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - start,
          });

          logger.info('Failure callback body prepared', {
            jobId: job.id,
            bodyLength: failureBody.length,
            body: failureBody
          });

          const crypto = await import("crypto");
          const hmac = payload.hmacSecret
            ? crypto.createHmac("sha256", payload.hmacSecret).update(failureBody).digest("hex")
            : undefined;

          logger.info('HMAC generated for failure callback', {
            jobId: job.id,
            hmacGenerated: !!hmac,
            hmacLength: hmac?.length
          });

          try {
            const fetch = (await import('node-fetch')).default;
            logger.info('Sending failure callback request', {
              jobId: job.id,
              url: payload.callbackUrl,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Signature': hmac ? 'present' : 'absent'
              }
            });

            const response = await fetch(payload.callbackUrl, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json", 
                ...(hmac ? { "X-Signature": hmac } : {}) 
              },
              body: failureBody,
            });

            logger.info('Failure callback response received', {
              jobId: job.id,
              status: response.status,
              statusText: response.statusText,
              ok: response.ok,
              headers: Object.fromEntries(response.headers.entries())
            });

            const responseText = await response.text();
            logger.info('Failure callback response body', {
              jobId: job.id,
              responseBody: responseText,
              responseLength: responseText.length
            });

            if (!response.ok) {
              logger.warn('Failure callback returned non-OK status', {
                jobId: job.id,
                status: response.status,
                statusText: response.statusText,
                responseBody: responseText
              });
            }
          } catch (callbackError) {
            logger.error('Failure callback request failed', {
              jobId: job.id,
              error: String(callbackError),
              errorStack: callbackError instanceof Error ? callbackError.stack : undefined,
              callbackUrl: payload.callbackUrl
            });
          }
        } else {
          logger.info('Not sending callback - not final attempt', {
            jobId: job.id,
            documentId: payload.documentId,
            attemptsMade: job.attemptsMade + 1,
            totalAttempts
          });
        }

        // Cleanup on final failure only
        if (isFinalAttempt && process.env.AUTO_CLEANUP_ON_FAILURE !== 'false') {
          logger.info('Cleaning up temp files (final attempt failed)', { jobId: job.id });
          await pipeline.cleanup(true);
        } else if (!isFinalAttempt) {
          logger.info('Keeping temp files for resume (non-final attempt)', { 
            jobId: job.id,
            attemptNumber: job.attemptsMade + 1,
            totalAttempts
          });
        }

        throw error;
      }
    },
    { 
      connection: queue.opts.connection,
      concurrency: Number(process.env.WORKER_CONCURRENCY || 2),
      name: "process-document",
      // Lock settings for long-running document processing
      lockDuration: Number(process.env.LOCK_DURATION_MS || 900000), // 15 minutes
      maxStalledCount: 2, // Allow job to stall twice before failing
      stalledInterval: 30000 // Check for stalled jobs every 30 seconds
    }
  );
}
