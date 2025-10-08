import { httpRouter } from "convex/server";
import webhooks from "./webhooks/documentProcessed";
import api from "./api/signedDownload";

const http = httpRouter();

// Include webhook routes
http.include("/webhooks", webhooks);

// Include API routes
http.include("/api", api);

export default http;