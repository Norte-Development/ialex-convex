import "dotenv/config";
import { Worker, Queue } from "bullmq";
import { logger } from "../middleware/logging";
import { UnifiedStreamingPipeline } from "../services/streaming/unifiedStreamingPipeline";
import { TempFileManager } from "../utils/tempFileManager";
import { LibraryJobPayload } from "../types/streamingJobPayload";
import { upsertLibraryChunks } from "../services/qdrantService";
import { embedChunks } from "../services/embeddingService";

export function processStreamingLibraryDocumentJobWithResume(queue: Queue) {
  new Worker<LibraryJobPayload>(
    queue.name,
    async (job) => {
      logger.info('🔍 STREAMING LIBRARY WORKER received job', {
        jobId: job.id,
        jobName: job.name,
        jobType: job.data?.jobType || 'library-document',
        libraryDocumentId: job.data?.libraryDocumentId || 'unknown'
      });

      // ONLY process library document jobs
      if (job.data?.jobType && job.data.jobType !== "library-document") {
        logger.warn('⏭️  STREAMING LIBRARY WORKER skipping - wrong jobType', { 
          jobId: job.id,
          jobName: job.name,
          jobType: job.data.jobType,
          expectedJobType: 'library-document'
        });
        return;
      }

      // Also check job name for backward compatibility
      if (job.name !== "process-library-document") {
        logger.warn('⏭️  STREAMING LIBRARY WORKER skipping - wrong job name', { 
          jobId: job.id,
          jobName: job.name,
          expectedName: 'process-library-document'
        });
        return;
      }

      const start = Date.now();
      const payload = job.data;

      logger.info('🚀 STREAMING LIBRARY PROCESSOR - Processing document', {
        jobId: job.id,
        jobName: job.name,
        libraryDocumentId: payload.libraryDocumentId,
        processorType: 'STREAMING',
        features: 'resume-support, streaming-pipeline, chunked-processing'
      });

      const pipeline = new UnifiedStreamingPipeline(job.id!, payload);

      try {
        await pipeline.initialize();

        // Create embed and upsert function for library documents
        const embedAndUpsertFn = async (
          chunks: Array<{ index: number; text: string }>,
          state: any,
          progressCallback: (embedded: number, upserted: number) => Promise<void>
        ) => {
          // Embed chunks - extract just the text for embedding
          const chunkTexts = chunks.map(c => c.text);
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
            }
          );

          await progressCallback(embeddings.length, embeddings.length);

          return {
            totalEmbedded: embeddings.length,
            totalUpserted: embeddings.length,
            skipped: 0
          };
        };

        // Run the pipeline
        const result = await pipeline.process(
          payload,
          {
            documentIdentifier: payload.libraryDocumentId,
            metadata: {
              userId: payload.userId,
              teamId: payload.teamId,
              folderId: payload.folderId
            },
            onProgress: (update) => {
              job.updateProgress(update);
            }
          },
          embedAndUpsertFn,
          job.attemptsMade + 1
        );

        logger.info('Library job completed successfully', {
          jobId: job.id,
          libraryDocumentId: payload.libraryDocumentId,
          totalChunks: result.totalChunks,
          durationMs: result.durationMs,
          resumed: result.resumed
        });

        // Send success callback
        logger.info('Preparing success callback', {
          jobId: job.id,
          libraryDocumentId: payload.libraryDocumentId,
          callbackUrl: payload.callbackUrl,
          hasHmacSecret: !!payload.hmacSecret
        });

        const callbackBody = JSON.stringify({
          status: "completed",
          libraryDocumentId: payload.libraryDocumentId,
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
        logger.error('Library job failed', {
          jobId: job.id,
          libraryDocumentId: payload.libraryDocumentId,
          error: String(error)
        });

        const totalAttempts = typeof job.opts.attempts === "number" ? job.opts.attempts : 1;
        const isFinalAttempt = job.attemptsMade + 1 >= totalAttempts;
        
        logger.info('Library job attempt failed', {
          jobId: job.id,
          libraryDocumentId: payload.libraryDocumentId,
          attemptNumber: job.attemptsMade + 1,
          totalAttempts,
          isFinalAttempt,
          willRetry: !isFinalAttempt
        });

        if (isFinalAttempt) {
          logger.info('Preparing failure callback (final attempt)', {
            jobId: job.id,
            libraryDocumentId: payload.libraryDocumentId,
            attemptsMade: job.attemptsMade + 1,
            totalAttempts,
            callbackUrl: payload.callbackUrl,
            hasHmacSecret: !!payload.hmacSecret
          });

          const failureBody = JSON.stringify({
            status: "failed",
            libraryDocumentId: payload.libraryDocumentId,
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
            libraryDocumentId: payload.libraryDocumentId,
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
      name: "process-library-document",
      // Lock settings for long-running document processing
      lockDuration: Number(process.env.LOCK_DURATION_MS || 900000), // 15 minutes
      maxStalledCount: 2, // Allow job to stall twice before failing
      stalledInterval: 30000 // Check for stalled jobs every 30 seconds
    }
  );
}

