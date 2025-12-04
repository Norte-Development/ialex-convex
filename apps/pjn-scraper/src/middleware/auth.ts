import { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { logger } from "./logging";

/**
 * Middleware to authenticate requests from Convex
 * Uses a simple shared secret header
 */
export function serviceAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip auth for health endpoint
  if (req.path === "/health") {
    return next();
  }

  const authHeader = req.headers["x-service-auth"];
  const expectedSecret = config.serviceAuthSecret;

  // Require secret in all non-test environments
  if (config.nodeEnv !== "test" && !expectedSecret) {
    logger.error("Service auth secret is not configured");
    res.status(500).json({
      error: "Server misconfigured",
      message: "Service authentication is not properly configured",
    });
    return;
  }

  // In test mode, skip auth if no secret is configured
  if (config.nodeEnv === "test" && !expectedSecret) {
    return next();
  }

  if (!authHeader || authHeader !== expectedSecret) {
    logger.warn("Unauthorized service request", {
      path: req.path,
      ip: req.ip,
      hasAuthHeader: !!authHeader,
    });
    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or missing service authentication",
    });
    return;
  }

  next();
}

