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

type ImageContentPart = {
  type: "image";
  image: string;
  mimeType: string;
};

type ImageContentPartOrNull = ImageContentPart | null;

export const processImageMedia = internalAction({
  args: {
    threadId: v.string(),
    mediaItems: v.optional(v.array(v.object({
      gcsBucket: v.string(),
      gcsObject: v.string(),
      contentType: v.string(),
      size: v.number(),
    }))),
  },
  handler: async (ctx, { threadId, mediaItems }): Promise<Array<ImageContentPart>> => {
    // Filter to only include image media types (LLM can only process images)
    const imageMediaItems =
      mediaItems?.filter((m) => m.contentType.startsWith("image/")) ?? [];

    // Strip out size field since generateSignedImageUrls doesn't need it
    const imageMediaItemsForSigning = imageMediaItems.map(({ gcsBucket, gcsObject, contentType }) => ({
      gcsBucket,
      gcsObject,
      contentType,
    }));

    // For image media, generate short-lived signed URLs so the model
    // receives a fetchable URL instead of an internal GCS object path.
    const signedImageParts: Array<ImageContentPartOrNull> = await ctx.runAction(
      internal.agents.whatsapp.mediaUtils.generateSignedImageUrls,
      {
        threadId,
        imageMediaItems: imageMediaItemsForSigning,
      },
    );

    const imageContentParts: Array<ImageContentPart> = signedImageParts.filter(
      (imagePart: ImageContentPartOrNull): imagePart is ImageContentPart =>
        imagePart !== null,
    );

    return imageContentParts;
  },
});

export const whatsappWorkflow = workflow.define({
    args: {
      threadId: v.string(),
      prompt: v.string(),
      twilioMessageId: v.string(),
      mediaItems: v.optional(v.array(v.object({
        gcsBucket: v.string(),
        gcsObject: v.string(),
        contentType: v.string(),
        size: v.number(),
      }))),
    },
    handler: async (step, args) => {
      // Process image media items and generate signed URLs
      const imageContentParts: Array<ImageContentPart> = await step.runAction(
        internal.agents.whatsapp.workflow.processImageMedia,
        {
          threadId: args.threadId,
          mediaItems: args.mediaItems,
        },
      );

      await step.runAction(internal.agents.whatsapp.workflow.streamAction, { 
        threadId: args.threadId, 
        prompt: args.prompt, 
        twilioMessageId: args.twilioMessageId,
        imageContentParts,
      });
    },
  });


export const startWorkflow = internalAction({
    args: {
      threadId: v.string(),
      prompt: v.string(),
      twilioMessageId: v.string(),
      mediaItems: v.optional(v.array(v.object({
        gcsBucket: v.string(),
        gcsObject: v.string(),
        contentType: v.string(),
        size: v.number(),
      }))),
    },
    handler: async (ctx, args) => {
      await workflow.start(ctx, internal.agents.whatsapp.workflow.whatsappWorkflow, { 
        threadId: args.threadId, 
        prompt: args.prompt, 
        twilioMessageId: args.twilioMessageId,
        mediaItems: args.mediaItems,
      });
    },
  });

export const streamAction = internalAction({
    args: {
      threadId: v.string(),
      prompt: v.string(),
      twilioMessageId: v.string(),
      imageContentParts: v.array(v.object({
        type: v.literal("image"),
        image: v.string(),
        mimeType: v.string(),
      })),
    },
    handler: async (ctx, { threadId, prompt, twilioMessageId, imageContentParts }): Promise<null> => {

      // Persist the incoming WhatsApp message as part of the agent thread,
      // including only image media items as image parts with signed URLs
      const { messageId: promptMessageId } = await agent.saveMessage(ctx, {
        threadId,
        message: {
          role: "user",
          content: [{ type: "text", text: prompt }, ...imageContentParts],
        },
      });

      // Get thread metadata to extract user ID
      const { userId: threadUserId } = await getThreadMetadata(
        ctx,
        components.agent,
        { threadId },
      );

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
        // Optionally: you could also send a WhatsApp error message here
        throw new Error('WhatsApp account not connected or verified');
      }

      const whatsappNumber = user.preferences.whatsappNumber;
      const whatsappTo = whatsappNumber.startsWith('whatsapp:')
        ? whatsappNumber
        : `whatsapp:${whatsappNumber}`;

      // Load thread context after saving the incoming message
      const { thread } = await agent.continueThread(ctx, { threadId });

      try {
        const incomingMessageId = twilioMessageId;

        await thread.streamText(
          {
            system: systemPrompt,
            promptMessageId,
            model: openrouter('openai/gpt-5-nano'),
            prepareStep: async (step) => {
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

        console.log(
          `[Stream Complete] Thread ${threadId}: Stream completed successfully`,
        );
      } catch (error) {
        const err = error as Error;
        console.error(`[Stream Fatal Error] Thread ${threadId}:`, {
          name: err?.name || 'Unknown',
          message: err?.message || 'No message',
          stack: err?.stack,
        });
        throw error;
      }

      return null;
    },
});

// New helper to centralize the "unlinked number" message
export const handleUnlinkedWhatsapp = internalAction({
  args: {
    to: v.string(), // the raw "whatsapp:+..." from Twilio
  },
  handler: async (ctx, { to }): Promise<null> => {
    await ctx.runAction(internal.whatsapp.twilio.sendMessage, {
      to,
      body:
        'Por favor, conecta tu cuenta de WhatsApp en tus preferencias de usuario en iAlex.',
    });
    return null;
  },
});



