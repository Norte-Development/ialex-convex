import { Storage } from "@google-cloud/storage";
import { config } from "../config";
import { logger } from "../middleware/logging";

/**
 * GCS storage operations for PJN documents
 */
export class GcsStorage {
  private storage: Storage;
  private documentsBucket: string;

  constructor() {
    const credentials = config.gcsSignerClientEmail && config.gcsSignerPrivateKey
      ? {
          client_email: config.gcsSignerClientEmail,
          private_key: config.gcsSignerPrivateKey.replace(/\\n/g, "\n"),
        }
      : undefined;

    this.storage = new Storage({
      credentials,
    });
    this.documentsBucket = config.gcsDocumentsBucket;
  }

  /**
   * Upload a PDF to GCS
   */
  async uploadPdf(
    userId: string,
    eventId: string,
    pdfBuffer: Buffer
  ): Promise<string> {
    const gcsPath = `pjn/${userId}/${eventId}.pdf`;
    const bucket = this.storage.bucket(this.documentsBucket);
    const file = bucket.file(gcsPath);

    try {
      await file.save(pdfBuffer, {
        contentType: "application/pdf",
        metadata: {
          eventId,
          userId,
          sourceSystem: "PJN-Portal",
        },
      });

      const gcsUrl = `gs://${this.documentsBucket}/${gcsPath}`;
      logger.info("PDF uploaded to GCS", {
        userId,
        eventId,
        gcsPath,
        size: pdfBuffer.length,
      });

      return gcsUrl;
    } catch (error) {
      logger.error("Failed to upload PDF to GCS", {
        userId,
        eventId,
        gcsPath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check if a PDF already exists in GCS (for idempotency)
   */
  async pdfExists(userId: string, eventId: string): Promise<boolean> {
    const gcsPath = `pjn/${userId}/${eventId}.pdf`;
    const bucket = this.storage.bucket(this.documentsBucket);
    const file = bucket.file(gcsPath);

    try {
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      logger.warn("Failed to check PDF existence", {
        userId,
        eventId,
        gcsPath,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}

