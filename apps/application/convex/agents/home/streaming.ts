import { paginationOptsValidator } from "convex/server";
import { listUIMessages, syncStreams, vStreamArgs, abortStream } from "@convex-dev/agent";
import { components } from "../../_generated/api";
import { query, mutation } from "../../_generated/server";
import { v } from "convex/values";
import { authorizeThreadAccess } from "../threads";

/**
 * Lists messages in a thread with streaming support.
 * 
 * This query returns both paginated messages and active streams for a thread.
 * It supports real-time streaming updates for the home agent.
 * Uses the optimized listUIMessages and syncStreams helpers for better performance.
 * 
 * @param threadId - The ID of the thread to list messages from
 * @param paginationOpts - Pagination options for the message list
 * @param streamArgs - Arguments for streaming message updates
 * @returns Promise resolving to paginated messages and active streams
 * @throws {Error} When user doesn't have access to the thread
 */
export const listMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, args) => {
    const { threadId, streamArgs } = args;
    await authorizeThreadAccess(ctx, threadId);
    
    const streams = await syncStreams(ctx, components.agent, {
      threadId,
      streamArgs,
    });

    const paginated = await listUIMessages(ctx, components.agent, args);

    return {
      ...paginated,
      streams,
    };
  },
});

/**
 * Aborts a stream by its order number within a thread.
 * 
 * This mutation allows users to cancel ongoing AI streaming responses
 * by specifying the stream's order in the thread.
 * 
 * @param threadId - The ID of the thread containing the stream
 * @param order - The order number of the stream to abort
 * @throws {Error} When user doesn't have access to the thread
 */
export const abortStreamByOrder = mutation({
  args: { threadId: v.string(), order: v.number() },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, { threadId, order }) => {
    try {
      // Verify user has access to this thread
      await authorizeThreadAccess(ctx, threadId);
      
      console.log(`[Home Agent Abort Request] Thread ${threadId}, Order ${order}: Attempting to abort stream`);
      
      // Attempt to abort the stream
      const aborted = await abortStream(ctx, components.agent, {
        threadId,
        order,
        reason: "User requested abort",
      });
      
      if (aborted) {
        console.log(`[Home Agent Abort Success] Thread ${threadId}, Order ${order}: Stream successfully aborted`);
        return {
          success: true,
          message: "Stream aborted successfully",
        };
      } else {
        console.log(`[Home Agent Abort Not Found] Thread ${threadId}, Order ${order}: No active stream found to abort`);
        return {
          success: false,
          message: "No active stream found to abort",
        };
      }
    } catch (error) {
      const err = error as Error;
      console.error(`[Home Agent Abort Error] Thread ${threadId}, Order ${order}:`, {
        name: err?.name,
        message: err?.message,
        stack: err?.stack,
      });
      
      // Re-throw authorization errors
      if (err?.message?.includes("access") || err?.message?.includes("permission")) {
        throw error;
      }
      
      // For other errors, return failure status
      return {
        success: false,
        message: `Failed to abort stream: ${err?.message || 'Unknown error'}`,
      };
    }
  },
});
