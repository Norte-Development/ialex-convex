import { WorkflowManager } from "@convex-dev/workflow";
import { components, internal } from "../_generated/api";
import { v } from "convex/values";
import { createThread, saveMessage } from "@convex-dev/agent";
import { agent } from "./agent";
import { internalAction, internalMutation, mutation } from "../_generated/server";
import { getCurrentUserFromAuth } from "../auth_utils";
import { authorizeThreadAccess } from "./threads";
import { ContextService } from "../context/contextService";
import { prompt } from "./prompt";
import { buildServerSchema } from "../../../../packages/shared/src/tiptap/schema";

const workflow = new WorkflowManager(components.workflow);

const vContextBundle = v.object({
  user: v.object({
    id: v.id("users"),
    name: v.string(),
    email: v.string(),
    role: v.optional(v.string()),
    specializations: v.optional(v.array(v.string())),
    firmName: v.optional(v.string()),
    experienceYears: v.optional(v.number()),
    teams: v.optional(
      v.array(
        v.object({
          id: v.id("teams"),
          name: v.string(),
          role: v.string(),
          joinedAt: v.number(),
        }),
      ),
    ),
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
    }),
  ),
  clients: v.array(
    v.object({
      id: v.id("clients"),
      name: v.string(),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      dni: v.optional(v.string()),
      cuit: v.optional(v.string()),
      clientType: v.union(v.literal("individual"), v.literal("company")),
      isActive: v.boolean(),
      role: v.optional(v.string()),
    }),
  ),
  currentView: v.object({
    currentPage: v.optional(v.string()),
    currentView: v.optional(v.string()),
    selectedItems: v.optional(v.array(v.string())),
    cursorPosition: v.optional(v.number()),
    searchQuery: v.optional(v.string()),
    currentEscritoId: v.optional(v.id("escritos")),
  }),
  recentActivity: v.array(
    v.object({
      action: v.string(),
      entityType: v.string(),
      entityId: v.optional(v.string()),
      timestamp: v.number(),
      metadata: v.optional(v.any()),
    }),
  ),
  rules: v.array(
    v.object({
      name: v.string(),
      description: v.string(),
      customInstructions: v.optional(v.string()),
      responseStyle: v.optional(v.string()),
      citationFormat: v.optional(v.string()),
    }),
  ),
  metadata: v.object({
    gatheredAt: v.number(),
    totalTokens: v.optional(v.number()),
    contextSources: v.array(v.string()),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
    ),
  }),
});

export const gatherContextForWorkflow = internalMutation({
  args: {
    userId: v.id("users"),
    caseId: v.optional(v.id("cases")),
    currentPage: v.optional(v.string()),
    currentView: v.optional(v.string()),
    selectedItems: v.optional(v.array(v.string())),
    cursorPosition: v.optional(v.number()),
    searchQuery: v.optional(v.string()),
    currentEscritoId: v.optional(v.id("escritos")),
  },
  returns: vContextBundle,
  handler: async (ctx, args) => {
    const viewContext = {
      currentPage: args.currentPage,
      currentView: args.currentView,
      selectedItems: args.selectedItems,
      cursorPosition: args.cursorPosition,
      searchQuery: args.searchQuery,
      currentEscritoId: args.currentEscritoId,
    };

    return await ContextService.gatherAutoContext(
      ctx,
      args.userId,
      args.caseId,
      viewContext,
    );
  },
});

export const legalAgentWorkflow = workflow.define({
  args: {
    userId: v.id("users"),
    threadId: v.string(),
    prompt: v.string(),
    caseId: v.optional(v.id("cases")),
    currentPage: v.optional(v.string()),
    currentView: v.optional(v.string()),
    selectedItems: v.optional(v.array(v.string())),
    cursorPosition: v.optional(v.number()),
    searchQuery: v.optional(v.string()),
    currentEscritoId: v.optional(v.id("escritos")),
  },
  handler: async (step, args): Promise<void> => {
    console.log("Starting legal agent workflow");
    const userMessage = await saveMessage(step, components.agent, {
        threadId: args.threadId,
        prompt: args.prompt,
      });

    const contextBundle = await step.runMutation(
      internal.agent.workflow.gatherContextForWorkflow,
      {
        userId: args.userId,
        caseId: args.caseId,
        currentPage: args.currentPage,
        currentView: args.currentView,
        selectedItems: args.selectedItems,
        cursorPosition: args.cursorPosition,
        searchQuery: args.searchQuery,
        currentEscritoId: args.currentEscritoId,
      },
    );

    await step.runAction(
      internal.agent.workflow.streamWithContextAction,
      {
        threadId: args.threadId,
        promptMessageId: userMessage.messageId,
        contextBundle,
      },
      { retry: true },
    );

    console.log("Legal agent workflow completed");
  },
});

export const streamWithContextAction = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    contextBundle: vContextBundle,
  },
  returns: v.null(),
  handler: async (ctx, { threadId, promptMessageId, contextBundle }) => {
    const contextString = ContextService.formatContextForAgent(contextBundle);

    const schema = buildServerSchema();
    const nodeSpecs: Array<string> = [];
    (schema.spec.nodes as any).forEach((nodeSpec: any, nodeName: string) => {
      const attrs = nodeSpec && nodeSpec.attrs ? Object.keys(nodeSpec.attrs) : [];
      nodeSpecs.push(
        `${nodeName}${
          attrs.length ? ` {attrs: ${attrs.join(", ")}}` : ""
        }`,
      );
    });
    const markSpecs: Array<string> = [];
    (schema.spec.marks as any).forEach((markSpec: any, markName: string) => {
      const attrs = markSpec && markSpec.attrs ? Object.keys(markSpec.attrs) : [];
      markSpecs.push(
        `${markName}${
          attrs.length ? ` {attrs: ${attrs.join(", ")}}` : ""
        }`,
      );
    });
    const schemaSummary = `ProseMirror Schema Summary\n- Nodes: ${nodeSpecs.join(", ")}\n- Marks: ${markSpecs.join(", ")}`;

    const systemMessage = `Sos el asistente legal IALEX. Aquí está el contexto actual:

      ${contextString}

      ---
      ${schemaSummary}
      ---

      Instrucciones:
      ${prompt}
    `;

    const { thread } = await agent.continueThread(ctx, { threadId });

    try {
      await thread.streamText(
        {
          system: systemMessage,
          promptMessageId,
          providerOptions: {
            openai: {
              reasoningEffort: "low",
              reasoningSummary: "auto",
            },
          },
          experimental_repairToolCall: async (...args: any[]) => {
            console.log("Tool call repair triggered:", args);
            return null;
          },
          onAbort: () => {
            console.log(`[Stream Abort Callback] Thread ${threadId}: Stream abort callback triggered`);
          },
          onError: (event) => {
            const error = event.error as Error;
            const errorName = error?.name || 'Unknown';
            const errorMessage = error?.message || String(error) || 'No message';
            const errorString = String(error).toLowerCase();
            
            // Check if this is an abort error (user cancelled the stream)
            if (
              errorName === "AbortError" || 
              errorMessage === "AbortError" ||
              errorMessage.toLowerCase().includes("abort") || 
              errorString.includes("abort")
            ) {
              console.log(`[Stream Abort in onError] Thread ${threadId}: Abort detected in error handler`);
              return; // Don't throw for user-initiated aborts
            }

            // Check for timeout errors
            if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
              console.error(`[Stream Timeout] Thread ${threadId}:`, errorMessage);
              return; // Don't throw for timeouts, let the catch handle it
            }

            // Check for network errors
            if (errorMessage.includes("network") || errorMessage.includes("ECONNRESET") || errorMessage.includes("ETIMEDOUT")) {
              console.error(`[Stream Network Error] Thread ${threadId}:`, errorMessage);
              return; // Don't throw for network errors, let the catch handle it
            }

            // Log other errors but don't throw (let the catch block handle them)
            console.error(`[Stream Error] Thread ${threadId}:`, {
              name: errorName,
              message: errorMessage,
              stack: error?.stack,
            });
          },
        },
        {
          saveStreamDeltas: {
            chunking: "word",
            throttleMs: 50,
          },
          contextOptions: {
            searchOtherThreads: true,
          },
        },
      );
      
      console.log(`[Stream Complete] Thread ${threadId}: Stream completed successfully`);
    } catch (error) {
      const err = error as Error;
      const errorName = err?.name || 'Unknown';
      const errorMessage = err?.message || 'No message';
      const errorString = String(error).toLowerCase();
      
      // Handle abort errors gracefully (user cancelled)
      // Check name, message, and string representation for abort-related keywords
      if (
        errorName === "AbortError" || 
        errorMessage === "AbortError" ||
        errorMessage.toLowerCase().includes("abort") || 
        errorString.includes("abort")
      ) {
        console.log(`[Stream Abort Caught] Thread ${threadId}: Stream was successfully aborted by user`);
        return null;
      }

      // Handle timeout errors
      if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
        console.error(`[Stream Timeout Caught] Thread ${threadId}: Stream timed out - ${errorMessage}`);
        // Don't re-throw timeout errors, return gracefully
        return null;
      }

      // Handle network errors
      if (errorMessage.includes("network") || errorMessage.includes("ECONNRESET") || errorMessage.includes("ETIMEDOUT")) {
        console.error(`[Stream Network Error Caught] Thread ${threadId}: Network error - ${errorMessage}`);
        // Don't re-throw network errors, return gracefully
        return null;
      }

      // For all other errors, log and re-throw
      console.error(`[Stream Fatal Error] Thread ${threadId}:`, {
        name: errorName,
        message: errorMessage,
        stack: err?.stack,
      });
      throw error;
    }

    return null;
  },
});

export const initiateWorkflowStreaming = mutation({
  args: {
    prompt: v.string(),
    threadId: v.string(),
    caseId: v.optional(v.id("cases")),
    currentPage: v.optional(v.string()),
    currentView: v.optional(v.string()),
    selectedItems: v.optional(v.array(v.string())),
    cursorPosition: v.optional(v.number()),
    searchQuery: v.optional(v.string()),
    currentEscritoId: v.optional(v.id("escritos")),
  },
  returns: v.object({
    workflowId: v.string(),
    threadId: v.string(),
  }),
  handler: async (ctx, args): Promise<{workflowId: string, threadId: string}> => {
    const user = await getCurrentUserFromAuth(ctx);

    let threadId = args.threadId;
    if (!threadId) {
      threadId = await createThread(ctx, components.agent, {
        userId: user._id,
        title: "Legal Agent Conversation",
      });
    } else {
      await authorizeThreadAccess(ctx, threadId);
    }

    const workflowId = await workflow.start(
      ctx,
      internal.agent.workflow.legalAgentWorkflow,
      {
        userId: user._id,
        threadId,
        prompt: args.prompt,
        caseId: args.caseId,
        currentPage: args.currentPage,
        currentView: args.currentView,
        selectedItems: args.selectedItems,
        cursorPosition: args.cursorPosition,
        searchQuery: args.searchQuery,
        currentEscritoId: args.currentEscritoId,
      },
    );

    return { workflowId, threadId };
  },
});
