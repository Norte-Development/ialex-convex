import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// ========================================
// CHAT HTTP ENDPOINTS
// ========================================

/**
 * HTTP endpoint to create a new chat session
 * POST /api/chat/sessions
 */
http.route({
  path: "/api/chat/sessions",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { caseId, title } = body;
      
      const sessionId = await ctx.runMutation(api.functions.chat.createChatSession, {
        caseId,
        title,
      });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          sessionId,
          message: "Chat session created successfully" 
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error creating chat session:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error instanceof Error ? error.message : "Unknown error" 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

/**
 * HTTP endpoint to get chat sessions
 * GET /api/chat/sessions?userId=string&caseId=string
 */
http.route({
  path: "/api/chat/sessions",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const userId = url.searchParams.get("userId");
      const caseId = url.searchParams.get("caseId");
      
      const sessions = await ctx.runQuery(api.functions.chat.getChatSessions, {
        userId: userId as any,
        caseId: caseId as any,
      });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          sessions,
          count: sessions.length 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error getting chat sessions:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error instanceof Error ? error.message : "Unknown error" 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

/**
 * HTTP endpoint to get a specific chat session
 * GET /api/chat/sessions/{sessionId}
 */
http.route({
  path: "/api/chat/sessions/:sessionId",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const sessionId = url.pathname.split('/').pop();
      
      if (!sessionId) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Session ID is required" 
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      
      // Get all sessions for current user and find the specific one
      const sessions = await ctx.runQuery(api.functions.chat.getChatSessions, {});
      const targetSession = sessions.find(s => s._id === sessionId);
      
      if (!targetSession) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Chat session not found" 
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          session: targetSession 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error getting chat session:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error instanceof Error ? error.message : "Unknown error" 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

/**
 * HTTP endpoint to archive a chat session
 * DELETE /api/chat/sessions/{sessionId}
 */
http.route({
  path: "/api/chat/sessions/:sessionId",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const sessionId = url.pathname.split('/').pop();
      
      if (!sessionId) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Session ID is required" 
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      
      await ctx.runMutation(api.functions.chat.archiveChatSession, {
        sessionId: sessionId as any,
      });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Chat session archived successfully" 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error archiving chat session:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error instanceof Error ? error.message : "Unknown error" 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

/**
 * HTTP endpoint to add a chat message
 * POST /api/chat/messages
 */
http.route({
  path: "/api/chat/messages",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { 
        sessionId, 
        content, 
        role, 
        messageType, 
        metadata, 
        toolName, 
        toolCallId, 
        status 
      } = body;
      
      const messageId = await ctx.runMutation(api.functions.chat.addChatMessage, {
        sessionId,
        content,
        role,
        messageType,
        metadata,
        toolName,
        toolCallId,
        status,
      });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          messageId,
          message: "Chat message added successfully" 
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error adding chat message:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error instanceof Error ? error.message : "Unknown error" 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

/**
 * HTTP endpoint to get chat messages
 * GET /api/chat/messages?sessionId=string
 */
http.route({
  path: "/api/chat/messages",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const sessionId = url.searchParams.get("sessionId");
      
      if (!sessionId) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Session ID is required" 
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      
      const messages = await ctx.runQuery(api.functions.chat.getChatMessages, {
        sessionId: sessionId as any,
      });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          messages,
          count: messages.length 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error getting chat messages:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error instanceof Error ? error.message : "Unknown error" 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

/**
 * HTTP endpoint to update chat message status
 * PATCH /api/chat/messages/{messageId}
 */
http.route({
  path: "/api/chat/messages/:messageId",
  method: "PATCH",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const messageId = url.pathname.split('/').pop();
      const body = await request.json();
      const { status, content } = body;
      
      if (!messageId) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Message ID is required" 
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      
      await ctx.runMutation(api.functions.chat.updateChatMessageStatus, {
        messageId: messageId as any,
        status,
        content,
      });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Chat message status updated successfully" 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error updating chat message status:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error instanceof Error ? error.message : "Unknown error" 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

/**
 * HTTP endpoint to create a chat session for LangGraph agents
 * POST /api/chat/agent/sessions
 */
http.route({
  path: "/api/chat/agent/sessions",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { serviceToken, caseId, title, userId } = body;
      
      const sessionId = await ctx.runMutation(api.functions.chat.createChatSessionForAgent, {
        serviceToken,
        caseId,
        title,
        userId,
      });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          sessionId,
          message: "Chat session created successfully for agent" 
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error creating chat session for agent:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error instanceof Error ? error.message : "Unknown error" 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

/**
 * HTTP endpoint to add a chat message for LangGraph agents
 * POST /api/chat/agent/messages
 */
http.route({
  path: "/api/chat/agent/messages",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { 
        serviceToken,
        sessionId, 
        content, 
        role, 
        messageType, 
        metadata, 
        toolName, 
        toolCallId, 
        status 
      } = body;
      
      const messageId = await ctx.runMutation(api.functions.chat.addChatMessageForAgent, {
        serviceToken,
        sessionId,
        content,
        role,
        messageType,
        metadata,
        toolName,
        toolCallId,
        status,
      });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          messageId,
          message: "Chat message added successfully for agent" 
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error adding chat message for agent:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error instanceof Error ? error.message : "Unknown error" 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

/**
 * HTTP endpoint to update chat message status for LangGraph agents
 * PATCH /api/chat/agent/messages/{messageId}
 */
http.route({
  path: "/api/chat/agent/messages/:messageId",
  method: "PATCH",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const messageId = url.pathname.split('/').pop();
      const body = await request.json();
      const { serviceToken, status, content } = body;
      
      if (!messageId) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Message ID is required" 
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      
      await ctx.runMutation(api.functions.chat.updateChatMessageStatusForAgent, {
        serviceToken,
        messageId: messageId as any,
        status,
        content,
      });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Chat message status updated successfully for agent" 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error updating chat message status for agent:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error instanceof Error ? error.message : "Unknown error" 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

export default http; 