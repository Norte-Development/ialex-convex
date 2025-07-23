import { defineApp } from "convex/server";
import resend from "@convex-dev/resend/convex.config";
import prosemirrorSync from "@convex-dev/prosemirror-sync/convex.config";

const app = defineApp();
app.use(resend);
app.use(prosemirrorSync);

export default app;
