import { v } from "convex/values";
import { action } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import { PLAN_LIMITS } from "../../billing/planLimits";

/**
 * Generates a Google Cloud Storage V4 signed URL for client-side uploads.
 *
 * Auth: requires an authenticated user.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.caseId - The case ID the uploaded file will be associated with
 * @param {string} args.originalFileName - Original filename; used to construct the object path
 * @param {string} args.mimeType - MIME type to be enforced by the signed request
 * @param {number} args.fileSize - Size in bytes (informational for clients; not enforced server-side)
 * @returns {Promise<{url: string, bucket: string, object: string, contentType: string, expiresAt: number}>}
 * A payload containing the signed upload URL and target object metadata.
 * @throws {Error} If the user is unauthenticated or GCS configuration is missing
 */
export const generateUploadUrl = action({
  args: {
    caseId: v.id("cases"),
    originalFileName: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    url: string;
    bucket: string;
    object: string;
    contentType: string;
    expiresAt: number;
  }> => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Get current user from database
    const currentUser = await ctx.runQuery(
      api.functions.users.getCurrentUser,
      {},
    );

    if (!currentUser) {
      throw new Error("User not found");
    }

    // Check storage limits before generating upload URL
    const userPlan = await ctx.runQuery(api.billing.features.getUserPlan, {
      userId: currentUser._id,
    });

    const usage = await ctx.runQuery(api.billing.features.getUsageLimits, {
      entityId: currentUser._id,
    });

    // If no usage record exists yet, it will be created in createDocument
    // For now, assume 0 usage to allow first upload
    const storageUsedBytes = usage?.storageUsedBytes || 0;

    const limits = PLAN_LIMITS[
      userPlan
    ] as (typeof PLAN_LIMITS)[keyof typeof PLAN_LIMITS];

    // Check storage limit (convert GB to bytes)
    const storageLimitBytes = limits.storageGB * 1024 * 1024 * 1024;
    const newStorageTotal = storageUsedBytes + args.fileSize;

    if (newStorageTotal > storageLimitBytes) {
      const availableGB =
        (storageLimitBytes - storageUsedBytes) / (1024 * 1024 * 1024);
      throw new Error(
        `No tienes suficiente espacio de almacenamiento. Disponible: ${availableGB.toFixed(2)}GB. Actualiza a Premium para más almacenamiento.`,
      );
    }

    const bucket = process.env.GCS_BUCKET as string;
    const ttl = Number(process.env.GCS_UPLOAD_URL_TTL_SECONDS || 900);

    if (!bucket) {
      throw new Error("Missing GCS bucket configuration");
    }

    const timestamp = Date.now();
    const objectPath = `cases/${args.caseId}/documents/${crypto.randomUUID()}/${timestamp}-${args.originalFileName}`;

    const {
      url,
      bucket: returnedBucket,
      object,
      expiresSeconds,
    }: {
      url: string;
      bucket: string;
      object: string;
      expiresSeconds: number;
    } = await ctx.runAction(internal.utils.gcs.generateGcsV4SignedUrlAction, {
      bucket,
      object: objectPath,
      expiresSeconds: ttl,
      method: "PUT",
      contentType: args.mimeType,
    });

    return {
      url,
      bucket: returnedBucket,
      object,
      contentType: args.mimeType,
      expiresAt: Date.now() + expiresSeconds * 1000,
    };
  },
});

/**
 * Gets a signed URL for downloading a document from Convex storage.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.documentId - The ID of the document to get URL for
 * @returns {Promise<string|null>} The signed URL or null if document not found
 * @throws {Error} When not authenticated or lacking case access
 *
 * @description This function generates a signed URL for downloading a document
 * from Convex storage. The user must have read access to the case that the
 * document belongs to.
 */
export const getDocumentUrl = action({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args): Promise<string | null> => {
    // Fetch document via query to leverage DB and permission checks
    const document = await ctx.runQuery(
      api.functions.documents.getDocument,
      {
        documentId: args.documentId,
      },
    );
    if (!document) return null;

    if (
      document.storageBackend === "gcs" &&
      document.gcsBucket &&
      document.gcsObject
    ) {
      const bucket = document.gcsBucket as string;
      const object = document.gcsObject as string;
      const ttl = Number(process.env.GCS_DOWNLOAD_URL_TTL_SECONDS || 900);
      if (!bucket || !object)
        throw new Error("Missing GCS signing configuration");

      const { url: signedUrl }: { url: string } = await ctx.runAction(
        internal.utils.gcs.generateGcsV4SignedUrlAction,
        { bucket, object, expiresSeconds: ttl, method: "GET" },
      );
      return signedUrl;
    }

    if (document.fileId) {
      const legacyUrl = await ctx.storage.getUrl(document.fileId);
      return legacyUrl;
    }
    return null;
  },
});

