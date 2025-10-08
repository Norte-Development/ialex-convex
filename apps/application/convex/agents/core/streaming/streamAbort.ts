// See the docs at https://docs.convex.dev/agents/messages
import { v } from "convex/values";
import { components } from "../../../_generated/api";
import {
  query,
  mutation,
  internalMutation,
} from "../../../_generated/server";
import { abortStream, listStreams } from "@convex-dev/agent";
import { authorizeThreadAccess } from "../../threads";

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
      
      console.log(`[Abort Request] Thread ${threadId}, Order ${order}: Attempting to abort stream`);
      
      // Attempt to abort the stream
      const aborted = await abortStream(ctx, components.agent, {
        threadId,
        order,
        reason: "User requested abort",
      });
      
      if (aborted) {
        console.log(`[Abort Success] Thread ${threadId}, Order ${order}: Stream successfully aborted`);
        return {
          success: true,
          message: "Stream aborted successfully",
        };
      } else {
        console.log(`[Abort Not Found] Thread ${threadId}, Order ${order}: No active stream found to abort`);
        return {
          success: false,
          message: "No active stream found to abort",
        };
      }
    } catch (error) {
      const err = error as Error;
      console.error(`[Abort Error] Thread ${threadId}, Order ${order}:`, {
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


/**
 * Lists all active streams for a given thread.
 * 
 * This query returns information about all streams (active, aborted, completed)
 * associated with a specific thread.
 * 
 * @param threadId - The ID of the thread to list streams for
 * @returns Promise resolving to an array of stream information
 */
export const list = query({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    return listStreams(ctx, components.agent, { threadId });
  },
});

/**
 * Aborts all streams in a thread by their stream IDs.
 * 
 * This internal mutation finds all active streams in a thread and aborts them.
 * It's typically used for cleanup operations or when a thread is being deleted.
 * 
 * @param threadId - The ID of the thread to abort all streams in
 */
export const abortStreamByStreamId = internalMutation({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    const streams = await listStreams(ctx, components.agent, { threadId });
    for (const stream of streams) {
      console.log("Aborting stream", stream);
      await abortStream(ctx, components.agent, {
        reason: "Aborting via async call",
        streamId: stream.streamId,
      });
    }
    if (!streams.length) {
      console.log("No streams found");
    }
  },
});
