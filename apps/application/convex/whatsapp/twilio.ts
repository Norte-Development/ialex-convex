'use node'

import { Twilio } from 'twilio';
import { internalMutation } from '../_generated/server';
import { v } from 'convex/values';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new Twilio(accountSid, authToken);

/**
 * Processes incoming WhatsApp messages from Twilio webhook
 * This internal mutation is called by the HTTP webhook handler
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

/**
 * Sends a WhatsApp message using Twilio
 */
export const sendMessage = internalMutation({
  args: {
    to: v.string(), // WhatsApp number (e.g., +1234567890 or whatsapp:+1234567890)
    body: v.string(), // Message content
    from: v.optional(v.string()), // Optional: specific Twilio number to use
  },
  returns: v.object({
    messageSid: v.string(),
    status: v.string(),
  }),
  handler: async (ctx, args) => {
    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured');
    }

    // Ensure phone number is in correct format
    const toNumber = args.to.startsWith('whatsapp:')
      ? args.to
      : `whatsapp:${args.to}`;

    // Use default Twilio WhatsApp number or specified one
    const fromNumber = args.from || process.env.TWILIO_WHATSAPP_NUMBER;
    if (!fromNumber) {
      throw new Error('Twilio WhatsApp number not configured');
    }

    try {
      const message = await client.messages.create({
        body: args.body,
        from: fromNumber.startsWith('whatsapp:')
          ? fromNumber
          : `whatsapp:${fromNumber}`,
        to: toNumber,
      });

      console.log('[WhatsApp] Message sent:', {
        messageSid: message.sid,
        to: toNumber,
        status: message.status,
      });

      return {
        messageSid: message.sid,
        status: message.status,
      };
    } catch (error) {
      console.error('[WhatsApp] Error sending message:', error);
      throw error;
    }
  },
});

