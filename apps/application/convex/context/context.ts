import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { ContextService, type ContextBundle } from "./contextService";
import { Id } from "../_generated/dataModel";

// Re-export parseReferences functions
export { parseAtReferences, getReferencesSuggestions } from "./parseReferences";

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

/**
 * Gather context for the current user and case
 * This is the main public API for getting context
 */
export const gatherContext = query({
  args: {
    userId: v.id("users"),
    caseId: v.optional(v.id("cases")),
    currentPage: v.optional(v.string()),
    currentView: v.optional(v.string()),
    selectedItems: v.optional(v.array(v.string())),
    cursorPosition: v.optional(v.number()),
    searchQuery: v.optional(v.string()),
    currentEscritoId: v.optional(v.id("escritos")),
    resolvedReferences: v.optional(v.array(vResolvedReference)),
  },
  returns: v.object({
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
    caseDocuments: v.array(v.object({
      name: v.string(),
      id: v.string(),
      type: v.optional(v.string()),
    })),
    resolvedReferences: v.optional(v.array(vResolvedReference)),
  }),
  handler: async (ctx, args): Promise<ContextBundle> => {
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
      args.resolvedReferences
    );
  },
});

/**
 * Format context bundle into a readable string for the agent
 * This creates the system message content
 */
export const formatContextForAgent = query({
  args: {
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
      caseDocuments: v.array(v.object({
        name: v.string(),
        id: v.string(),
        type: v.optional(v.string()),
      })),
      resolvedReferences: v.optional(v.array(vResolvedReference)),
    }),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    return ContextService.formatContextForAgent(args.contextBundle);
  },
});
