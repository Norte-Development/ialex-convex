import { paginationOptsValidator } from "convex/server";
import { vStreamArgs } from "@convex-dev/agent";
import { internal } from "../_generated/api";
import {
  action,
  httpAction,
  internalAction,
  mutation,
  query,
} from "../_generated/server";
import { v } from "convex/values";
import { authorizeThreadAccess } from "./threads";
import { agent } from "./agent";

/**
 * Initiates asynchronous streaming for a message in a thread.
 * 
 * This mutation saves the user's message and schedules an asynchronous
 * streaming response from the AI agent. The streaming is handled in a
 * separate action to avoid blocking the mutation.
 * 
 * @param prompt - The user's message to send to the AI agent
 * @param threadId - The ID of the thread to add the message to
 * @throws {Error} When user doesn't have access to the thread
 */
export const initiateAsyncStreaming = mutation({
    args: { prompt: v.string(), threadId: v.string(), caseContext: v.object({
      caseId: v.string(),
      currentEscritoId: v.optional(v.id("escritos")),
      cursorPosition: v.optional(v.number()),
    }) },
    handler: async (ctx, { prompt, threadId, caseContext }) => {
      await authorizeThreadAccess(ctx, threadId);
      const { messageId } = await agent.saveMessage(ctx, {
        threadId,
        prompt,
        // we're in a mutation, so skip embeddings for now. They'll be generated
        // lazily when streaming text.
        skipEmbeddings: true,
      });
      await ctx.scheduler.runAfter(0, internal.agent.streaming.streamAsync, {
        threadId,
        promptMessageId: messageId,
        caseContext,
      });
    },
  });

/**
 * Internal action that handles the actual streaming of AI responses.
 * 
 * This action is scheduled by initiateAsyncStreaming and runs asynchronously
 * to generate and stream the AI's response to the user's message.
 * 
 * @param promptMessageId - The ID of the user's message that triggered the stream
 * @param threadId - The ID of the thread containing the conversation
 */
export const streamAsync = internalAction({
    args: { promptMessageId: v.string(), threadId: v.string(), caseContext: v.object({
      caseId: v.string(),
      currentEscritoId: v.optional(v.id("escritos")),
      cursorPosition: v.optional(v.number()),
    }) },
    handler: async (ctx, { promptMessageId, threadId, caseContext }) => {
      const { thread } = await agent.continueThread(ctx, { threadId });
      const result = await thread.streamText(
        { 
          system: `Sos un asistente de derecho. Estas en el caso ${caseContext.caseId}. El escrito actual es ${caseContext.currentEscritoId}. El cursor esta en la posicion ${caseContext.cursorPosition}.`,
          promptMessageId,  
          maxSteps: 25,
          onError: (error) => {
            console.error("Error streaming text", error);
            // throw error;
          },
           },
        // more custom delta options (`true` uses defaults)
        { saveStreamDeltas: { chunking: "word", throttleMs: 100 },
          contextOptions: {
            searchOtherThreads: true,
          }
       },
      );
      // We need to make sure the stream finishes - by awaiting each chunk
      // or using this call to consume it all.
      await result.consumeStream();
    },
  });

/**
 * Lists messages in a thread with streaming support.
 * 
 * This query returns both paginated messages and active streams for a thread.
 * It supports real-time streaming updates and can filter messages based on
 * various criteria.
 * 
 * @param threadId - The ID of the thread to list messages from
 * @param paginationOpts - Pagination options for the message list
 * @param streamArgs - Arguments for streaming message updates
 * @returns Promise resolving to paginated messages and active streams
 * @throws {Error} When user doesn't have access to the thread
 */
export const listMessages = query({
    args: {
      // These arguments are required:
      threadId: v.string(),
      paginationOpts: paginationOptsValidator, // Used to paginate the messages.
      streamArgs: vStreamArgs, // Used to stream messages.
    },
    handler: async (ctx, args) => {
      const { threadId, paginationOpts, streamArgs } = args;
      await authorizeThreadAccess(ctx, threadId);
      const streams = await agent.syncStreams(ctx, {
        threadId,
        streamArgs,
        includeStatuses: ["aborted", "streaming"],
      });
      // Here you could filter out / modify the stream of deltas / filter out
      // deltas.
  
      const paginated = await agent.listMessages(ctx, {
        threadId,
        paginationOpts,
      });
  
      // Here you could filter out metadata that you don't want from any optional
      // fields on the messages.
      // You can also join data onto the messages. They need only extend the
      // MessageDoc type.
      // { ...messages, page: messages.page.map(...)}
  
      return {
        ...paginated,
        streams,
  
        // ... you can return other metadata here too.
        // note: this function will be called with various permutations of delta
        // and message args, so returning derived data .
      };
    },
  });