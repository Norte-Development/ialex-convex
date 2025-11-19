import { internalAction } from "../../_generated/server";
import { v } from "convex/values";
import { agent } from "./agent";
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { components, internal, api } from "../../_generated/api";
import { WorkflowManager } from "@convex-dev/workflow";
import { prompt as systemPrompt } from "./prompt";
import { getThreadMetadata } from "@convex-dev/agent";
import { Id } from "../../_generated/dataModel";

const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
});

const workflow = new WorkflowManager(components.workflow);


export const whatsappWorkflow = workflow.define({
    args: {
      threadId: v.string(),
      promptMessageId: v.string(),
      twilioMessageId: v.string(),
    },
    handler: async (step, args) => {
      await step.runAction(internal.agents.whatsapp.workflow.streamAction, { threadId: args.threadId, promptMessageId: args.promptMessageId, twilioMessageId: args.twilioMessageId });
    },
  });


export const startWorkflow = internalAction({
    args: {
      threadId: v.string(),
      promptMessageId: v.string(),
      twilioMessageId: v.string(),
    },
    handler: async (ctx, args) => {
      await workflow.start(ctx, internal.agents.whatsapp.workflow.whatsappWorkflow, { threadId: args.threadId, promptMessageId: args.promptMessageId, twilioMessageId: args.twilioMessageId });
    },
  });

export const streamAction = internalAction({
    args: {
      threadId: v.string(),
      promptMessageId: v.string(),
      twilioMessageId: v.string(),
    },
    returns: v.null(),
    handler: async (ctx, { threadId, promptMessageId, twilioMessageId }) => {
      // Get thread metadata to extract user ID
      const { userId: threadUserId } = await getThreadMetadata(ctx, components.agent, { threadId });
      
      if (!threadUserId || !threadUserId.startsWith('whatsapp:')) {
        throw new Error(`Invalid WhatsApp thread userId format: ${threadUserId}`);
      }

      // Extract user ID from thread userId format: "whatsapp:${userId}"
      const userId = threadUserId.replace('whatsapp:', '') as Id<"users">;

      // Get user record to retrieve WhatsApp number
      const user = await ctx.runQuery(api.functions.users.getUserById, { userId });
      
      if (!user) {
        throw new Error('User not found');
      }

      // Validate WhatsApp connection
      if (!user.preferences?.whatsappNumber || !user.preferences?.whatsappVerified) {
        // Send error message to the incoming number (we need to get it from the message)
        // For now, we'll throw an error - in production, we might want to handle this more gracefully
        throw new Error('WhatsApp account not connected or verified');
      }

      const whatsappNumber = user.preferences.whatsappNumber;
      const whatsappTo = whatsappNumber.startsWith('whatsapp:') 
        ? whatsappNumber 
        : `whatsapp:${whatsappNumber}`;

      // Determine which model to use based on user's billing plan and case context
      const { thread } = await agent.continueThread(ctx, { threadId });
      try {
        
        // Keep the incoming message ID for typing indicators (can't use sent message IDs)
        const incomingMessageId = twilioMessageId;
        
        await thread.streamText(
          {
            system: systemPrompt,
            promptMessageId,
            model: openrouter('openai/gpt-5-nano'),
            prepareStep: async (step) => {
                // Always use the incoming message ID for typing indicators
                await ctx.runAction(internal.whatsapp.twilio.setTypingIndicator, {
                    messageId: incomingMessageId,
                    active: true,
                });
                return step;
            },
            onStepFinish: async (event) => {
              for (const content of event.content) {
                if (content.type === 'text') {
                   await ctx.runAction(internal.whatsapp.twilio.sendMessage, {
                    to: whatsappTo,
                    body: content.text,
                  });
                }
              }
            },
          },
          {
            saveStreamDeltas: true,
          },
        );
        
        console.log(`[Stream Complete] Thread ${threadId}: Stream completed successfully`);
      } catch (error) {
        const err = error as Error;
        const errorName = err?.name || 'Unknown';
        const errorMessage = err?.message || 'No message';
        const errorString = String(error).toLowerCase();
        
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



