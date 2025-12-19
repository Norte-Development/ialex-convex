import { WorkflowManager } from "@convex-dev/workflow";
import { components, internal, api } from "../../_generated/api";
import { v } from "convex/values";
import { agent } from "./agent";
import { internalAction, mutation } from "../../_generated/server";
import type { ActionCtx } from "../../_generated/server";
import { getCurrentUserFromAuth } from "../../auth_utils";
import { authorizeThreadAccess } from "../threads";
import { prompt } from "./prompt";
import { _getUserPlan, _getOrCreateUsageLimits, _getModelForUserPersonal } from "../../billing/features";
import { PLAN_LIMITS } from "../../billing/planLimits";
import { openai } from "@ai-sdk/openai";
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
const HOME_MEDIA_MAX_SIZE_BYTES = Number(
  process.env.HOME_MEDIA_MAX_SIZE_BYTES ?? 10 * 1024 * 1024,
);

const mediaKindValidator = v.union(v.literal("image"), v.literal("pdf"));

const mediaRefValidator = v.object({
  url: v.optional(v.string()),
  gcsBucket: v.string(),
  gcsObject: v.string(),
  contentType: v.string(),
  filename: v.string(),
  size: v.number(),
  kind: mediaKindValidator,
});

type MediaKind = "image" | "pdf";

type MediaRef = {
  url?: string;
  gcsBucket: string;
  gcsObject: string;
  contentType: string;
  filename: string;
  size: number;
  kind: MediaKind;
};

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const workflow = new WorkflowManager(components.workflow);


export const legalAgentWorkflow = workflow.define({
  args: {
    userId: v.id("users"),
    threadId: v.string(),
    prompt: v.string(),
    webSearch: v.boolean(),
    media: v.optional(v.array(mediaRefValidator)),
  },
  handler: async (step, args): Promise<void> => {
    const { messageId: promptMessageId } = await step.runAction(
      internal.agents.home.workflow.saveHomeMessageWithMediaAction,
      {
        threadId: args.threadId,
        prompt: args.prompt,
        media: args.media ?? [],
      },
    );


    await step.runAction(
      internal.agents.home.workflow.streamWithContextAction,
      {
        threadId: args.threadId,
        promptMessageId,
        userId: args.userId,
        webSearch: args.webSearch,
      },
      { retry: false },
    );

    console.log("Home agent workflow completed");
  },
});

export const streamWithContextAction = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    userId: v.id("users"),
    webSearch: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { threadId, promptMessageId, userId, webSearch }) => {

    // Determine which model to use based on user's personal billing plan
    // (Home agent doesn't have case context, so only check user's own plan)
    const modelToUse = await ctx.runMutation(
      internal.billing.features.getModelForUserPersonal,
      { userId }
    );

    const systemMessage = `Sos el asistente legal IALEX.
WEB_SEARCH_MODE: ${webSearch ? "ENABLED" : "DISABLED"}

Instrucciones:
${prompt}
`;

    const { thread } = await agent.continueThread(ctx, { threadId });

    let openRouterModel = modelToUse === 'gpt-5' ? 'openai/gpt-5.1' : 'openai/gpt-5-mini';
    const config = { reasoning: modelToUse === 'gpt-5' ? {enabled: true, effort: "low" as const, exclude: false } : undefined};

    if (webSearch) {
      openRouterModel = openRouterModel + ':online';
    }
    console.log('openRouterModel', openRouterModel);


    try {
      await thread.streamText(
        {
          system: systemMessage,
          promptMessageId,
          model: openrouter(openRouterModel, config),
          experimental_repairToolCall: async (...args: any[]) => {
            console.log("Tool call repair triggered:", args);
            return null;
          },
          onAbort: () => {
            console.log(`[Stream Abort Callback] Thread ${threadId}: Stream abort callback triggered`);
          },
          onError: (event) => {
            const error = event.error as Error;
            const errorName = error?.name || 'Unknown';
            const errorMessage = error?.message || String(error) || 'No message';
            const errorString = String(error).toLowerCase();
            
            // Check if this is an abort error (user cancelled the stream)
            if (
              errorName === "AbortError" || 
              errorMessage === "AbortError" ||
              errorMessage.toLowerCase().includes("abort") || 
              errorString.includes("abort")
            ) {
              console.log(`[Stream Abort in onError] Thread ${threadId}: Abort detected in error handler`);
              return; // Don't throw for user-initiated aborts
            }

            // Check for timeout errors
            if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
              console.error(`[Stream Timeout] Thread ${threadId}:`, errorMessage);
              return; // Don't throw for timeouts, let the catch handle it
            }

            // Check for network errors
            if (errorMessage.includes("network") || errorMessage.includes("ECONNRESET") || errorMessage.includes("ETIMEDOUT")) {
              console.error(`[Stream Network Error] Thread ${threadId}:`, errorMessage);
              return; // Don't throw for network errors, let the catch handle it
            }

            // Log other errors but don't throw (let the catch block handle them)
            console.error(`[Stream Error] Thread ${threadId}:`, {
              name: errorName,
              message: errorMessage,
              stack: error?.stack,
            });
          },
        },
        {
          saveStreamDeltas: {
            chunking: "word",
            throttleMs: 50,
          },
          contextOptions: {
            searchOtherThreads: false,
          },
        },
      );
      
      console.log(`[Stream Complete] Thread ${threadId}: Stream completed successfully`);
    } catch (error) {
      const err = error as Error;
      const errorName = err?.name || 'Unknown';
      const errorMessage = err?.message || 'No message';
      const errorString = String(error).toLowerCase();
      
      // Handle abort errors gracefully (user cancelled)
      // Check name, message, and string representation for abort-related keywords
      if (
        errorName === "AbortError" || 
        errorMessage === "AbortError" ||
        errorMessage.toLowerCase().includes("abort") || 
        errorString.includes("abort")
      ) {
        console.log(`[Stream Abort Caught] Thread ${threadId}: Stream was successfully aborted by user`);
        return null;
      }

      // Handle timeout errors
      if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
        console.error(`[Stream Timeout Caught] Thread ${threadId}: Stream timed out - ${errorMessage}`);
        // Don't re-throw timeout errors, return gracefully
        return null;
      }

      // Handle network errors
      if (errorMessage.includes("network") || errorMessage.includes("ECONNRESET") || errorMessage.includes("ETIMEDOUT")) {
        console.error(`[Stream Network Error Caught] Thread ${threadId}: Network error - ${errorMessage}`);
        // Don't re-throw network errors, return gracefully
        return null;
      }

      // For all other errors, log and re-throw
      console.error(`[Stream Fatal Error] Thread ${threadId}:`, {
        name: errorName,
        message: errorMessage,
        stack: err?.stack,
      });
      throw error;
    }

    return null;
  },
});

export const initiateWorkflowStreaming = mutation({
  args: {
    prompt: v.string(),
    threadId: v.string(),
    webSearchEnabled: v.boolean(),
    media: v.optional(v.array(mediaRefValidator)),
  },
  returns: v.object({
    workflowId: v.string(),
    threadId: v.string(),
  }),
  handler: async (ctx, args): Promise<{workflowId: string, threadId: string}> => {
    const user = await getCurrentUserFromAuth(ctx);

    // Check AI message limits before processing
    const userPlan = await _getUserPlan(ctx, user._id);
    const usage = await _getOrCreateUsageLimits(ctx, user._id, "user");
    const limits = PLAN_LIMITS[userPlan];

    // Check AI message limits + purchased credits
    const credits = await ctx.db
      .query("aiCredits")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const availableMessages = limits.aiMessagesPerMonth - usage.aiMessagesThisMonth;
    const availableCredits = credits?.remaining || 0;
    const totalAvailable = availableMessages + availableCredits;

    if (totalAvailable <= 0) {
      throw new Error(
        "Has alcanzado el límite de mensajes de IA. Compra créditos o actualiza a Premium para mensajes ilimitados."
      );
    }

    const media = args.media ?? [];

    for (const mediaItem of media) {
      if (mediaItem.size > HOME_MEDIA_MAX_SIZE_BYTES) {
        throw new Error(
          `El archivo ${mediaItem.filename} supera el máximo permitido (${Math.round(
            HOME_MEDIA_MAX_SIZE_BYTES / (1024 * 1024),
          )}MB)`,
        );
      }
      if (
        mediaItem.kind === "image" &&
        !mediaItem.contentType.startsWith("image/")
      ) {
        throw new Error(
          `Solo se permiten imágenes con content-type image/* (recibido: ${mediaItem.contentType})`,
        );
      }
      if (mediaItem.kind === "pdf" && mediaItem.contentType !== "application/pdf") {
        throw new Error(
          `Solo se permiten PDFs con content-type application/pdf (recibido: ${mediaItem.contentType})`,
        );
      }
    }

    let threadId = args.threadId;
    if (!threadId) {
      // Use first 50 chars of message as thread title
      const truncatedTitle = args.prompt.length > 50 
        ? `${args.prompt.substring(0, 50)}...` 
        : args.prompt;
      
      threadId = await ctx.runMutation(api.agents.threads.createNewThread, {
        title: truncatedTitle,
      });
    } else {
      await authorizeThreadAccess(ctx, threadId);
    }

    const workflowId = await workflow.start(
      ctx,
      internal.agents.home.workflow.legalAgentWorkflow,
      {
        userId: user._id,
        threadId,
        prompt: args.prompt,
        webSearch: args.webSearchEnabled,
        media,
      },
    );

    // Decrement AI message credits after successfully initiating workflow
    // Home workflow has no case context, so teamId is undefined (uses user's personal limits)
    await ctx.scheduler.runAfter(0, internal.billing.features.decrementCredits, {
      userId: user._id,
      teamId: undefined,
      amount: 1,
    });

    return { workflowId, threadId };
  },
});

export const saveHomeMessageWithMediaAction = internalAction({
  args: {
    threadId: v.string(),
    prompt: v.string(),
    media: v.optional(v.array(mediaRefValidator)),
  },
  returns: v.object({
    messageId: v.string(),
  }),
  handler: async (ctx, { threadId, prompt, media }) => {
    const mediaRefs = media ?? [];
    const mediaParts = await buildMediaContentParts(ctx, threadId, mediaRefs);
    const messageContent = [
      { type: "text" as const, text: prompt },
      ...mediaParts,
    ];

    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/0e2edc26-cd1d-46dd-a120-43a13a299d5f", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "pre-fix-1",
        hypothesisId: "H2",
        location: "convex/agents/home/workflow.ts:saveHomeMessageWithMediaAction",
        message: "Saving home message with media parts",
        data: {
          threadId,
          promptPreview: prompt.slice(0, 120),
          mediaCount: mediaRefs.length,
          mediaSummary: mediaRefs.map((m) => ({
            kind: m.kind,
            filename: m.filename,
            hasUrl: !!m.url,
            gcsBucket: m.gcsBucket,
            gcsObject: m.gcsObject,
          })),
          contentKinds: messageContent.map((p) => (p as any).type),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log

    const { messageId } = await agent.saveMessage(ctx, {
      threadId,
      message: {
        role: "user",
        content: messageContent,
      },
    });

    return { messageId };
  },
});

type ImagePart = {
  type: "image";
  image: string;
  mimeType: string;
};

type FilePart = {
  type: "file";
  data: string;
  filename: string;
  mimeType: string;
};

const buildMediaContentParts = async (
  ctx: ActionCtx,
  threadId: string,
  mediaRefs: Array<MediaRef>,
): Promise<Array<ImagePart | FilePart>> => {
  const parts: Array<ImagePart | FilePart> = [];

  for (const mediaRef of mediaRefs) {
    if (mediaRef.size > HOME_MEDIA_MAX_SIZE_BYTES) {
      console.warn("[Home Agent] Archivo omitido por exceder tamaño máximo", {
        threadId,
        filename: mediaRef.filename,
        size: mediaRef.size,
      });
      continue;
    }

    let mediaUrl = mediaRef.url;

    if (!mediaUrl) {
      try {
        const resolvedUrl = await ctx.runAction(
          internal.agents.whatsapp.mediaUtils.getShortLivedMediaUrl,
          {
            gcsBucket: mediaRef.gcsBucket,
            gcsObject: mediaRef.gcsObject,
          },
        );
        mediaUrl = resolvedUrl ?? undefined;

        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/0e2edc26-cd1d-46dd-a120-43a13a299d5f", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "debug-session",
            runId: "pre-fix-1",
            hypothesisId: "H3",
            location: "convex/agents/home/workflow.ts:buildMediaContentParts",
            message: "Resolved media URL via getShortLivedMediaUrl",
            data: {
              threadId,
              kind: mediaRef.kind,
              filename: mediaRef.filename,
              gcsBucket: mediaRef.gcsBucket,
              gcsObject: mediaRef.gcsObject,
              resolvedUrlPreview: resolvedUrl ? resolvedUrl.slice(0, 120) : null,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion agent log
      } catch (error) {
        console.error(
          "[Home Agent] Error generando URL para media, se omite",
          {
            threadId,
            gcsBucket: mediaRef.gcsBucket,
            gcsObject: mediaRef.gcsObject,
            error,
          },
        );
      }
    }

    if (!mediaUrl) {
      console.warn(
        "[Home Agent] No se pudo obtener URL pública para media, se omite",
        {
          threadId,
          gcsBucket: mediaRef.gcsBucket,
          gcsObject: mediaRef.gcsObject,
        },
      );
      continue;
    }

    if (mediaRef.kind === "image") {
      parts.push({
        type: "image",
        image: mediaUrl,
        mimeType: mediaRef.contentType,
      });
      continue;
    }

    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/0e2edc26-cd1d-46dd-a120-43a13a299d5f", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "pre-fix-1",
        hypothesisId: "H4",
        location: "convex/agents/home/workflow.ts:buildMediaContentParts",
        message: "Adding file part for media",
        data: {
          threadId,
          kind: mediaRef.kind,
          filename: mediaRef.filename,
          mediaUrlPreview: mediaUrl.slice(0, 120),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log

    parts.push({
      type: "file",
      data: mediaUrl,
      filename: mediaRef.filename,
      mimeType: mediaRef.contentType,
    });
  }

  return parts;
};
