import { Storage } from "@google-cloud/storage";
import { promises as fs } from "fs";
import path from "path";
import { config } from "../config";
import { logger } from "../middleware/logging";

/**
 * Session state structure stored in GCS
 */
export interface SessionState {
  cookies?: string[];
  headers?: Record<string, string>;
  lastUpdated?: string;
  [key: string]: unknown;
}

/**
 * Manages PJN session state stored in GCS
 */
export class SessionStore {
  private storage: Storage;
  private sessionsBucket: string;
  private useLocal: boolean;
  private localBaseDir: string;

  constructor() {
    this.useLocal = config.useLocalSessionStore;
    // In ESM/tsx, __dirname is not available; use the process CWD so that
    // storage is created relative to the project root when running `pnpm dev`.
    this.localBaseDir = path.resolve(process.cwd(), "storage");

    // Only initialize GCS client when not using local storage
    this.storage = new Storage({
      projectId: config.gcsProjectId || undefined,
    });
    this.sessionsBucket = config.gcsSessionsBucket;
  }

  /**
   * Load session state for a user from GCS
   */
  async loadSession(userId: string): Promise<SessionState | null> {
    const sessionPath = this.getSessionPath(userId);

    try {
      if (this.useLocal) {
        const fullPath = path.join(this.localBaseDir, sessionPath);

        try {
          await fs.access(fullPath);
        } catch {
          logger.debug("Session file does not exist (local)", {
            userId,
            sessionPath: fullPath,
          });
          return null;
        }

        const contents = await fs.readFile(fullPath, "utf-8");
        const sessionState = JSON.parse(contents) as SessionState;

        logger.debug("Session loaded (local)", { userId, sessionPath: fullPath });
        return sessionState;
      } else {
        const bucket = this.storage.bucket(this.sessionsBucket);
        const file = bucket.file(sessionPath);

        const [exists] = await file.exists();
        if (!exists) {
          logger.debug("Session file does not exist", { userId, sessionPath });
          return null;
        }

        const [contents] = await file.download();
        const sessionState = JSON.parse(contents.toString("utf-8")) as SessionState;

        logger.debug("Session loaded", { userId, sessionPath });
        return sessionState;
      }
    } catch (error) {
      logger.error("Failed to load session", {
        userId,
        sessionPath,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Save session state for a user to GCS
   */
  async saveSession(userId: string, sessionState: SessionState): Promise<boolean> {
    const sessionPath = this.getSessionPath(userId);

    try {
      const updatedState: SessionState = {
        ...sessionState,
        lastUpdated: new Date().toISOString(),
      };
      const serialized = JSON.stringify(updatedState, null, 2);

      if (this.useLocal) {
        const fullPath = path.join(this.localBaseDir, sessionPath);
        const dir = path.dirname(fullPath);

        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(fullPath, serialized, "utf-8");

        logger.info("Session saved (local)", { userId, sessionPath: fullPath });
        return true;
      } else {
        const bucket = this.storage.bucket(this.sessionsBucket);
        const file = bucket.file(sessionPath);

        await file.save(serialized, {
          contentType: "application/json",
          metadata: {
            cacheControl: "no-cache",
          },
        });

        logger.info("Session saved", { userId, sessionPath });
        return true;
      }
    } catch (error) {
      logger.error("Failed to save session", {
        userId,
        sessionPath,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Delete session state for a user
   */
  async deleteSession(userId: string): Promise<boolean> {
    const sessionPath = this.getSessionPath(userId);

    try {
      if (this.useLocal) {
        const fullPath = path.join(this.localBaseDir, sessionPath);

        try {
          await fs.unlink(fullPath);
          logger.info("Session deleted (local)", { userId, sessionPath: fullPath });
          return true;
        } catch (error) {
          // If the file does not exist, treat as already deleted
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return true;
          }
          throw error;
        }
      } else {
        const bucket = this.storage.bucket(this.sessionsBucket);
        const file = bucket.file(sessionPath);

        const [exists] = await file.exists();
        if (!exists) {
          return true; // Already deleted
        }

        await file.delete();
        logger.info("Session deleted", { userId, sessionPath });
        return true;
      }
    } catch (error) {
      logger.error("Failed to delete session", {
        userId,
        sessionPath,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get GCS path for a user's session file
   */
  private getSessionPath(userId: string): string {
    return `${userId}/${config.sessionFileName}`;
  }
}

