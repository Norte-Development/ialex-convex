import { paginationOptsValidator } from "convex/server";
import { listUIMessages, syncStreams, vStreamArgs } from "@convex-dev/agent";
import { components } from "../../_generated/api";
import { query } from "../../_generated/server";
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
