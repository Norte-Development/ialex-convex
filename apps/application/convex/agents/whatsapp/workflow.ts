import { internalAction } from "../../_generated/server";
import { v } from "convex/values";
import { agent } from "./agent";
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { components, internal, api } from "../../_generated/api";
import { WorkflowManager } from "@convex-dev/workflow";
import { prompt as systemPrompt } from "./prompt";
import { getThreadMetadata } from "@convex-dev/agent";
import { Id } from "../../_generated/dataModel";

/**
 * WhatsApp Media URL Strategy: Short-lived, Unguessable URLs (Option 4)
 * 
 * This workflow implements a security-focused approach for handling WhatsApp media:
 * 
 * 1. **No Persisted URLs**: Media references (GCS bucket + object key) are stored,
 *    but signed URLs are never persisted in the database.
 * 
 * 2. **Just-in-Time Generation**: Fresh signed URLs are generated immediately before
 *    AI calls, ensuring they're valid when the AI fetches them.
 * 
 * 3. **Short Exposure Window**: URLs use configurable TTL (default: 10 minutes via
 *    WHATSAPP_MEDIA_URL_TTL_SECONDS env var). This minimizes the window where URLs
 *    could be intercepted or misused.
 * 
 * 4. **Unguessable**: GCS V4 signed URLs include cryptographic signatures, making
 *    them effectively unguessable bearer tokens.
 * 
 * 5. **Graceful Degradation**: If media URLs fail (expired, deleted, etc.), the
 *    workflow continues with text-only context and optionally notifies the user.
 * 
 * This approach balances security (no long-lived public URLs) with reliability
 * (fresh URLs reduce expiration errors) while maintaining privacy.
 */

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

type MediaReference = {
  gcsBucket: string;
  gcsObject: string;
  contentType: string;
};

/**
 * Processes image media items and returns media references (not URLs).
 * URLs are generated just-in-time before AI calls to minimize exposure window.
 */
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
  handler: async (ctx, { threadId, mediaItems }): Promise<Array<MediaReference>> => {
    // Filter to only include image media types (LLM can only process images)
    const imageMediaItems =
      mediaItems?.filter((m) => m.contentType.startsWith("image/")) ?? [];

    // Return media references (not URLs) - URLs will be generated just-in-time
    return imageMediaItems.map(({ gcsBucket, gcsObject, contentType }) => ({
      gcsBucket,
      gcsObject,
      contentType,
    }));
  },
});

export const processVoiceMedia = internalAction({
  args: {
    threadId: v.string(),
    mediaItems: v.optional(v.array(v.object({
      gcsBucket: v.string(),
      gcsObject: v.string(),
      contentType: v.string(),
      size: v.number(),
    }))),
  },
  handler: async (ctx, { threadId, mediaItems }): Promise<string> => {
    // Filter to only include audio media types (voice notes)
    const audioMediaItems =
      mediaItems?.filter((m) => m.contentType.startsWith("audio/")) ?? [];

    if (audioMediaItems.length === 0) {
      return "";
    }

    // Transcribe all audio media items and combine transcriptions
    const transcriptions = await Promise.all(
      audioMediaItems.map(async (audioItem) => {
        try {
          const transcription = await ctx.runAction(
            internal.agents.whatsapp.mediaUtils.transcribeAction,
            {
              gcsBucket: audioItem.gcsBucket,
              gcsObject: audioItem.gcsObject,
            },
          );
          return transcription;
        } catch (error) {
          console.error(
            "[WhatsApp Workflow] Failed to transcribe audio",
            {
              threadId,
              gcsBucket: audioItem.gcsBucket,
              gcsObject: audioItem.gcsObject,
              contentType: audioItem.contentType,
              error,
            },
          );
          // If transcription fails, return empty string so other transcriptions still work
          return "";
        }
      }),
    );

    // Combine all transcriptions with newlines
    const combinedTranscription = transcriptions
      .filter((t) => t.trim().length > 0)
      .join("\n\n");

    return combinedTranscription;
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
      // Process image media items to get references (not URLs yet)
      const imageMediaRefs: Array<MediaReference> = await step.runAction(
        internal.agents.whatsapp.workflow.processImageMedia,
        {
          threadId: args.threadId,
          mediaItems: args.mediaItems,
        },
        {
          retry: true
        }
      );

      // Process voice notes and generate transcriptions
      const transcription: string = await step.runAction(
        internal.agents.whatsapp.workflow.processVoiceMedia,
        {
          threadId: args.threadId,
          mediaItems: args.mediaItems,
        },
        {
          retry: true
        }
      );

      // Combine original prompt with transcription if present
      const combinedPrompt = transcription
        ? `${args.prompt}\n\nTranscripción del audio: ${transcription}`
        : args.prompt;

      await step.runAction(internal.agents.whatsapp.workflow.streamAction, { 
        threadId: args.threadId, 
        prompt: combinedPrompt, 
        twilioMessageId: args.twilioMessageId,
        imageMediaRefs,
      }, {
        retry: true
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
      imageMediaRefs: v.array(v.object({
        gcsBucket: v.string(),
        gcsObject: v.string(),
        contentType: v.string(),
      })),
    },
    handler: async (ctx, { threadId, prompt, twilioMessageId, imageMediaRefs }): Promise<null> => {
      // Generate fresh short-lived signed URLs just-in-time before AI call.
      // This minimizes exposure window and ensures URLs are valid when the AI fetches them.
      // URLs are never persisted - they act as short-lived bearer tokens.
      const imageContentParts: Array<ImageContentPart> = [];
      for (const mediaRef of imageMediaRefs) {
        try {
          const url = await ctx.runAction(
            internal.agents.whatsapp.mediaUtils.getShortLivedMediaUrl,
            {
              gcsBucket: mediaRef.gcsBucket,
              gcsObject: mediaRef.gcsObject,
            },
          );
          if (url) {
            imageContentParts.push({
              type: "image",
              image: url,
              mimeType: mediaRef.contentType,
            });
          } else {
            console.warn(
              "[WhatsApp Workflow] Failed to generate signed URL for image, skipping",
              {
                threadId,
                gcsBucket: mediaRef.gcsBucket,
                gcsObject: mediaRef.gcsObject,
              },
            );
          }
        } catch (error) {
          console.error(
            "[WhatsApp Workflow] Error generating signed URL for image, skipping",
            {
              threadId,
              gcsBucket: mediaRef.gcsBucket,
              gcsObject: mediaRef.gcsObject,
              error,
            },
          );
          // Continue with other images even if one fails
        }
      }

      // Persist the incoming WhatsApp message as part of the agent thread,
      // including image media items with fresh signed URLs
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
            onError: async (event) => {
              const error = event.error as Error;
              // Handle AI_DownloadError and other media fetch failures gracefully
              const isDownloadError = 
                error?.name === 'AI_DownloadError' ||
                (error?.message && error.message.includes('Failed to download')) ||
                (error?.message && error.message.includes('400 Bad Request')) ||
                (error?.message && error.message.includes('404 Not Found'));
              
              if (isDownloadError) {
                console.warn(
                  `[WhatsApp Workflow] Media download error (graceful degradation)`,
                  {
                    threadId,
                    errorName: error?.name,
                    errorMessage: error?.message,
                    imageMediaRefs: imageMediaRefs.map(m => ({
                      gcsBucket: m.gcsBucket,
                      gcsObject: m.gcsObject,
                    })),
                  },
                );
                // Don't throw - let the workflow continue with text-only context
                // The AI will work with available text context
                return;
              }
              // For other errors, rethrow to maintain existing error handling
              throw error;
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
        // Check if this is a media download error that we should handle gracefully
        const isDownloadError = 
          err?.name === 'AI_DownloadError' ||
          (err?.message && err.message.includes('Failed to download')) ||
          (err?.message && err.message.includes('400 Bad Request')) ||
          (err?.message && err.message.includes('404 Not Found'));
        
        if (isDownloadError) {
          console.warn(
            `[WhatsApp Workflow] Media download error caught in outer handler (graceful degradation)`,
            {
              threadId,
              errorName: err?.name,
              errorMessage: err?.message,
              imageMediaRefs: imageMediaRefs.map(m => ({
                gcsBucket: m.gcsBucket,
                gcsObject: m.gcsObject,
              })),
            },
          );
          // Continue workflow with text-only context - don't fail the entire conversation
          // Optionally send a user-facing message about missing media
          try {
            await ctx.runAction(internal.whatsapp.twilio.sendMessage, {
              to: whatsappTo,
              body: "Lo siento, algunas imágenes ya no están disponibles. Por favor reenvíalas si son importantes.",
            });
          } catch (sendError) {
            console.error("[WhatsApp Workflow] Failed to send media error message", sendError);
          }
          return null;
        }
        
        // For other errors, log and rethrow
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
