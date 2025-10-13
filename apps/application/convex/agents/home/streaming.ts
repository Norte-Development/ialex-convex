import { paginationOptsValidator } from "convex/server";
import { vStreamArgs } from "@convex-dev/agent";
import { query } from "../../_generated/server";
import { v } from "convex/values";
import { authorizeThreadAccess } from "../threads";
import { agent } from "./agent";

/**
 * Lists messages in a thread with streaming support.
 * 
 * This query returns both paginated messages and active streams for a thread.
 * It supports real-time streaming updates for the home agent.
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
    const { threadId, paginationOpts, streamArgs } = args;
    
    console.log(`[HOME STREAMING] listMessages called for thread: ${threadId}`);
    console.log(`[HOME STREAMING] paginationOpts:`, paginationOpts);
    console.log(`[HOME STREAMING] streamArgs:`, streamArgs);
    
    await authorizeThreadAccess(ctx, threadId);
    console.log(`[HOME STREAMING] Authorization passed`);
    
    const paginated = await agent.listMessages(ctx, {
      threadId,
      paginationOpts,
    });
    
    const messagesCount = paginated?.page?.length || 0;
    console.log(`[HOME STREAMING] Messages fetched: ${messagesCount} messages`);
    console.log(`[HOME STREAMING] isDone:`, paginated?.isDone);
    console.log(`[HOME STREAMING] Paginated structure:`, JSON.stringify(paginated, null, 2));

    const streams = await agent.syncStreams(ctx, {
      threadId,
      streamArgs,
      includeStatuses: ["aborted", "streaming"],
    });
    
    const streamsArray = Array.isArray(streams) ? streams : [];
    console.log(`[HOME STREAMING] Streams synced: ${streamsArray.length} active streams`);
    
    if (streamsArray.length > 0) {
      streamsArray.forEach((stream: any, idx: number) => {
        console.log(`[HOME STREAMING] Stream ${idx}:`, {
          messageId: stream.messageId,
          status: stream.status,
          hasDeltas: !!stream.deltas,
          deltasCount: stream.deltas?.length || 0,
        });
      });
    }

    const result = {
      ...paginated,
      streams,
    };
    
    const resultMessagesCount = result?.page?.length || 0;
    console.log(`[HOME STREAMING] Returning result with ${resultMessagesCount} messages and ${streamsArray.length} streams`);

    return result;
  },
});
