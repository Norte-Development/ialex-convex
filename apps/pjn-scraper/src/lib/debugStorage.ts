import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { logger } from "../middleware/logging";

/**
 * Configuration for debug storage
 */
export interface DebugStorageConfig {
  /** Base directory for storing debug files. Defaults to ./storage/debug */
  baseDir?: string;
  /** Whether debug storage is enabled. Defaults to true in development */
  enabled?: boolean;
}

/**
 * Debug storage manager for saving HTML files and scraping results
 * for debugging and fine-tuning the scraper.
 */
export class DebugStorage {
  private baseDir: string;
  private enabled: boolean;
  private sessionId: string;
  private sessionDir: string;

  constructor(config: DebugStorageConfig = {}) {
    this.baseDir = config.baseDir || "./storage/debug";
    this.enabled = config.enabled ?? (process.env.NODE_ENV !== "production");
    this.sessionId = this.generateSessionId();
    this.sessionDir = join(this.baseDir, this.sessionId);

    if (this.enabled) {
      this.ensureDirectory(this.sessionDir);
      logger.info("Debug storage initialized", {
        sessionId: this.sessionId,
        sessionDir: this.sessionDir,
      });
    }
  }

  /**
   * Generate a unique session ID based on timestamp
   */
  private generateSessionId(): string {
    const now = new Date();
    const date = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const time = now.toISOString().split("T")[1].replace(/[:.]/g, "-").slice(0, 8); // HH-MM-SS
    const random = Math.random().toString(36).substring(2, 6);
    return `${date}_${time}_${random}`;
  }

  /**
   * Ensure a directory exists, creating it if necessary
   */
  private ensureDirectory(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Get the session directory path
   */
  getSessionDir(): string {
    return this.sessionDir;
  }

  /**
   * Get the session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Save an HTML file to the debug storage
   */
  saveHtml(filename: string, html: string, metadata?: Record<string, unknown>): string | null {
    if (!this.enabled) return null;

    try {
      const fullPath = join(this.sessionDir, `${filename}.html`);
      writeFileSync(fullPath, html, "utf8");

      // Save metadata alongside if provided
      if (metadata) {
        const metadataPath = join(this.sessionDir, `${filename}.meta.json`);
        writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf8");
      }

      logger.debug("Saved HTML debug file", {
        sessionId: this.sessionId,
        filename,
        size: html.length,
        path: fullPath,
      });

      return fullPath;
    } catch (error) {
      logger.warn("Failed to save HTML debug file", {
        sessionId: this.sessionId,
        filename,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Save JSON results to the debug storage
   */
  saveJson<T>(filename: string, data: T, metadata?: Record<string, unknown>): string | null {
    if (!this.enabled) return null;

    try {
      const fullPath = join(this.sessionDir, `${filename}.json`);
      
      const output = {
        _savedAt: new Date().toISOString(),
        _sessionId: this.sessionId,
        ...(metadata && { _metadata: metadata }),
        data,
      };

      writeFileSync(fullPath, JSON.stringify(output, null, 2), "utf8");

      logger.debug("Saved JSON debug file", {
        sessionId: this.sessionId,
        filename,
        recordCount: Array.isArray(data) ? data.length : 1,
        path: fullPath,
      });

      return fullPath;
    } catch (error) {
      logger.warn("Failed to save JSON debug file", {
        sessionId: this.sessionId,
        filename,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Save a complete scraping session with all its components
   */
  saveScrapeSession(
    fre: string,
    components: {
      searchHtml?: string;
      searchResults?: unknown;
      expedienteHtml?: string;
      actuaciones?: unknown;
      docDigitalesHtml?: string;
      docDigitales?: unknown;
      intervinientesHtml?: string;
      intervinientes?: unknown;
      recursosHtml?: string;
      recursos?: unknown;
      vinculadosHtml?: string;
      vinculados?: unknown;
      finalResult?: unknown;
      error?: string;
    }
  ): void {
    if (!this.enabled) return;

    const safeFre = fre.replace(/[/\\:]/g, "_");
    const metadata = { fre, timestamp: new Date().toISOString() };

    // Save all HTML files
    if (components.searchHtml) {
      this.saveHtml(`${safeFre}_01_search`, components.searchHtml, metadata);
    }
    if (components.expedienteHtml) {
      this.saveHtml(`${safeFre}_02_expediente`, components.expedienteHtml, metadata);
    }
    if (components.docDigitalesHtml) {
      this.saveHtml(`${safeFre}_03_doc_digitales`, components.docDigitalesHtml, metadata);
    }
    if (components.intervinientesHtml) {
      this.saveHtml(`${safeFre}_04_intervinientes`, components.intervinientesHtml, metadata);
    }
    if (components.recursosHtml) {
      this.saveHtml(`${safeFre}_05_recursos`, components.recursosHtml, metadata);
    }
    if (components.vinculadosHtml) {
      this.saveHtml(`${safeFre}_06_vinculados`, components.vinculadosHtml, metadata);
    }

    // Save all parsed results
    if (components.searchResults) {
      this.saveJson(`${safeFre}_01_search_results`, components.searchResults, metadata);
    }
    if (components.actuaciones) {
      this.saveJson(`${safeFre}_02_actuaciones`, components.actuaciones, metadata);
    }
    if (components.docDigitales) {
      this.saveJson(`${safeFre}_03_doc_digitales`, components.docDigitales, metadata);
    }
    if (components.intervinientes) {
      this.saveJson(`${safeFre}_04_intervinientes`, components.intervinientes, metadata);
    }
    if (components.recursos) {
      this.saveJson(`${safeFre}_05_recursos`, components.recursos, metadata);
    }
    if (components.vinculados) {
      this.saveJson(`${safeFre}_06_vinculados`, components.vinculados, metadata);
    }
    if (components.finalResult) {
      this.saveJson(`${safeFre}_final_result`, components.finalResult, metadata);
    }
    if (components.error) {
      this.saveJson(`${safeFre}_error`, { error: components.error }, metadata);
    }

    logger.info("Saved complete scrape session", {
      sessionId: this.sessionId,
      fre,
      sessionDir: this.sessionDir,
    });
  }
}

// Singleton instance for convenience
let defaultInstance: DebugStorage | null = null;

/**
 * Get the default debug storage instance
 */
export function getDebugStorage(): DebugStorage {
  if (!defaultInstance) {
    defaultInstance = new DebugStorage();
  }
  return defaultInstance;
}

/**
 * Create a new debug storage instance for a specific scraping session
 */
export function createDebugSession(config?: DebugStorageConfig): DebugStorage {
  return new DebugStorage(config);
}
