import { internalAction, internalMutation, internalQuery } from "../../_generated/server";
import { v } from "convex/values";
import { agent } from "./agent";
import { components, internal as internalApi } from "../../_generated/api";
import { Id } from "../../_generated/dataModel";

/**
 * Internal query to check if a thread exists for a user ID.
 */
export const getWhatsappThreadByUserId = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<string | null> => {
    const threadUserId = `whatsapp:${args.userId}`;
    const existingThreads = await ctx.runQuery(
      components.agent.threads.listThreadsByUserId,
      {
        userId: threadUserId,
        paginationOpts: { numItems: 1, cursor: null },
      },
    );

    return existingThreads.page.length > 0 ? existingThreads.page[0]._id : null;
  },
});

/**
 * Internal mutation to create a WhatsApp thread for a user ID.
 */
export const createWhatsappThread = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<string> => {
    const threadUserId = `whatsapp:${args.userId}`;
    const thread = await agent.createThread(ctx, {
      userId: threadUserId,
      title: `WhatsApp:${args.userId}`,
    });

    return thread.threadId;
  },
});

/**
 * Gets or creates a WhatsApp thread for a user ID.
 * Each user should have exactly one persistent WhatsApp thread.
 *
 * @param userId - The user ID to get or create a thread for
 * @returns Promise resolving to the thread ID
 */
export const getOrCreateWhatsappThread = internalAction({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<string> => {
    // Check if a thread already exists for this user
    const existingThreadId: string | null = await ctx.runQuery(
      internalApi.agents.whatsapp.threads.getWhatsappThreadByUserId,
      {
        userId: args.userId,
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
        userId: args.userId,
      },
    );

    return threadId;
  },
});