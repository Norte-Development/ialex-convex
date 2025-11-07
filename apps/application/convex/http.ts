import { httpAction } from "./_generated/server";
import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { stripe } from "./stripe";

const http = httpRouter();

stripe.addHttpRoutes(http);

// HMAC verification using Web Crypto API (available in HTTP actions)
async function verifyHmac(
  message: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signatureBuffer = new Uint8Array(
      signature.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
    );
    const messageBuffer = encoder.encode(message);

    const expectedSignature = await crypto.subtle.sign(
      "HMAC",
      key,
      messageBuffer,
    );
    const expectedSignatureHex = Array.from(new Uint8Array(expectedSignature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return signature === expectedSignatureHex;
  } catch (error) {
    console.error("HMAC verification failed:", error);
    return false;
  }
}

// Helper function to categorize errors
function categorizeError(error: string): {
  errorType: string;
  recoverable: boolean;
} {
  const lowerError = error.toLowerCase();

  if (
    lowerError.includes("too large") ||
    lowerError.includes("file size") ||
    lowerError.includes("exceeds limit")
  ) {
    return { errorType: "file_too_large", recoverable: false };
  }
  if (
    lowerError.includes("unsupported") ||
    lowerError.includes("invalid format") ||
    lowerError.includes("mime type")
  ) {
    return { errorType: "unsupported_format", recoverable: false };
  }
  if (lowerError.includes("ocr") || lowerError.includes("mistral")) {
    return { errorType: "ocr_failed", recoverable: true };
  }
  if (lowerError.includes("timeout") || lowerError.includes("timed out")) {
    return { errorType: "timeout", recoverable: true };
  }
  if (
    lowerError.includes("network") ||
    lowerError.includes("connection") ||
    lowerError.includes("econnreset")
  ) {
    return { errorType: "network_error", recoverable: true };
  }
  if (lowerError.includes("quota") || lowerError.includes("rate limit")) {
    return { errorType: "quota_exceeded", recoverable: true };
  }

  return { errorType: "unknown_error", recoverable: true };
}

http.route({
  path: "/webhooks/document-progress",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const hmacSecret = process.env.HMAC_SECRET;
    const signature = req.headers.get("x-signature") || "";
    const bodyText = await req.text();

    if (hmacSecret && signature) {
      const isValid = await verifyHmac(bodyText, signature, hmacSecret);
      if (!isValid) {
        return new Response("invalid signature", { status: 401 });
      }
    }

    let payload: any;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return new Response("invalid json", { status: 400 });
    }

    const documentId = payload.documentId;
    const phase = payload.phase;
    const progress = payload.progress;

    if (!documentId) {
      return new Response("missing documentId", { status: 400 });
    }

    await ctx.runMutation(
      internal.functions.documentProcessing.updateProcessingProgress,
      {
        documentId,
        phase,
        progress,
      },
    );

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/webhooks/library-document-progress",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const hmacSecret = process.env.HMAC_SECRET;
    const signature = req.headers.get("x-signature") || "";
    const bodyText = await req.text();

    if (hmacSecret && signature) {
      const isValid = await verifyHmac(bodyText, signature, hmacSecret);
      if (!isValid) {
        return new Response("invalid signature", { status: 401 });
      }
    }

    let payload: any;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return new Response("invalid json", { status: 400 });
    }

    const libraryDocumentId = payload.libraryDocumentId;
    const phase = payload.phase;
    const progress = payload.progress;

    if (!libraryDocumentId) {
      return new Response("missing libraryDocumentId", { status: 400 });
    }

    await ctx.runMutation(
      internal.functions.libraryDocumentProcessing
        .updateLibraryProcessingProgress,
      {
        libraryDocumentId,
        phase,
        progress,
      },
    );

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/webhooks/document-processed",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const hmacSecret = process.env.HMAC_SECRET;
    const signature = req.headers.get("x-signature") || "";
    const bodyText = await req.text();

    if (hmacSecret && signature) {
      const isValid = await verifyHmac(bodyText, signature, hmacSecret);
      if (!isValid) {
        return new Response("invalid signature", { status: 401 });
      }
    }

    let payload: any;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return new Response("invalid json", { status: 400 });
    }
    console.log("payload", payload);
    const documentId = payload.documentId;
    const status = payload.status;
    const totalChunks = payload.totalChunks as number | undefined;
    const error = payload.error as string | undefined;
    const method = payload.method as string | undefined;
    const resumed = payload.resumed as boolean | undefined;
    const durationMs = payload.durationMs as number | undefined;

    if (!documentId || !status) {
      return new Response("missing fields", { status: 400 });
    }

    // Categorize error if present
    let errorType: string | undefined;
    let errorRecoverable: boolean | undefined;
    if (error && status === "failed") {
      const categorized = categorizeError(error);
      errorType = categorized.errorType;
      errorRecoverable = categorized.recoverable;
    }

    await ctx.runMutation(
      internal.functions.documentProcessing.updateDocumentProcessingStatus,
      {
        documentId,
        status,
        processingCompletedAt: Date.now(),
        processingError: error,
        totalChunks,
        processingMethod: method,
        wasResumed: resumed,
        processingDurationMs: durationMs,
        processingErrorType: errorType,
        processingErrorRecoverable: errorRecoverable,
      },
    );

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/webhooks/library-document-processed",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const hmacSecret = process.env.HMAC_SECRET;
    const signature = req.headers.get("x-signature") || "";
    const bodyText = await req.text();

    if (hmacSecret && signature) {
      const isValid = await verifyHmac(bodyText, signature, hmacSecret);
      if (!isValid) {
        return new Response("invalid signature", { status: 401 });
      }
    }

    let payload: any;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return new Response("invalid json", { status: 400 });
    }

    const libraryDocumentId = payload.libraryDocumentId;
    const status = payload.status;
    const totalChunks = payload.totalChunks as number | undefined;
    const error = payload.error as string | undefined;
    const method = payload.method as string | undefined;
    const resumed = payload.resumed as boolean | undefined;
    const durationMs = payload.durationMs as number | undefined;

    if (!libraryDocumentId || !status) {
      return new Response("missing fields", { status: 400 });
    }

    // Categorize error if present
    let errorType: string | undefined;
    let errorRecoverable: boolean | undefined;
    if (error && status === "failed") {
      const categorized = categorizeError(error);
      errorType = categorized.errorType;
      errorRecoverable = categorized.recoverable;
    }

    await ctx.runMutation(
      internal.functions.libraryDocumentProcessing
        .updateLibraryDocumentProcessingStatus,
      {
        libraryDocumentId,
        status,
        processingCompletedAt: Date.now(),
        processingError: error,
        totalChunks,
        processingMethod: method,
        wasResumed: resumed,
        processingDurationMs: durationMs,
        processingErrorType: errorType,
        processingErrorRecoverable: errorRecoverable,
      },
    );

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/api/document-processor/extracted-text",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const signature = req.headers.get("X-Convex-Signature") || "";
    const bodyText = await req.text();

    // Verify HMAC if secret is configured
    const hmacSecret = process.env.HMAC_SECRET;
    if (hmacSecret && signature) {
      const isValid = await verifyHmac(bodyText, signature, hmacSecret);
      if (!isValid) {
        return new Response("invalid signature", { status: 401 });
      }
    }

    let payload: {
      documentId: string;
      extractedText: string;
      extractedTextLength: number;
      transcriptionConfidence?: number;
      transcriptionDuration?: number;
      transcriptionModel?: string;
    };

    try {
      payload = JSON.parse(bodyText);
    } catch {
      return new Response("invalid json", { status: 400 });
    }

    if (!payload.documentId || !payload.extractedText) {
      return new Response("missing required fields", { status: 400 });
    }

    try {
      await ctx.runMutation(
        internal.functions.documentProcessing.updateExtractedText,
        {
          documentId: payload.documentId as Id<"documents">,
          extractedText: payload.extractedText,
          extractedTextLength: payload.extractedTextLength,
          transcriptionConfidence: payload.transcriptionConfidence,
          transcriptionDuration: payload.transcriptionDuration,
          transcriptionModel: payload.transcriptionModel,
        },
      );

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Failed to update extracted text:", error);
      return new Response("internal server error", { status: 500 });
    }
  }),
});

// HTTP route to receive extracted text (transcriptions) for library documents
http.route({
  path: "/api/document-processor/library-extracted-text",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const signature = req.headers.get("X-Convex-Signature") || "";
    const bodyText = await req.text();

    // Verify HMAC if secret is configured
    const hmacSecret = process.env.HMAC_SECRET;
    if (hmacSecret && signature) {
      const isValid = await verifyHmac(bodyText, signature, hmacSecret);
      if (!isValid) {
        return new Response("invalid signature", { status: 401 });
      }
    }

    let payload: {
      libraryDocumentId: string;
      extractedText: string;
      extractedTextLength: number;
      transcriptionConfidence?: number;
      transcriptionDuration?: number;
      transcriptionModel?: string;
    };

    try {
      payload = JSON.parse(bodyText);
    } catch {
      return new Response("invalid json", { status: 400 });
    }

    if (!payload.libraryDocumentId || !payload.extractedText) {
      return new Response("missing required fields", { status: 400 });
    }

    try {
      await ctx.runMutation(
        internal.functions.libraryDocumentProcessing.updateLibraryExtractedText,
        {
          libraryDocumentId:
            payload.libraryDocumentId as Id<"libraryDocuments">,
          extractedText: payload.extractedText,
          extractedTextLength: payload.extractedTextLength,
          transcriptionConfidence: payload.transcriptionConfidence,
          transcriptionDuration: payload.transcriptionDuration,
          transcriptionModel: payload.transcriptionModel,
        },
      );

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Failed to update library extracted text:", error);
      return new Response("internal server error", { status: 500 });
    }
  }),
});

// Optional: HTTP route to mint a signed GET for testing/debug (not required by app as getDocumentUrl query handles this)
http.route({
  path: "/signed-download",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const { bucket, object, expiresSeconds } = await req.json();
      if (!bucket || !object) {
        return new Response("missing params", { status: 400 });
      }
      const url = await ctx.runAction(
        internal.utils.gcs.generateGcsV4SignedUrlAction,
        {
          method: "GET",
          bucket,
          object,
          expiresSeconds: Number(expiresSeconds || 900),
        },
      );

      return new Response(JSON.stringify({ url: url.url }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response("bad request", { status: 400 });
    }
  }),
});

export default http;
