import { defineApp } from "convex/server";
import resend from "@convex-dev/resend/convex.config";
import agent from "@convex-dev/agent/convex.config";

const app = defineApp();
app.use(resend);
app.use(agent);

export default app;