import { Router, Request, Response } from "express";
import { Storage } from "@google-cloud/storage";
import { config } from "../config";
import { logger } from "../middleware/logging";

const router: Router = Router();
const credentials = config.gcsSignerClientEmail && config.gcsSignerPrivateKey
  ? {
      client_email: config.gcsSignerClientEmail,
      private_key: config.gcsSignerPrivateKey.replace(/\\n/g, "\n"),
    }
  : undefined;

const storage = new Storage({
  credentials,
});

/**
 * GET /health
 * Health check endpoint
 */
router.get("/health", async (_req: Request, res: Response) => {
  const checks: Record<string, boolean | string> = {
    config: true,
    timestamp: new Date().toISOString(),
  };

  // Check GCS connectivity
  try {
    const bucket = storage.bucket(config.gcsSessionsBucket);
    await bucket.getMetadata();
    checks.gcsSessionsBucket = true;
  } catch (error) {
    checks.gcsSessionsBucket = false;
    logger.warn("GCS sessions bucket check failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const bucket = storage.bucket(config.gcsDocumentsBucket);
    await bucket.getMetadata();
    checks.gcsDocumentsBucket = true;
  } catch (error) {
    checks.gcsDocumentsBucket = false;
    logger.warn("GCS documents bucket check failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const allHealthy = Object.values(checks).every((v) => v === true || typeof v === "string");

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? "ok" : "degraded",
    checks,
    version: process.env.npm_package_version || "0.1.0",
  });
});

export default router;

