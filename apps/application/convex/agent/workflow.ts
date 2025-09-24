import { internal } from "../_generated/api";
import { internalQuery, mutation, type QueryCtx, type MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { ContextService } from "../context/contextService";
import { authorizeThreadAccess } from "./threads";
import { agent } from "./agent";
import type { Id } from "../_generated/dataModel";

// Validator that mirrors the context bundle consumed by streaming.ts
const contextBundleValidator = v.object({
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
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  }),
});

/**
 * Read-only step: gather rich context as a query.
 */
export const gatherContext = internalQuery({
  args: {
    userId: v.id("users"),
    caseId: v.optional(v.id("cases")),
    currentView: v.object({
      currentPage: v.optional(v.string()),
      currentView: v.optional(v.string()),
      selectedItems: v.optional(v.array(v.string())),
      cursorPosition: v.optional(v.number()),
      searchQuery: v.optional(v.string()),
      currentEscritoId: v.optional(v.id("escritos")),
    }),
  },
  returns: contextBundleValidator,
  handler: async (
    ctx: QueryCtx,
    args: {
      userId: Id<"users">;
      caseId?: Id<"cases"> | null;
      currentView: {
        currentPage?: string;
        currentView?: string;
        selectedItems?: Array<string>;
        cursorPosition?: number;
        searchQuery?: string;
        currentEscritoId?: Id<"escritos">;
      };
    },
  ) => {
    const bundle = await ContextService.gatherAutoContext(
      ctx,
      args.userId,
      args.caseId,
      args.currentView,
    );
    return bundle;
  },
});

/**
 * Minimal workflow-style mutation: orchestrates context + save + stream.
 * Keeps frontend changes minimal while separating read/write steps.
 */
export const startStreamingWorkflow = mutation({
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
  handler: async (
    ctx: MutationCtx,
    args: {
      prompt: string;
      threadId: string;
      userId: Id<"users">;
      caseId?: Id<"cases">;
      currentPage?: string;
      currentView?: string;
      selectedItems?: Array<string>;
      cursorPosition?: number;
      searchQuery?: string;
      currentEscritoId?: Id<"escritos">;
    },
  ) => {
    await authorizeThreadAccess(ctx, args.threadId);

    const viewContext = {
      currentPage: args.currentPage,
      currentView: args.currentView,
      selectedItems: args.selectedItems,
      cursorPosition: args.cursorPosition,
      searchQuery: args.searchQuery,
      currentEscritoId: args.currentEscritoId,
    };

    // Step 1: Gather context (query)
    const contextBundle = await ctx.runQuery(internal.agent.workflow.gatherContext, {
      userId: args.userId,
      caseId: args.caseId ?? null,
      currentView: viewContext,
    });

    // Step 2: Save user message (mutation context)
    const { messageId } = await agent.saveMessage(ctx, {
      threadId: args.threadId,
      prompt: args.prompt,
      skipEmbeddings: true,
    });

    // Step 3: Schedule streaming (action)
    await ctx.scheduler.runAfter(0, internal.agent.streaming.streamAsync, {
      threadId: args.threadId,
      promptMessageId: messageId,
      contextBundle,
    });
  },
});

