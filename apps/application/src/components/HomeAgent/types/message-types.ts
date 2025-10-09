/**
 * HomeAgent Message Types
 * 
 * Type definitions for messages in the home agent system.
 */

/**
 * Message role types
 */
export type MessageRole = "user" | "assistant" | "system";

/**
 * Message part types for structured content
 */
export interface TextPart {
  type: "text";
  text: string;
}

export interface ToolCallPart {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolResultPart {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  result: unknown;
  isError?: boolean;
}

export type MessagePart = TextPart | ToolCallPart | ToolResultPart;

/**
 * Home agent message structure
 * Matches the structure returned by agent.listMessages from @convex-dev/agent
 */
export interface HomeMessage {
  _id?: string;
  id?: string;
  _creationTime?: number;
  threadId?: string;
  role?: MessageRole;
  text?: string;
  parts?: any[];
  status?: "streaming" | "success" | "failed" | "aborted" | "pending";
  metadata?: Record<string, unknown>;
  tool?: boolean;
  // Additional optional fields from agent messages
  userId?: string;
  embeddingId?: string;
  fileIds?: string[];
  error?: string;
  agentName?: string;
  model?: string;
}

/**
 * Message input for sending new messages
 */
export interface SendMessageParams {
  threadId: string;
  content: string;
  metadata?: Record<string, unknown>;
}
