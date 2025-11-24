import { internal, api } from '../_generated/api';
import { internalAction } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Processes incoming WhatsApp messages from Twilio webhook
 * This internal action is called by the HTTP webhook handler
 * 
 * Note: This function doesn't use the Twilio SDK, so it doesn't need Node runtime.
 * For Twilio SDK calls, see whatsapp/twilio.ts
 */
export const processIncomingMessage = internalAction({
  args: {
    messageSid: v.string(),
    from: v.string(), // WhatsApp number (e.g., whatsapp:+1234567890)
    to: v.string(), // Your Twilio WhatsApp number
    body: v.string(), // Message content
    mediaItems: v.optional(v.array(v.object({
      url: v.string(),
      contentType: v.string(),
    }))), // Array of media items with URL and content type
    accountSid: v.string(),
    messageStatus: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      console.log('[WhatsApp] Processing incoming message:', {
        messageSid: args.messageSid,
        from: args.from,
        body: args.body?.substring(0, 100), // Log first 100 chars
        numMedia: args.mediaItems?.length || 0,
      });

      // Download and store media items if present
      const storedMedia: Array<{
        gcsBucket: string;
        gcsObject: string;
        contentType: string;
        size: number;
      }> = [];
      
      if (args.mediaItems && args.mediaItems.length > 0) {
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        if (!authToken) {
          console.error('[WhatsApp] Twilio auth token not configured, skipping media download');
        } else {
          for (const mediaItem of args.mediaItems) {
            try {
              const stored = await ctx.runAction(
                internal.agents.whatsapp.mediaUtils.downloadAndStoreTwilioMedia,
                {
                  mediaUrl: mediaItem.url,
                  contentType: mediaItem.contentType,
                  accountSid: args.accountSid,
                  authToken,
                },
              );
              storedMedia.push({
                gcsBucket: stored.gcsBucket,
                gcsObject: stored.gcsObject,
                contentType: stored.contentType,
                size: stored.size,
              });
              console.log('[WhatsApp] Media downloaded and stored in GCS:', {
                gcsBucket: stored.gcsBucket,
                gcsObject: stored.gcsObject,
                contentType: stored.contentType,
                size: stored.size,
              });
            } catch (error) {
              console.error('[WhatsApp] Error downloading media:', error);
              // Continue processing other media items even if one fails
            }
          }
        }
      }

      // Extract phone number from WhatsApp format (whatsapp:+1234567890)
      const phoneNumber = args.from.replace('whatsapp:', '');

      // Look up user by WhatsApp number
      const userResult = await ctx.runQuery(api.functions.users.getUserByWhatsappNumber, {
        phoneNumber: phoneNumber,
      });

      if (!userResult) {
        // Move message sending into workflow
        await ctx.scheduler.runAfter(
          0,
          internal.agents.whatsapp.workflow.handleUnlinkedWhatsapp,
          {
            to: args.from,
          },
        );
        return null;
      }

      const userId = userResult._id;

      // Check if user has premium access to WhatsApp agent
      const accessCheck = await ctx.runQuery(internal.billing.features.canAccessWhatsappInternal, {
        userId,
      });

      if (!accessCheck.allowed) {
        // User doesn't have premium access - send upgrade message
        await ctx.scheduler.runAfter(
          0,
          internal.agents.whatsapp.workflow.handlePremiumRequired,
          {
            to: args.from,
            reason: accessCheck.reason,
          },
        );
        return null;
      }

      // Create or get thread for this user (using user ID instead of phone number)
      const threadId =
        await ctx.runAction(
          internal.agents.whatsapp.threads.getOrCreateWhatsappThread,
          {
            userId,
          },
        );

      // Do NOT save message or send anything here; let workflow own it
      await ctx.scheduler.runAfter(
        0,
        internal.agents.whatsapp.workflow.startWorkflow,
        {
          threadId,
          prompt: args.body,
          twilioMessageId: args.messageSid,
          mediaItems: storedMedia.length > 0 ? storedMedia : undefined,
        },
      );

      return null;
    } catch (error) {
      console.error('[WhatsApp] Error processing message:', error);
      throw error;
    }
  },
});

