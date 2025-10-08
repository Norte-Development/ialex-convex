import { WorkflowManager } from "@convex-dev/workflow";
import { components, internal } from "../../_generated/api";
import { v } from "convex/values";
import { createThread, saveMessage } from "@convex-dev/agent";
import { agent } from "./agent";
import { internalAction, mutation } from "../../_generated/server";
import { getCurrentUserFromAuth } from "../../services/auth/authUtils";
import { authorizeThreadAccess } from "../threads";
import { prompt } from "./prompt";

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
      },
      { retry: true },
    );

    console.log("Home agent workflow completed");
  },
});

export const streamWithContextAction = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { threadId, promptMessageId }) => {


    const systemMessage = `Sos el asistente legal IALEX. Aquí está el contexto actual:
      Instrucciones:
      ${prompt}
    `;

    const { thread } = await agent.continueThread(ctx, { threadId });

    try {
      await thread.streamText(
        {
          system: systemMessage,
          promptMessageId,
          providerOptions: {
            openai: {
              reasoningEffort: "low",
              reasoningSummary: "auto",
            },
          },
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
            searchOtherThreads: true,
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

    let threadId = args.threadId;
    if (!threadId) {
      threadId = await createThread(ctx, components.agent, {
        userId: user._id,
        title: "Legal Agent Conversation",
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

    return { workflowId, threadId };
  },
});
