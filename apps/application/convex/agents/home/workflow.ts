import { WorkflowManager } from "@convex-dev/workflow";
import { components, internal, api } from "../../_generated/api";
import { v, ConvexError } from "convex/values";
import { agent } from "./agent";
import { internalAction, mutation } from "../../_generated/server";
import type { ActionCtx } from "../../_generated/server";
import { getCurrentUserFromAuth } from "../../auth_utils";
import { authorizeThreadAccess } from "../threads";
import { prompt } from "./prompt";
import {
  _getUserPlan,
  _getOrCreateUsageLimits,
  _getModelForUserPersonal,
} from "../../billing/features";
import { PLAN_LIMITS } from "../../billing/planLimits";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  buildOpenRouterModelChain,
  FORCE_PRIMARY_FALLBACK_TEST,
} from "../openRouterModels";
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

    const modelsToTry = buildOpenRouterModelChain(modelToUse, webSearch);
    console.log(
      "home openRouter modelsToTry",
      modelsToTry.map((m) => m.id),
    );

    for (let i = 0; i < modelsToTry.length; i++) {
      const { id, config } = modelsToTry[i];
      const isLast = i === modelsToTry.length - 1;

      console.log(`[Home Stream Start] Thread ${threadId}: trying model ${id}`);

      try {
        // Testing hook: when FORCE_PRIMARY_FALLBACK_TEST is true, simulate a
        // failure for the first (primary) model for paid users so we can
        // verify that the fallback model streams correctly.
        if (
          FORCE_PRIMARY_FALLBACK_TEST &&
          i === 0 &&
          modelToUse === "gpt-5"
        ) {
          console.warn(
            `[Home Model Fallback Test] Thread ${threadId}: Forcing simulated failure for primary model ${id}`,
          );
          throw new Error(
            "Simulated primary model failure for fallback testing",
          );
        }

        await thread.streamText(
          {
            system: systemMessage,
            promptMessageId,
            model: openrouter(id, config),
            experimental_repairToolCall: async (...args: any[]) => {
              console.log("Tool call repair triggered:", args);
              return null;
            },
            onAbort: () => {
              console.log(
                `[Home Stream Abort Callback] Thread ${threadId}: Stream abort callback triggered (model ${id})`,
              );
            },
            onError: (event) => {
              const error = event.error as Error;
              const errorName = error?.name || "Unknown";
              const errorMessage = error?.message || String(error) || "No message";
              const errorString = String(error).toLowerCase();

              // Treat abort as a non-error (user cancelled) and don't trigger fallback
              if (
                errorName === "AbortError" ||
                errorMessage === "AbortError" ||
                errorMessage.toLowerCase().includes("abort") ||
                errorString.includes("abort")
              ) {
                console.log(
                  `[Home Stream Abort in onError] Thread ${threadId}: Abort detected in error handler (model ${id})`,
                );
                return;
              }

              // For all other errors, log and rethrow so the outer catch can decide
              console.error(
                `[Home Stream Error] Thread ${threadId} (model ${id}):`,
                {
                  name: errorName,
                  message: errorMessage,
                  stack: error?.stack,
                },
              );

              throw error;
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

        console.log(
          `[Home Stream Complete] Thread ${threadId}: Stream completed successfully with model ${id}`,
        );
        break; // success, don't try further models
      } catch (error) {
        const err = error as Error;
        const errorName = err?.name || "Unknown";
        const errorMessage = err?.message || "No message";
        const errorString = String(error).toLowerCase();

        // Handle abort errors gracefully (user cancelled)
        if (
          errorName === "AbortError" ||
          errorMessage === "AbortError" ||
          errorMessage.toLowerCase().includes("abort") ||
          errorString.includes("abort")
        ) {
          console.log(
            `[Home Stream Abort Caught] Thread ${threadId}: Stream was successfully aborted by user (model ${id})`,
          );
          return null;
        }

        // Handle timeout errors
        if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
          console.error(
            `[Home Stream Timeout Caught] Thread ${threadId} (model ${id}): Stream timed out - ${errorMessage}`,
          );
          if (isLast) {
            return null;
          }
          continue;
        }

        // Handle network errors
        if (
          errorMessage.includes("network") ||
          errorMessage.includes("ECONNRESET") ||
          errorMessage.includes("ETIMEDOUT")
        ) {
          console.error(
            `[Home Stream Network Error Caught] Thread ${threadId} (model ${id}): Network error - ${errorMessage}`,
          );
          if (isLast) {
            return null;
          }
          continue;
        }

        // For all other errors, either re-throw on the last model or fall back
        if (isLast) {
          console.error(
            `[Home Stream Fatal Error] Thread ${threadId} (model ${id}):`,
            {
              name: errorName,
              message: errorMessage,
              stack: err?.stack,
            },
          );
          throw error;
        }

        console.error(
          `[Home Model Fallback] Thread ${threadId}: model ${id} failed, trying next model`,
          {
            name: errorName,
            message: errorMessage,
            stack: err?.stack,
          },
        );
      }
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
      throw new ConvexError({
        code: "AI_LIMIT_EXCEEDED",
        message: "Has alcanzado el límite de mensajes de IA. Compra créditos o actualiza a Premium para mensajes ilimitados.",
        isTeamLimit: false,
      });
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

    parts.push({
      type: "file",
      data: mediaUrl,
      filename: mediaRef.filename,
      mimeType: mediaRef.contentType,
    });
  }

  return parts;
};
