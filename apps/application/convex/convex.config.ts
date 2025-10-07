import { defineApp } from "convex/server";
import resend from "@convex-dev/resend/convex.config";
import prosemirrorSync from "@convex-dev/prosemirror-sync/convex.config";
import agent from "@convex-dev/agent/convex.config";
import rag from "@convex-dev/rag/convex.config";
import workflow from "@convex-dev/workflow/convex.config";

const app = defineApp();
app.use(resend);
app.use(prosemirrorSync);
app.use(agent);
app.use(rag);
app.use(workflow);

export default app;
