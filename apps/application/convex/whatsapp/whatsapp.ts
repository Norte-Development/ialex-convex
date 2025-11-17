import { internal } from '../_generated/api';
import { internalAction } from '../_generated/server';
import { v } from 'convex/values';
import { agent } from '../agents/whatsapp/agent';

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
    numMedia: v.optional(v.string()), // Number of media attachments
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
        numMedia: args.numMedia,
      });

      // Extract phone number from WhatsApp format (whatsapp:+1234567890)
      const phoneNumber = args.from.replace('whatsapp:', '');

      // TODO: Implement your message processing logic here
      // Examples:
      // - Store message in database
      // - Look up user by phone number
      // - Route message to appropriate case/conversation
      // - Trigger AI agent response
      // - Send notifications
      const threadId = await ctx.runAction(internal.agents.whatsapp.threads.getOrCreateWhatsappThread, {
        phoneNumber: phoneNumber,
      });

      const { messageId } = await agent.saveMessage(ctx, {
        threadId,
        prompt: args.body,
      });

      await ctx.scheduler.runAfter(0, internal.agents.whatsapp.workflow.startWorkflow, {
        threadId,
        promptMessageId: messageId,
        twilioMessageId: args.messageSid,
      });
    } catch (error) {
      console.error('[WhatsApp] Error processing message:', error);
      throw error;
    }
  },
});

