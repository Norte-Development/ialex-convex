import { paginationOptsValidator } from "convex/server";
import { vStreamArgs } from "@convex-dev/agent";
import { internal } from "../../_generated/api";
import {
  internalAction,
  mutation,
  query,
} from "../../_generated/server";
import { v } from "convex/values";
import { authorizeThreadAccess } from "../threads";
import { agent } from "./agent";
import { ContextService } from "../../services/context/contextService";
import {prompt} from "./prompt";
import { buildServerSchema } from "../../../../../packages/shared/src/tiptap/schema";

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
    args: {
      prompt: v.string(),
      threadId: v.string(),
      userId: v.id("users"),
      caseId: v.optional(v.id("cases")),
      currentPage: v.optional(v.string()),
      currentView: v.optional(v.string()),
      selectedItems: v.optional(v.array(v.string())),
      cursorPosition: v.optional(v.number()),
      searchQuery: v.optional(v.string()),
      currentEscritoId: v.optional(v.id("escritos")),
    },
    handler: async (ctx, args) => {
      await authorizeThreadAccess(ctx, args.threadId);

      // Gather rich context using ContextService
      const viewContext = {
        currentPage: args.currentPage,
        currentView: args.currentView,
        selectedItems: args.selectedItems,
        cursorPosition: args.cursorPosition,
        searchQuery: args.searchQuery,
        currentEscritoId: args.currentEscritoId,
      };

      const contextBundle = await ContextService.gatherAutoContext(
        ctx,
        args.userId,
        args.caseId,
        viewContext
      );


      const { messageId } = await agent.saveMessage(ctx, {
        threadId: args.threadId,
        prompt: args.prompt,
        // we're in a mutation, so skip embeddings for now. They'll be generated
        // lazily when streaming text.
        skipEmbeddings: true,
      });

      await ctx.scheduler.runAfter(0, internal.agents.case.streaming.streamAsync, {
        threadId: args.threadId,
        promptMessageId: messageId,
        contextBundle,
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
    args: {
      promptMessageId: v.string(),
      threadId: v.string(),
      contextBundle: v.object({
        user: v.object({
          id: v.id("users"),
          name: v.string(),
          email: v.string(),
          role: v.optional(v.string()),
          specializations: v.optional(v.array(v.string())),
          firmName: v.optional(v.string()),
          experienceYears: v.optional(v.number()),
          teams: v.optional(v.array(v.object({
            id: v.id("teams"),
            name: v.string(),
            role: v.string(),
            joinedAt: v.number(),
          }))),
        }),
        case: v.union(
          v.null(),
          v.object({
            id: v.id("cases"),
            title: v.string(),
            description: v.optional(v.string()),
            status: v.string(),
            priority: v.string(),
            category: v.optional(v.string()),
            startDate: v.number(),
            endDate: v.optional(v.number()),
            assignedLawyer: v.id("users"),
            createdBy: v.id("users"),
            isArchived: v.boolean(),
            tags: v.optional(v.array(v.string())),
          })
        ),
        clients: v.array(v.object({
          id: v.id("clients"),
          name: v.string(),
          email: v.optional(v.string()),
          phone: v.optional(v.string()),
          dni: v.optional(v.string()),
          cuit: v.optional(v.string()),
          clientType: v.union(v.literal("individual"), v.literal("company")),
          isActive: v.boolean(),
          role: v.optional(v.string()),
        })),
        currentView: v.object({
          currentPage: v.optional(v.string()),
          currentView: v.optional(v.string()),
          selectedItems: v.optional(v.array(v.string())),
          cursorPosition: v.optional(v.number()),
          searchQuery: v.optional(v.string()),
          currentEscritoId: v.optional(v.id("escritos")),
        }),
        recentActivity: v.array(v.object({
          action: v.string(),
          entityType: v.string(),
          entityId: v.optional(v.string()),
          timestamp: v.number(),
          metadata: v.optional(v.any()),
        })),
        rules: v.array(v.object({
          name: v.string(),
          description: v.string(),
          customInstructions: v.optional(v.string()),
          responseStyle: v.optional(v.string()),
          citationFormat: v.optional(v.string()),
        })),
        metadata: v.object({
          gatheredAt: v.number(),
          totalTokens: v.optional(v.number()),
          contextSources: v.array(v.string()),
          priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
        }),
      }),
    },
    handler: async (ctx, { promptMessageId, threadId, contextBundle }) => {
      const { thread } = await agent.continueThread(ctx, { threadId });

      // Format the rich context into a system message
      const contextString = ContextService.formatContextForAgent(contextBundle);

      // Build ProseMirror schema summary at runtime and append to system message
      const schema = buildServerSchema();
      const nodeSpecs: Array<string> = [];
      (schema.spec.nodes as any).forEach((name: string, spec: any) => {
        const attrs = spec && spec.attrs ? Object.keys(spec.attrs) : [];
        nodeSpecs.push(`${name}${attrs.length ? ` {attrs: ${attrs.join(", ")}}` : ""}`);
      });
      const markSpecs: Array<string> = [];
      (schema.spec.marks as any).forEach((name: string, spec: any) => {
        const attrs = spec && spec.attrs ? Object.keys(spec.attrs) : [];
        markSpecs.push(`${name}${attrs.length ? ` {attrs: ${attrs.join(", ")}}` : ""}`);
      });
      const schemaSummary = `ProseMirror Schema Summary\n- Nodes: ${nodeSpecs.join(", ")}\n- Marks: ${markSpecs.join(", ")}`;
      console.log("schemaSummary", schemaSummary);
      const systemMessage = `Sos el asistente legal IALEX. Aquí está el contexto actual:

          ${contextString}

          ---
          ${schemaSummary}
          ---

          Instrucciones:
          ${prompt}

`;

      try {
        const result = await thread.streamText(
          {
            system: systemMessage,
            promptMessageId,

            providerOptions: {
              openai: {
                reasoningEffort: 'low',
                reasoningSummary: "auto"
              },
            },
           
            experimental_repairToolCall: async (...args: any[]) => {
              console.log("Tool call repair triggered:", args);
              return null; // Allow repair by returning null
            },
            onError: (error) => {
              // Handle AbortError gracefully - this is expected when user cancels the stream
              if ((error as any)?.name === 'AbortError' || (error as any)?.message?.includes('aborted')) {
                console.log("Stream was aborted by user");
                return;
              }
              console.error("Error streaming text", error);
              return;
              // throw error;
            },
          },
          // more custom delta options (`true` uses defaults)
          {
            saveStreamDeltas: {
              chunking: "word",
              throttleMs: 100,
            },
            contextOptions: {
              searchOtherThreads: true,
            },

          },
        );
        // Don't return anything - the streaming is handled automatically
        // The result object is used internally by the Convex Agent system
      } catch (error) {
        // Handle any uncaught errors, including AbortError
        if ((error as any)?.name === 'AbortError' || (error as any)?.message?.includes('aborted')) {
          console.log("Stream was aborted by user (caught in try-catch)");
          return;
        }
        console.error("Uncaught error in streamText:", error);
        throw error; // Re-throw non-abort errors
      }
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
      
      // Here you could filter out / modify the stream of deltas / filter out
      // deltas.
  
      const paginated = await agent.listMessages(ctx, {
        threadId,
        paginationOpts,
      });

      const streams = await agent.syncStreams(ctx, {
        threadId,
        streamArgs,
        includeStatuses: ["aborted", "streaming"],
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