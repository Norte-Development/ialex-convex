import { internalMutation } from '../_generated/server';
import { v } from 'convex/values';

/**
 * Processes incoming WhatsApp messages from Twilio webhook
 * This internal mutation is called by the HTTP webhook handler
 * 
 * Note: This function doesn't use the Twilio SDK, so it doesn't need Node runtime.
 * For Twilio SDK calls, see whatsapp/twilio.ts
 */
export const processIncomingMessage = internalMutation({
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

      // Placeholder: Log the message
      // You can replace this with actual storage/processing logic
      console.log('[WhatsApp] Message received:', {
        from: phoneNumber,
        content: args.body,
        timestamp: Date.now(),
      });

      return null;
    } catch (error) {
      console.error('[WhatsApp] Error processing message:', error);
      throw error;
    }
  },
});

