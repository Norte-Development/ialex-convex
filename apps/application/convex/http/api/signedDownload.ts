import { httpAction } from "../../../_generated/server";
import { httpRouter } from "convex/server";
import { internal } from "../../../_generated/api";

const http = httpRouter();

http.route({
  path: "/signed-download",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const { bucket, object, expiresSeconds } = await req.json();
      if (!bucket || !object) {
        return new Response("missing params", { status: 400 });
      }
      const url = await ctx.runAction(internal.lib.external.gcs.generateGcsV4SignedUrlAction, {
        method: "GET",
        bucket,
        object,
        expiresSeconds: Number(expiresSeconds || 900),
      });

      return new Response(JSON.stringify({ url: url.url }), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (e) {
      return new Response("bad request", { status: 400 });
    }
  }),
});

export default http;