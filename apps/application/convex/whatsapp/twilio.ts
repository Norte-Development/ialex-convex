'use node'

import { Twilio } from 'twilio';
import { internalAction } from '../_generated/server';
import { v } from 'convex/values';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new Twilio(accountSid, authToken);

/**
 * Sends a WhatsApp message using Twilio
 * 
 * Note: This function uses the Twilio SDK and requires Node runtime.
 * For non-SDK message processing, see whatsapp/whatsapp.ts
 */
export const sendMessage = internalAction({
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

