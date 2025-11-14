import { httpAction } from "./_generated/server";
import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { stripe } from "./stripe";
import Stripe from "stripe";

const http = httpRouter();

// Stripe webhooks manejados automáticamente por @raideno/convex-stripe
stripe.addHttpRoutes(http);

// Webhook personalizado para enviar emails cuando se activa una suscripción
http.route({
  path: "/webhooks/stripe-subscription-emails",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const stripeSignature = request.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_KEY_EMAILS;

    if (!stripeSignature || !webhookSecret) {
      console.error("Missing stripe signature or webhook secret");
      return new Response("Webhook Error: Missing signature", { status: 400 });
    }

    let event: Stripe.Event;
    const body = await request.text();

    try {
      // Verificar la firma del webhook de Stripe
      const stripeSDK = new Stripe(process.env.STRIPE_SECRET_KEY!);
      event = await stripeSDK.webhooks.constructEventAsync(
        body,
        stripeSignature,
        webhookSecret,
      );
    } catch (err: any) {
      console.error(
        `⚠️  Webhook signature verification failed: ${err.message}`,
      );
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    console.log(`✅ Stripe webhook received: ${event.type}`);

    // Manejar eventos de suscripción
    try {
      if (
        event.type === "customer.subscription.created" ||
        event.type === "customer.subscription.updated"
      ) {
        const subscription = event.data.object as Stripe.Subscription;

        // Solo procesar si la suscripción está activa
        if (subscription.status === "active") {
          console.log(
            `📧 Processing subscription activation for: ${subscription.id}`,
          );

          await ctx.scheduler.runAfter(
            5000, // 5 segundos
            internal.billing.webhookHandlers.handleSubscriptionActivated,
            {
              subscriptionId: subscription.id,
              customerId:
                typeof subscription.customer === "string"
                  ? subscription.customer
                  : subscription.customer.id,
              status: subscription.status,
            },
          );

          console.log(
            `⏰ Scheduled email send for subscription: ${subscription.id}`,
          );
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error: any) {
      console.error(`❌ Error processing webhook: ${error.message}`);
      return new Response(`Webhook Error: ${error.message}`, { status: 500 });
    }
  }),
});

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

// Twilio WhatsApp webhook
http.route({
  path: "/webhooks/twilio/whatsapp",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      // Twilio sends form-encoded data
      const formData = await req.formData();
      
      // Extract webhook parameters
      const messageSid = formData.get("MessageSid") as string;
      const from = formData.get("From") as string;
      const to = formData.get("To") as string;
      const body = formData.get("Body") as string;
      const numMedia = formData.get("NumMedia") as string | null;
      const accountSid = formData.get("AccountSid") as string;
      const messageStatus = formData.get("MessageStatus") as string | null;

      // Validate required fields
      if (!messageSid || !from || !to || !body || !accountSid) {
        console.error("[WhatsApp Webhook] Missing required fields");
        return new Response("Missing required fields", { status: 400 });
      }

      // Optional: Verify Twilio signature
      // For production, you should verify the X-Twilio-Signature header
      // const signature = req.headers.get("X-Twilio-Signature");
      // if (signature && !verifyTwilioSignature(url, params, signature)) {
      //   return new Response("Invalid signature", { status: 401 });
      // }

      console.log(`[WhatsApp Webhook] Received message from ${from}`);

      // Process the incoming message
      await ctx.runMutation(internal.whatsapp.whatsapp.processIncomingMessage, {
        messageSid,
        from,
        to,
        body,
        numMedia: numMedia || undefined,
        accountSid,
        messageStatus: messageStatus || undefined,
      });

      // Return TwiML response (optional - can be empty for one-way messaging)
      // Twilio expects a response, even if empty
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          status: 200,
          headers: {
            "Content-Type": "text/xml",
          },
        },
      );
    } catch (error: any) {
      console.error(`[WhatsApp Webhook] Error: ${error.message}`, error);
      return new Response(`Webhook Error: ${error.message}`, { status: 500 });
    }
  }),
});

export default http;
