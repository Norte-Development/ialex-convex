import "dotenv/config";
import express, { Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { queue } from "./services/queueService";
import { initQdrant } from "./services/qdrantService";
import { logger } from "./middleware/logging";
import { processDocumentJob } from "./jobs/processDocumentJob";

const app = express();
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Ingestion endpoint
const ingestSchema = z.object({
  signedUrl: z.string().url(),
  contentType: z.string().optional(),
  // Backwards compatibility: accept tenantId but prefer createdBy
  tenantId: z.string(),
  createdBy: z.string().optional(),
  caseId: z.string(),
  documentId: z.string(),
  documentType: z.string().optional(),
  originalFileName: z.string().optional(),
  callbackUrl: z.string().url(),
  hmacSecret: z.string().optional(),
  chunking: z
    .object({
      maxTokens: z.number().min(64).max(2048).default(400),
      overlapRatio: z.number().min(0).max(0.5).default(0.15),
      pageWindow: z.number().min(1).max(100).default(50),
    })
    .optional(),
});

app.post("/process-document", async (req: Request, res: Response) => {
  try {
    const parsed = ingestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const job = await queue.add("process-document", parsed.data, {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    });
    logger.info("queued document", { jobId: job.id, documentId: parsed.data.documentId });
    res.json({ jobId: job.id });
  } catch (error) {
    logger.error("Failed to queue document", { error: String(error) });
    res.status(500).json({ error: "Failed to queue document processing" });
  }
});

// Optional: simple polling status
app.get("/status/:id", async (req: Request, res: Response) => {
  try {
    const job = await queue.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: "not found" });
    const state = await job.getState();
    const progress = job.progress();
    res.json({ state, progress, attemptsMade: job.attemptsMade });
  } catch (error) {
    logger.error("Failed to get job status", { error: String(error) });
    res.status(500).json({ error: "Failed to get job status" });
  }
});

// HMAC helper for callbacks
function signBody(body: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

// Worker registration
try {
  processDocumentJob(queue);
  logger.info("Document processing worker registered successfully");
} catch (error) {
  logger.error("Failed to register document processing worker", { error: String(error) });
}

const port = process.env.PORT || 4001;
app.listen(port, async () => {
  try {
    await initQdrant();
    logger.info("Qdrant initialized");
  } catch (e) {
    logger.error("Qdrant init failed", { error: String(e) });
  }
  logger.info(`document-processor listening on ${port}`);
});


