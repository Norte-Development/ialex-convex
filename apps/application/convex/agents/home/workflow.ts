import { WorkflowManager } from "@convex-dev/workflow";
import { components, internal, api } from "../../_generated/api";
import { v } from "convex/values";
import { saveMessage } from "@convex-dev/agent";
import { agent } from "./agent";
import { internalAction, mutation } from "../../_generated/server";
import { getCurrentUserFromAuth } from "../../auth_utils";
import { authorizeThreadAccess } from "../threads";
import { prompt } from "./prompt";
import { _getUserPlan, _getOrCreateUsageLimits, _getModelForUserPersonal } from "../../billing/features";
import { PLAN_LIMITS } from "../../billing/planLimits";
import { openai } from "@ai-sdk/openai";
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const workflow = new WorkflowManager(components.workflow);


export const legalAgentWorkflow = workflow.define({
  args: {
    userId: v.id("users"),
    threadId: v.string(),
    prompt: v.string(),
  },
  handler: async (step, args): Promise<void> => {
    const userMessage = await saveMessage(step, components.agent, {
        threadId: args.threadId,
        prompt: args.prompt,
      });


    await step.runAction(
      internal.agents.home.workflow.streamWithContextAction,
      {
        threadId: args.threadId,
        promptMessageId: userMessage.messageId,
        userId: args.userId,
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
  },
  returns: v.null(),
  handler: async (ctx, { threadId, promptMessageId, userId }) => {

    // Determine which model to use based on user's personal billing plan
    // (Home agent doesn't have case context, so only check user's own plan)
    const modelToUse = await ctx.runMutation(
      internal.billing.features.getModelForUserPersonal,
      { userId }
    );

    const systemMessage = `Sos el asistente legal IALEX. Aquí está el contexto actual:
      Instrucciones:
      ${prompt}
    `;

    const { thread } = await agent.continueThread(ctx, { threadId });

    const openRouterModel = modelToUse === 'gpt-5' ? 'anthropic/claude-haiku-4.5' : 'anthropic/claude-haiku-4.5';

    try {
      await thread.streamText(
        {
          system: systemMessage,
          promptMessageId,
          model: openrouter(openRouterModel, modelToUse === 'gpt-5' ? { reasoning: { effort: "low" } } : undefined),
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
