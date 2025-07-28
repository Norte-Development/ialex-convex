// See the docs at https://docs.convex.dev/agents/messages
import { v } from "convex/values";
import { components } from "../_generated/api";
import {
  query,
  action,
  mutation,
  internalMutation,
} from "../_generated/server";
import { abortStream, listStreams } from "@convex-dev/agent";
import { agent } from "./agent";
import { smoothStream } from "ai";
import { authorizeThreadAccess } from "./threads";

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
  handler: async (ctx, { threadId, order }) => {
    await authorizeThreadAccess(ctx, threadId);
    if (
      await abortStream(ctx, components.agent, {
        threadId,
        order,
        reason: "Aborting explicitly",
      })
    ) {
      console.log("Aborted stream", threadId, order);
    } else {
      console.log("No stream found", threadId, order);
    }
  },
});

/**
 * Test action that demonstrates streaming and aborting functionality.
 * 
 * This action creates a new thread, starts streaming a response, and then
 * immediately aborts it to demonstrate the abort functionality.
 * 
 * NOTE: This is a test/demo function and should not be used in production.
 */
export const streamThenAbortAsync = action({
  args: {},
  handler: async (ctx) => {
    const { thread, threadId } = await agent.createThread(ctx, {
      title: "Thread with aborted message",
    });
    const result = await thread.streamText(
      {
        prompt: "Write an essay on the importance of effusive dialogue",
        experimental_transform: smoothStream({ chunking: "line" }),
        onError: (error) => {
          console.error(error);
        },
      },
      { saveStreamDeltas: { chunking: "line" } },
    );
    let canceled = false;
    try {
      for await (const chunk of result.textStream) {
        console.log(chunk);
        if (!canceled) {
          await abortStream(ctx, components.agent, {
            threadId,
            order: result.order,
            reason: "Aborting explicitly",
          });
          canceled = true;
        }
      }
    } catch (error) {
      console.warn("Catching what should be an AbortError", error);
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

/**
 * Demonstrates streaming with abort signal functionality.
 * 
 * This action creates a thread and starts streaming, then uses an AbortController
 * to cancel the stream after 1 second. This demonstrates how to use the
 * abortSignal parameter for programmatic stream cancellation.
 * 
 * NOTE: This is a test/demo function and should not be used in production.
 */
export const streamThenUseAbortSignal = action({
  args: {},
  handler: async (ctx) => {
    const { thread } = await agent.createThread(ctx, {
      title: "Thread using abortSignal",
    });
    const abortController = new AbortController();
    const result = await thread.streamText(
      {
        prompt: "Write an essay on the importance of effusive dialogue",
        abortSignal: abortController.signal,
        experimental_transform: smoothStream({ chunking: "line" }),
      },
      { saveStreamDeltas: { chunking: "line" } },
    );
    setTimeout(() => {
      abortController.abort();
    }, 1000);
    try {
      for await (const chunk of result.textStream) {
        console.log(chunk);
      }
    } catch (error) {
      console.warn("Catching what should be an AbortError", error);
    }
    await result.consumeStream();
  },
});