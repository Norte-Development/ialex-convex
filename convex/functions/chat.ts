import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getCurrentUserFromAuth, requireCaseAccess } from "../auth_utils";

// ========================================
// THREAD MANAGEMENT
// ========================================

/**
 * Creates a new agent thread metadata entry, optionally linked to a case.
 * The actual conversation data is stored in Redis using the threadId.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.threadId - The UUID thread identifier for Redis storage
 * @param {string} [args.caseId] - Optional case ID to associate the thread with
 * @param {string} [args.title] - Optional custom title for the thread
 * @param {string} [args.agentType] - Type of agent (e.g., "memory_agent", "legal_assistant")
 * @returns {Promise<string>} The created thread metadata document ID
 * @throws {Error} When not authenticated or lacking case access (if caseId provided)
 * 
 * @description This function creates metadata for an agent thread. The threadId
 * is used as the key for storing conversation data in Redis. Only metadata
 * for organization and access control is stored in Convex.
 * 
 * @example
 * ```javascript
 * // Create a general thread
 * const threadDocId = await createThreadMetadata({
 *   threadId: "uuid-generated-thread-id",
 *   title: "Legal Research Session",
 *   agentType: "memory_agent"
 * });
 * 
 * // Create a case-specific thread
 * const caseThreadDocId = await createThreadMetadata({
 *   threadId: "uuid-generated-thread-id",
 *   caseId: "case_123",
 *   title: "Contract Analysis Discussion",
 *   agentType: "legal_assistant"
 * });
 * ```
 */
export const createThreadMetadata = mutation({
  args: {
    threadId: v.string(),
    caseId: v.optional(v.id("cases")),
    title: v.optional(v.string()),
    agentType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const existingThread = await ctx.db.query("chatSessions").withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId)).first();

    if (existingThread) {
      return existingThread._id;
    }

    // If case is specified, verify user has access
    if (args.caseId) {
      await requireCaseAccess(ctx, args.caseId, "read");
    }
    
    const threadDocId = await ctx.db.insert("chatSessions", {
      threadId: args.threadId,
      caseId: args.caseId,
      userId: currentUser._id,
      title: args.title,
      agentType: args.agentType || "memory_agent",
      isActive: true,
    });
    
    return threadDocId;
  },
});

/**
 * Retrieves thread metadata for a user with optional filtering by case or agent type.
 * 
 * @param {Object} args - The function arguments
 * @param {string} [args.userId] - User ID to get threads for (defaults to current user)
 * @param {string} [args.caseId] - Optional case ID to filter threads by
 * @param {string} [args.agentType] - Optional agent type to filter by
 * @returns {Promise<Object[]>} Array of active thread metadata documents
 * @throws {Error} When not authenticated, unauthorized to view other users' threads, or lacking case access
 * 
 * @description This function returns all active thread metadata for a user.
 * Users can only view their own threads for privacy and security.
 * If a case ID is provided for filtering, the user must have access to that case.
 * 
 * @example
 * ```javascript
 * // Get all my threads
 * const myThreads = await getThreadMetadata({});
 * 
 * // Get threads for a specific case
 * const caseThreads = await getThreadMetadata({ caseId: "case_123" });
 * 
 * // Get threads for a specific agent type
 * const memoryAgentThreads = await getThreadMetadata({ agentType: "memory_agent" });
 * ```
 */
export const getThreadMetadata = query({
  args: {
    caseId: v.optional(v.id("cases")),
    agentType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Use current user or specified user
    const userId = currentUser._id;
    
    // Only allow viewing own threads
    if (userId !== currentUser._id) {
      throw new Error("Unauthorized: Cannot view other users' threads");
    }
    
    let threadsQuery = ctx.db
      .query("chatSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true));
    
    const threads = await threadsQuery.collect();
    
    let filteredThreads = threads;
    
    if (args.caseId) {
      // If filtering by case, verify user has access to that case
      await requireCaseAccess(ctx, args.caseId, "read");
      filteredThreads = filteredThreads.filter(t => t.caseId === args.caseId);
    }
    
    if (args.agentType) {
      filteredThreads = filteredThreads.filter(t => t.agentType === args.agentType);
    }
    
    return filteredThreads;
  },
});


/**
 * Gets thread metadata by threadId.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.threadId - The UUID thread identifier
 * @returns {Promise<Object>} Thread metadata document
 * @throws {Error} When not authenticated, thread not found, or unauthorized to view thread
 * 
 * @example
 * ```javascript
 * const threadMeta = await getThreadMetadataByThreadId({ threadId: "uuid-thread-id" });
 * ```
 */
export const getThreadMetadataByThreadId = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    const thread = await ctx.db
      .query("chatSessions")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!thread) {
      throw new Error("Thread not found");
    }
    
    if (thread.userId !== currentUser._id) {
      throw new Error("Unauthorized: Cannot view other users' threads");
    }
    
    return thread;
  },
});

/**
 * Archives a thread (soft delete).
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.threadId - The UUID thread identifier to archive
 * @returns {Promise<void>}
 * @throws {Error} When not authenticated, thread not found, or unauthorized to archive thread
 * 
 * @description This function archives a thread by setting isActive to false.
 * Users can only archive their own threads. Archived threads are not
 * returned by getThreadMetadata but can be restored if needed.
 * 
 * @example
 * ```javascript
 * await archiveThread({ threadId: "uuid-thread-id" });
 * ```
 */
export const archiveThread = mutation({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Find the thread by threadId
    const thread = await ctx.db
      .query("chatSessions")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    if (!thread) {
      throw new Error("Thread not found");
    }
    
    if (thread.userId !== currentUser._id) {
      throw new Error("Unauthorized: Cannot archive other users' threads");
    }
    
    await ctx.db.patch(thread._id, {
      isActive: false,
    });
  },
}); 
