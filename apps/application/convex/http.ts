import { httpAction } from "./_generated/server";
import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// HMAC verification using Web Crypto API (available in HTTP actions)
async function verifyHmac(message: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signatureBuffer = new Uint8Array(signature.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const messageBuffer = encoder.encode(message);
    
    const expectedSignature = await crypto.subtle.sign("HMAC", key, messageBuffer);
    const expectedSignatureHex = Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return signature === expectedSignatureHex;
  } catch (error) {
    console.error("HMAC verification failed:", error);
    return false;
  }
}

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

    const documentId = payload.documentId;
    const status = payload.status;
    const totalChunks = payload.totalChunks as number | undefined;
    const error = payload.error as string | undefined;

    if (!documentId || !status) {
      return new Response("missing fields", { status: 400 });
    }

    await ctx.runMutation(internal.functions.documentProcessing.updateDocumentProcessingStatus, {
      documentId,
      status,
      processingCompletedAt: Date.now(),
      processingError: error,
      totalChunks,
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;


