import { httpAction } from "../../_generated/server";
import { httpRouter } from "convex/server";
import { internal } from "../../_generated/api";
import { verifyHmac } from "../middleware/hmacVerify";

const http = httpRouter();

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

    await ctx.runMutation(internal.api.documentProcessing.updateDocumentProcessingStatus, {
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