import { Router, Request, Response } from "express";
import { SessionStore } from "../lib/sessionStore";
import { reauthRequestSchema } from "../types/api";
import { performPjnLogin } from "../lib/pjnAuth";
import { logger } from "../middleware/logging";

const router: Router = Router();
const sessionStore = new SessionStore();

export interface ReauthDependencies {
  sessionStore: SessionStore;
  performLogin: typeof performPjnLogin;
}

/**
 * Core handler for POST /reauth.
 * Extracted for unit testing with injectable dependencies.
 */
export async function reauthHandler(
  req: Request,
  res: Response,
  deps: ReauthDependencies
): Promise<void> {
  const { sessionStore: depSessionStore, performLogin } = deps;
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Validate request
    const parsed = reauthRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn("Invalid reauth request", {
        requestId,
        errors: parsed.error.issues,
      });
      res.status(400).json({
        status: "ERROR",
        error: "Invalid request",
        code: "VALIDATION_ERROR",
        details: parsed.error.issues,
      });
      return;
    }

    const { userId, username, password } = parsed.data;

    logger.info("Starting reauth", {
      requestId,
      userId,
      username,
    });

    // Perform real PJN SSO login using Playwright and capture session cookies
    // and tokens (performPjnLogin now also attempts to fetch and attach tokens).
    const sessionState = await performLogin({ username, password });

    const saved = await depSessionStore.saveSession(userId, sessionState);

    if (!saved) {
      logger.error("Failed to save session after reauth", { requestId, userId });
      res.status(500).json({
        status: "ERROR",
        error: "Failed to save session",
      });
      return;
    }

    logger.info("Reauth completed", {
      requestId,
      userId,
      sessionSaved: saved,
    });

    res.json({
      status: "OK",
      sessionSaved: saved,
    });
  } catch (error) {
    logger.error("Reauth failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Check if it's an auth failure (specifically "Invalid credentials" from pjnAuth.ts)
    if (error instanceof Error && error.message.toLowerCase().includes("invalid credentials")) {
      res.json({
        status: "AUTH_FAILED",
        reason: error.message,
      });
      return;
    }

    res.status(500).json({
      status: "ERROR",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * POST /reauth
 * Re-authenticate a user with PJN and save session
 */
router.post("/reauth", async (req: Request, res: Response) => {
  await reauthHandler(req, res, {
    sessionStore,
    performLogin: performPjnLogin,
  });
});

export default router;

