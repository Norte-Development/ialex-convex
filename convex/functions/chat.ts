import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getCurrentUserFromAuth, requireCaseAccess } from "./auth_utils";

// ========================================
// CHAT SESSIONS MANAGEMENT
// ========================================

/**
 * Creates a new AI chat session, optionally linked to a case.
 * 
 * @param {Object} args - The function arguments
 * @param {string} [args.caseId] - Optional case ID to associate the chat session with
 * @param {string} [args.title] - Optional custom title for the chat session
 * @returns {Promise<string>} The created chat session's document ID
 * @throws {Error} When not authenticated or lacking case access (if caseId provided)
 * 
 * @description This function creates a new chat session for AI interactions.
 * If a case ID is provided, the user must have read access to that case.
 * The session is linked to the current user and starts as active.
 * 
 * @example
 * ```javascript
 * // Create a general chat session
 * const sessionId = await createChatSession({
 *   title: "Legal Research Session"
 * });
 * 
 * // Create a case-specific chat session
 * const caseSessionId = await createChatSession({
 *   caseId: "case_123",
 *   title: "Contract Analysis Discussion"
 * });
 * ```
 */
export const createChatSession = mutation({
  args: {
    caseId: v.optional(v.id("cases")),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // If case is specified, verify user has access
    if (args.caseId) {
      await requireCaseAccess(ctx, args.caseId, "read");
    }
    
    const sessionId = await ctx.db.insert("chatSessions", {
      caseId: args.caseId,
      userId: currentUser._id,
      title: args.title,
      isActive: true,
    });
    
    console.log("Created chat session with id:", sessionId);
    return sessionId;
  },
});

/**
 * Retrieves chat sessions for a user with optional filtering by case.
 * 
 * @param {Object} args - The function arguments
 * @param {string} [args.userId] - User ID to get sessions for (defaults to current user)
 * @param {string} [args.caseId] - Optional case ID to filter sessions by
 * @returns {Promise<Object[]>} Array of active chat session documents
 * @throws {Error} When not authenticated, unauthorized to view other users' sessions, or lacking case access
 * 
 * @description This function returns all active chat sessions for a user.
 * Users can only view their own sessions for privacy and security.
 * If a case ID is provided for filtering, the user must have access to that case.
 * 
 * @example
 * ```javascript
 * // Get all my chat sessions
 * const mySessions = await getChatSessions({});
 * 
 * // Get sessions for a specific case
 * const caseSessions = await getChatSessions({ caseId: "case_123" });
 * ```
 */
export const getChatSessions = query({
  args: {
    userId: v.optional(v.id("users")),
    caseId: v.optional(v.id("cases")),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Use current user or specified user
    const userId = args.userId || currentUser._id;
    
    // Only allow viewing own sessions
    if (userId !== currentUser._id) {
      throw new Error("Unauthorized: Cannot view other users' chat sessions");
    }
    
    let sessionsQuery = ctx.db
      .query("chatSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true));
    
    const sessions = await sessionsQuery.collect();
    
    if (args.caseId) {
      // If filtering by case, verify user has access to that case
      await requireCaseAccess(ctx, args.caseId, "read");
      return sessions.filter(s => s.caseId === args.caseId);
    }
    
    return sessions;
  },
});

/**
 * Adds a new message to an existing chat session.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.sessionId - The ID of the chat session to add the message to
 * @param {string} args.content - The message content/text
 * @param {"user" | "assistant" | "system" | "tool" | "extractor" | "validator"} args.role - Who sent the message
 * @param {"text" | "search_query" | "web_scrape" | "document_analysis" | "template_suggestion" | "legal_advice" | "extraction_result" | "validation_feedback" | "error"} args.messageType - The type of message
 * @param {string} [args.metadata] - Optional metadata associated with the message (JSON string)
 * @param {string} [args.toolName] - Optional name of the tool that generated this message
 * @param {string} [args.toolCallId] - Optional ID for tracking tool call chains
 * @param {"success" | "error" | "pending"} [args.status] - Optional status for tool/async operations
 * @returns {Promise<string>} The created message's document ID
 * @throws {Error} When not authenticated, session not found, or unauthorized to add messages to session
 * 
 * @description This function adds a message to a chat session. Users can only add
 * messages to their own chat sessions. The message type helps categorize different
 * kinds of AI interactions, and metadata can store additional context.
 * 
 * @example
 * ```javascript
 * // Add a user message
 * const userMessageId = await addChatMessage({
 *   sessionId: "session_123",
 *   content: "Can you analyze this contract?",
 *   role: "user",
 *   messageType: "text"
 * });
 * 
 * // Add an AI response with metadata
 * const assistantMessageId = await addChatMessage({
 *   sessionId: "session_123",
 *   content: "This contract appears to have several key clauses...",
 *   role: "assistant",
 *   messageType: "legal_advice",
 *   metadata: JSON.stringify({ confidence: 0.9, sources: ["clause1", "clause2"] })
 * });
 * 
 * // Add a tool response
 * const toolMessageId = await addChatMessage({
 *   sessionId: "session_123",
 *   content: "Document analysis complete",
 *   role: "tool",
 *   messageType: "document_analysis",
 *   toolName: "contract_analyzer",
 *   toolCallId: "call_123",
 *   status: "success"
 * });
 * ```
 */
export const addChatMessage = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    content: v.string(),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
      v.literal("tool"),
      v.literal("extractor"),
      v.literal("validator")
    ),
    messageType: v.union(
      v.literal("text"),
      v.literal("search_query"),
      v.literal("web_scrape"),
      v.literal("document_analysis"),
      v.literal("template_suggestion"),
      v.literal("legal_advice"),
      v.literal("extraction_result"),
      v.literal("validation_feedback"),
      v.literal("error")
    ),
    metadata: v.optional(v.string()),
    toolName: v.optional(v.string()),
    toolCallId: v.optional(v.string()),
    status: v.optional(v.union(v.literal("success"), v.literal("error"), v.literal("pending"))),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Verify user owns the chat session
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Chat session not found");
    }
    
    if (session.userId !== currentUser._id) {
      throw new Error("Unauthorized: Cannot add messages to other users' chat sessions");
    }
    
    const messageId = await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      content: args.content,
      role: args.role,
      messageType: args.messageType,
      metadata: args.metadata,
      toolName: args.toolName,
      toolCallId: args.toolCallId,
      status: args.status,
    });
    
    return messageId;
  },
});

/**
 * Retrieves all messages from a specific chat session.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.sessionId - The ID of the chat session to get messages from
 * @returns {Promise<Object[]>} Array of message documents ordered chronologically (oldest first)
 * @throws {Error} When not authenticated, session not found, or unauthorized to view session
 * 
 * @description This function returns all messages in a chat session in chronological
 * order (oldest first). Users can only view messages from their own sessions for
 * privacy and security. This maintains the conversation flow for display.
 * 
 * @example
 * ```javascript
 * const messages = await getChatMessages({ sessionId: "session_123" });
 * // Returns: [
 * //   { content: "Hello", role: "user", messageType: "text", _creationTime: ... },
 * //   { content: "Hi! How can I help?", role: "assistant", messageType: "text", ... }
 * // ]
 * ```
 */
export const getChatMessages = query({
  args: {
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Verify user owns the chat session
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Chat session not found");
    }
    
    if (session.userId !== currentUser._id) {
      throw new Error("Unauthorized: Cannot view other users' chat messages");
    }
    
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
    
    return messages;
  },
});

/**
 * Updates the status of a chat message (useful for async operations).
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.messageId - The ID of the message to update
 * @param {"success" | "error" | "pending"} args.status - The new status
 * @param {string} [args.content] - Optional updated content
 * @returns {Promise<void>}
 * @throws {Error} When not authenticated, message not found, or unauthorized to update message
 * 
 * @description This function allows updating the status and optionally the content
 * of a chat message. This is particularly useful for async operations like
 * document analysis or web scraping where the status changes from pending to success/error.
 * 
 * @example
 * ```javascript
 * // Update a pending message to success
 * await updateChatMessageStatus({
 *   messageId: "msg_123",
 *   status: "success",
 *   content: "Analysis completed successfully"
 * });
 * 
 * // Update a pending message to error
 * await updateChatMessageStatus({
 *   messageId: "msg_123",
 *   status: "error",
 *   content: "Failed to analyze document: Invalid format"
 * });
 * ```
 */
export const updateChatMessageStatus = mutation({
  args: {
    messageId: v.id("chatMessages"),
    status: v.union(v.literal("success"), v.literal("error"), v.literal("pending")),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Get the message to verify ownership
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Chat message not found");
    }
    
    // Get the session to verify user owns it
    const session = await ctx.db.get(message.sessionId);
    if (!session || session.userId !== currentUser._id) {
      throw new Error("Unauthorized: Cannot update messages in other users' chat sessions");
    }
    
    // Update the message
    await ctx.db.patch(args.messageId, {
      status: args.status,
      ...(args.content && { content: args.content }),
    });
  },
});

/**
 * Archives a chat session (soft delete).
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.sessionId - The ID of the chat session to archive
 * @returns {Promise<void>}
 * @throws {Error} When not authenticated, session not found, or unauthorized to archive session
 * 
 * @description This function archives a chat session by setting isActive to false.
 * Users can only archive their own chat sessions. Archived sessions are not
 * returned by getChatSessions but can be restored if needed.
 * 
 * @example
 * ```javascript
 * await archiveChatSession({ sessionId: "session_123" });
 * ```
 */
export const archiveChatSession = mutation({
  args: {
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Verify user owns the chat session
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Chat session not found");
    }
    
    if (session.userId !== currentUser._id) {
      throw new Error("Unauthorized: Cannot archive other users' chat sessions");
    }
    
    await ctx.db.patch(args.sessionId, {
      isActive: false,
    });
  },
}); 