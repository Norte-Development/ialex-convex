import { WorkflowManager } from "@convex-dev/workflow";
import { components, internal, api } from "../../_generated/api";
import { v } from "convex/values";
import { saveMessage } from "@convex-dev/agent";
import { agent } from "./agent";
import { internalAction, internalMutation, mutation } from "../../_generated/server";
import { getCurrentUserFromAuth } from "../../auth_utils";
import { authorizeThreadAccess } from "../threads";
import { ContextService } from "../../context/contextService";
import { prompt } from "./prompt";
import { Id } from "../../_generated/dataModel";
import { buildServerSchema } from "../../../../../packages/shared/src/tiptap/schema";
import { _getUserPlan, _getOrCreateUsageLimits, _getModelForUserInCase } from "../../billing/features";
import { PLAN_LIMITS } from "../../billing/planLimits";
import { openai } from "@ai-sdk/openai";
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const workflow = new WorkflowManager(components.workflow);

const vSelectionMeta = v.optional(v.object({
  content: v.string(),
  position: v.object({
    line: v.number(),
    column: v.number(),
  }),
  range: v.object({
    from: v.number(),
    to: v.number(),
  }),
  escritoId: v.id("escritos"),
}));

const vResolvedReference = v.object({
  type: v.union(
    v.literal("client"),
    v.literal("document"), 
    v.literal("escrito"),
    v.literal("case")
  ),
  id: v.string(),
  name: v.string(),
  originalText: v.string(),
  selection: vSelectionMeta,
});

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
    preferences: v.optional(v.object({
      agentResponseStyle: v.optional(v.string()),
      defaultJurisdiction: v.optional(v.string()),
      citationFormat: v.optional(v.string()),
      language: v.optional(v.string()),
    })),
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
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      dni: v.optional(v.string()),
      cuit: v.optional(v.string()),
      clientType: v.optional(v.union(v.literal("individual"), v.literal("company"))),
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
    currentDocumentId: v.optional(v.id("documents")),
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
  caseDocuments: v.array(
    v.object({
      name: v.string(),
      id: v.string(),
      type: v.optional(v.string()),
    }),
  ),
  resolvedReferences: v.optional(v.array(vResolvedReference)),
  openedEscrito: v.optional(v.object({
    id: v.id("escritos"),
    title: v.string(),
    contentPreview: v.string(),
    status: v.optional(v.string()),
  })),
  openedDocument: v.optional(v.object({
    id: v.id("documents"),
    title: v.string(),
    contentPreview: v.string(),
    type: v.optional(v.string()),
  })),
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
    currentDocumentId: v.optional(v.id("documents")),
    resolvedReferences: v.optional(v.array(vResolvedReference)),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const viewContext = {
      currentPage: args.currentPage,
      currentView: args.currentView,
      selectedItems: args.selectedItems,
      cursorPosition: args.cursorPosition,
      searchQuery: args.searchQuery,
      currentEscritoId: args.currentEscritoId,
      currentDocumentId: args.currentDocumentId,
    };

    return await ContextService.gatherAutoContext(
      ctx,
      args.userId,
      args.caseId,
      viewContext,
      args.resolvedReferences,
    );
  },
});

export const legalAgentWorkflow = workflow.define({
  args: {
    userId: v.id("users"),
    threadId: v.string(),
    prompt: v.string(),
    promptMessageId: v.string(), // Message ID from the mutation
    caseId: v.optional(v.id("cases")),
    currentPage: v.optional(v.string()),
    currentView: v.optional(v.string()),
    selectedItems: v.optional(v.array(v.string())),
    cursorPosition: v.optional(v.number()),
    searchQuery: v.optional(v.string()),
    currentEscritoId: v.optional(v.id("escritos")),
    currentDocumentId: v.optional(v.id("documents")),
    resolvedReferences: v.optional(v.array(vResolvedReference)),
    webSearch: v.boolean(),
  },
  handler: async (step, args): Promise<void> => {
    console.log("Starting legal agent workflow");
    // User message already saved by initiateWorkflowStreaming mutation
    const userMessage = { messageId: args.promptMessageId };

    const contextBundle = await step.runMutation(
      internal.agents.case.workflow.gatherContextForWorkflow,
      {
        userId: args.userId,
        caseId: args.caseId,
        currentPage: args.currentPage,
        currentView: args.currentView,
        selectedItems: args.selectedItems,
        cursorPosition: args.cursorPosition,
        searchQuery: args.searchQuery,
        currentEscritoId: args.currentEscritoId,
        currentDocumentId: args.currentDocumentId,
        resolvedReferences: args.resolvedReferences,
      },
    );

    await step.runAction(
      internal.agents.case.workflow.streamWithContextAction,
      {
        threadId: args.threadId,
        promptMessageId: userMessage.messageId,
        contextBundle,
        webSearch: args.webSearch,
      },
      { retry: false },
    );

    console.log("Legal agent workflow completed");
  },
});

export const streamWithContextAction = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    contextBundle: vContextBundle,
    webSearch: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { threadId, promptMessageId, contextBundle, webSearch }) => {
    // Determine which model to use based on user's billing plan and case context
    if (!contextBundle.case?.id) {
      throw new Error("Case context is required for agent workflow");
    }
    
    const modelToUse = await ctx.runMutation(
      internal.billing.features.getModelForUserInCase,
      { 
        userId: contextBundle.user.id,
        caseId: contextBundle.case.id,
      }
    );

    const contextString = ContextService.formatContextForAgent(contextBundle);

    console.log('contextString', contextString);

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

    const systemMessage = `
WEB_SEARCH_MODE: ${webSearch ? "ENABLED" : "DISABLED"}

${prompt}
---
${contextString}

---
${schemaSummary}
  
`;

    const { thread } = await agent.continueThread(ctx, { threadId });

    let openRouterModel = modelToUse === 'gpt-5' ? 'openai/gpt-5.1' : 'openai/gpt-5-mini';
    const config = { reasoning: modelToUse === 'gpt-5' ? {enabled: true, effort: "low" as const, exclude: false } : undefined};

    if (webSearch) {
      openRouterModel = openRouterModel + ':online';
    }
    console.log('openRouterModel', openRouterModel);

    try {
      await thread.streamText(
        {
          system: systemMessage,
          promptMessageId,
          model: openrouter(openRouterModel, config),
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
            throttleMs: 50, // Balanced for performance and responsiveness
          },
          contextOptions: {
            searchOtherThreads: false,
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
    currentDocumentId: v.optional(v.id("documents")),
    resolvedReferences: v.optional(v.array(vResolvedReference)),
    webSearch: v.boolean(),
  },
  returns: v.object({
    workflowId: v.string(),
    threadId: v.string(),
    messageId: v.string(),
  }),
  handler: async (ctx, args): Promise<{workflowId: string, threadId: string, messageId: string}> => {
    const user = await getCurrentUserFromAuth(ctx);

    // Check AI message limits before processing
    const userPlan = await _getUserPlan(ctx, user._id);
    const usage = await _getOrCreateUsageLimits(ctx, user._id, "user");
    const limits = PLAN_LIMITS[userPlan];

    // Check AI message limits + purchased credits
    const credits = await ctx.db
      .query("aiCredits")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const availableMessages = limits.aiMessagesPerMonth - usage.aiMessagesThisMonth;
    const availableCredits = credits?.remaining || 0;
    const totalAvailable = availableMessages + availableCredits;

    if (totalAvailable <= 0) {
      throw new Error(
        "Has alcanzado el límite de mensajes de IA. Compra créditos o actualiza a Premium para mensajes ilimitados."
      );
    }

    let threadId = args.threadId;
    if (!threadId) {
      threadId = await ctx.runMutation(api.agents.threads.createNewThread, {
        title: "Legal Agent Conversation",
        caseId: args.caseId,
      });
    } else {
      await authorizeThreadAccess(ctx, threadId);
    }

    // Save the user's message immediately so optimistic UI works correctly
    const { messageId } = await agent.saveMessage(ctx, {
      threadId,
      prompt: args.prompt,
      skipEmbeddings: true, // Generate embeddings lazily
    });

    const workflowId = await workflow.start(
      ctx,
      internal.agents.case.workflow.legalAgentWorkflow,
      {
        userId: user._id,
        threadId,
        prompt: args.prompt,
        promptMessageId: messageId, // Pass the message ID to the workflow
        caseId: args.caseId,
        currentPage: args.currentPage,
        currentView: args.currentView,
        selectedItems: args.selectedItems,
        cursorPosition: args.cursorPosition,
        searchQuery: args.searchQuery,
        currentEscritoId: args.currentEscritoId,
        currentDocumentId: args.currentDocumentId,
        resolvedReferences: args.resolvedReferences,
        webSearch: args.webSearch,
      },
    );

    // Get team context from case if caseId is provided
    let teamContext: Id<"teams"> | undefined;
    if (args.caseId) {
      const result = await ctx.runQuery(internal.functions.cases.getCaseTeamContext, {
        caseId: args.caseId,
      });
      teamContext = result ?? undefined;
    }

    // Decrement AI message credits after successfully initiating workflow
    await ctx.scheduler.runAfter(0, internal.billing.features.decrementCredits, {
      userId: user._id,
      teamId: teamContext,
      amount: 1,
    });

    return { workflowId, threadId, messageId };
  },
});
