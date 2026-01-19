import "dotenv/config";
import express, { Request, Response } from "express";
import { config, validateConfig } from "./config";
import { logger } from "./middleware/logging";
import { serviceAuthMiddleware } from "./middleware/auth";
import healthRouter from "./routes/health";
import eventsRouter from "./routes/events";
import reauthRouter from "./routes/reauth";
import caseHistoryRouter from "./routes/caseHistory";

// Validate configuration on startup
try {
  validateConfig();
} catch (error) {
  logger.error("Configuration validation failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
}

const app = express();

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(serviceAuthMiddleware);

// Routes
app.use("/", healthRouter);
app.use("/", eventsRouter);
app.use("/", reauthRouter);
app.use("/", caseHistoryRouter);

// Error handler
app.use((err: unknown, req: Request, res: Response, _next: unknown) => {
  logger.error("Unhandled error", {
    path: req.path,
    method: req.method,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  res.status(500).json({
    error: "Internal server error",
    message: err instanceof Error ? err.message : "Unknown error",
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: "Not found",
    path: req.path,
  });
});

const port = config.port;
const host = "0.0.0.0"; // Required for Cloud Run

// Start server
app.listen(port, host, () => {
  logger.info(`✅ PJN Scraper server listening on ${host}:${port}`);
  logger.info("Server is ready to accept requests");
  logger.info("Configuration", {
    pjnApiBaseUrl: config.pjnApiBaseUrl,
    gcsSessionsBucket: config.gcsSessionsBucket,
    gcsDocumentsBucket: config.gcsDocumentsBucket,
    documentProcessorUrl: config.documentProcessorUrl,
  });
});

