import { internalAction, internalMutation, internalQuery } from "../../_generated/server";
import { v } from "convex/values";
import { agent } from "./agent";
import { components, internal as internalApi } from "../../_generated/api";

/**
 * Internal query to check if a thread exists for a phone number.
 */
export const getWhatsappThreadByPhoneNumber = internalQuery({
  args: {
    phoneNumber: v.string(),
  },
  handler: async (ctx, args): Promise<string | null> => {
    const existingThreads = await ctx.runQuery(
      components.agent.threads.listThreadsByUserId,
      {
        userId: args.phoneNumber,
        paginationOpts: { numItems: 1, cursor: null },
      },
    );

    return existingThreads.page.length > 0 ? existingThreads.page[0]._id : null;
  },
});

/**
 * Internal mutation to create a WhatsApp thread for a phone number.
 */
export const createWhatsappThread = internalMutation({
  args: {
    phoneNumber: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const thread = await agent.createThread(ctx, {
      userId: args.phoneNumber,
      title: args.phoneNumber,
    });

    return thread.threadId;
  },
});

/**
 * Gets or creates a WhatsApp thread for a phone number.
 * Each phone number should have exactly one persistent thread.
 *
 * @param phoneNumber - The phone number to get or create a thread for
 * @returns Promise resolving to the thread ID
 */
export const getOrCreateWhatsappThread = internalAction({
  args: {
    phoneNumber: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    // Check if a thread already exists for this phone number
    const existingThreadId: string | null = await ctx.runQuery(
      internalApi.agents.whatsapp.threads.getWhatsappThreadByPhoneNumber,
      {
        phoneNumber: args.phoneNumber,
      },
    );

    // If a thread exists, return its threadId
    if (existingThreadId) {
      return existingThreadId;
    }

    // If no thread exists, create a new one via mutation
    const threadId: string = await ctx.runMutation(
      internalApi.agents.whatsapp.threads.createWhatsappThread as any,
      {
        phoneNumber: args.phoneNumber,
      },
    );

    return threadId;
  },
});