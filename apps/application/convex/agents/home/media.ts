'use node';

import { action } from "../../_generated/server";
import { v } from "convex/values";
import { Storage } from "@google-cloud/storage";

const storageClient = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: {
    client_email: process.env.GCS_SIGNER_CLIENT_EMAIL,
    private_key: process.env.GCS_SIGNER_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
});

export const MAX_HOME_MEDIA_SIZE_BYTES = Number(
  process.env.HOME_MEDIA_MAX_SIZE_BYTES ?? 10 * 1024 * 1024,
);
const UPLOAD_URL_TTL_MS = 15 * 60 * 1000;

const sanitizeFilename = (filename: string): string => {
  const trimmed = filename.trim().replace(/\s+/g, "-");
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
};

export const getHomeMediaUploadUrl = action({
  args: {
    filename: v.string(),
    contentType: v.string(),
    kind: v.union(v.literal("image"), v.literal("pdf")),
  },
  returns: v.object({
    uploadUrl: v.string(),
    publicUrl: v.string(),
    gcsBucket: v.string(),
    gcsObject: v.string(),
    contentType: v.string(),
    filename: v.string(),
    maxSize: v.number(),
    kind: v.union(v.literal("image"), v.literal("pdf")),
  }),
  handler: async (ctx, args) => {
    const bucketName = process.env.HOME_GCS_BUCKET || process.env.WHATSAPP_GCS_BUCKET;
    if (!bucketName) {
      throw new Error(
        "HOME_GCS_BUCKET o GCS_BUCKET no están configurados para cargas del Home Agent",
      );
    }

    const { filename, contentType, kind } = args;
    const isImage = kind === "image";

    if (isImage && !contentType.startsWith("image/")) {
      throw new Error(
        `El tipo de contenido ${contentType} no es válido para una imagen`,
      );
    }

    if (!isImage && contentType !== "application/pdf") {
      throw new Error(
        `Solo se aceptan PDFs con content-type application/pdf (recibido: ${contentType})`,
      );
    }

    const safeFilename = sanitizeFilename(filename);
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).slice(2, 10);
    const objectPath = `home-media/${timestamp}-${randomSuffix}-${safeFilename}`;

    const bucket = storageClient.bucket(bucketName);
    const file = bucket.file(objectPath);

    const expires = Date.now() + UPLOAD_URL_TTL_MS;

    const [uploadUrl] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires,
      contentType,
    });

    const encodedObject = encodeURIComponent(objectPath).replace(/%2F/g, "/");
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${encodedObject}`;

    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/0e2edc26-cd1d-46dd-a120-43a13a299d5f", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "pre-fix-1",
        hypothesisId: "H1",
        location: "convex/agents/home/media.ts:getHomeMediaUploadUrl",
        message: "Generated upload + public URL for home media",
        data: {
          kind,
          originalFilename: filename,
          safeFilename,
          bucketName,
          objectPath,
          publicUrlPreview: publicUrl.slice(0, 120),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log

    return {
      uploadUrl,
      publicUrl,
      gcsBucket: bucketName,
      gcsObject: objectPath,
      contentType,
      filename,
      maxSize: MAX_HOME_MEDIA_SIZE_BYTES,
      kind,
    };
  },
});
