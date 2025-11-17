'use node'

import { Twilio } from 'twilio';
import { internalAction } from '../_generated/server';
import { v } from 'convex/values';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new Twilio(accountSid, authToken);

const MAX_MESSAGE_LENGTH = 1200;

/**
 * Chunks a message into parts of maximum length, splitting at word boundaries when possible
 */
function chunkMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    // Try to find the last space before the max length
    let splitIndex = maxLength;
    const lastSpaceIndex = remaining.lastIndexOf(' ', maxLength);
    
    // If we found a space within reasonable distance (within 50 chars), use it
    if (lastSpaceIndex > maxLength - 50) {
      splitIndex = lastSpaceIndex;
    }
    // If no space found or too far, try to find a newline
    else {
      const lastNewlineIndex = remaining.lastIndexOf('\n', maxLength);
      if (lastNewlineIndex > maxLength - 50) {
        splitIndex = lastNewlineIndex;
      }
    }

    // Extract chunk and remove leading whitespace from remaining
    chunks.push(remaining.substring(0, splitIndex).trim());
    remaining = remaining.substring(splitIndex).trim();
  }

  // Add the remaining text as the last chunk
  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

/**
 * Sends a WhatsApp message using Twilio
 * Automatically chunks messages longer than 1200 characters into multiple messages
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

    // Chunk the message if it exceeds the limit
    const chunks = chunkMessage(args.body, MAX_MESSAGE_LENGTH);

    try {
      // Send all chunks sequentially
      let lastMessageSid = '';
      let lastStatus = '';

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const message = await client.messages.create({
          body: chunk,
          from: fromNumber.startsWith('whatsapp:')
            ? fromNumber
            : `whatsapp:${fromNumber}`,
          to: toNumber,
        });

        lastMessageSid = message.sid;
        lastStatus = message.status;

        console.log(`[WhatsApp] Message chunk ${i + 1}/${chunks.length} sent:`, {
          messageSid: message.sid,
          to: toNumber,
          status: message.status,
          chunkLength: chunk.length,
        });
      }

      return {
        messageSid: lastMessageSid,
        status: lastStatus,
      };
    } catch (error) {
      console.error('[WhatsApp] Error sending message:', error);
      throw error;
    }
  },
});



/**
 * Sends a typing indicator to WhatsApp via Twilio
 * 
 * Typing indicators signal to WhatsApp users that a response is being prepared.
 * The indicator automatically disappears after 25 seconds or when a response is delivered.
 * 
 * Note: This is a Public Beta feature and may change before GA.
 * Not HIPAA-eligible or PCI-compliant.
 */
export const setTypingIndicator = internalAction({
  args: {
    messageId: v.string(), // Twilio Message SID (starting with SM) or Media SID (starting with MM)
    active: v.boolean(), // If false, the function returns without sending the indicator
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.active) {
      // Typing indicators can't be explicitly turned off via API,
      // they automatically disappear after 25 seconds or when response is delivered
      return null;
    }

    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured');
    }

    // Validate messageId format (should start with SM or MM)
    if (!args.messageId.match(/^(SM|MM)[a-zA-Z0-9]{32}$/)) {
      throw new Error('Invalid messageId format. Must be a Twilio Message SID (SM...) or Media SID (MM...)');
    }

    try {
      // Make POST request to Twilio Typing Indicator API
      const url = 'https://messaging.twilio.com/v2/Indicators/Typing.json';
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      
      const formData = new URLSearchParams();
      formData.append('messageId', args.messageId);
      formData.append('channel', 'whatsapp');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[WhatsApp] Error sending typing indicator:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(`Failed to send typing indicator: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[WhatsApp] Typing indicator sent:', {
        messageId: args.messageId,
        success: result.success,
      });

      return null;
    } catch (error) {
      console.error('[WhatsApp] Error sending typing indicator:', error);
      throw error;
    }
  },
});

