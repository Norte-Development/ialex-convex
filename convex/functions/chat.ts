import { v } from "convex/values";
import { query, mutation } from "../_generated/server";

// ========================================
// CHAT SESSIONS MANAGEMENT
// ========================================

export const createChatSession = mutation({
  args: {
    caseId: v.optional(v.id("cases")),
    userId: v.id("users"),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sessionId = await ctx.db.insert("chatSessions", {
      caseId: args.caseId,
      userId: args.userId,
      title: args.title,
      isActive: true,
    });
    
    console.log("Created chat session with id:", sessionId);
    return sessionId;
  },
});

export const getChatSessions = query({
  args: {
    userId: v.id("users"),
    caseId: v.optional(v.id("cases")),
  },
  handler: async (ctx, args) => {
    let sessionsQuery = ctx.db
      .query("chatSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isActive"), true));
    
    const sessions = await sessionsQuery.collect();
    
    if (args.caseId) {
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
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
    
    return messages;
  },
}); 