import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getCurrentUserFromAuth, requireCaseAccess } from "./auth_utils";

// ========================================
// CHAT SESSIONS MANAGEMENT
// ========================================

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

export const getChatSessions = query({
  args: {
    userId: v.optional(v.id("users")),
    caseId: v.optional(v.id("cases")),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Use current user or specified user (admin can view others)
    const userId = args.userId || currentUser._id;
    
    // Only allow viewing own sessions unless admin
    if (userId !== currentUser._id && currentUser.role !== "admin") {
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

export const addChatMessage = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    messageType: v.union(
      v.literal("text"),
      v.literal("document_analysis"),
      v.literal("template_suggestion"),
      v.literal("legal_advice")
    ),
    metadata: v.optional(v.string()),
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
    });
    
    return messageId;
  },
});

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
    
    if (session.userId !== currentUser._id && currentUser.role !== "admin") {
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