/**
 * HomeAgent Thread Types
 * 
 * Type definitions for threads in the home agent system.
 */

/**
 * Thread metadata for the home agent
 * Matches the shape returned by components.agent.threads.listThreadsByUserId
 */
export interface HomeThread {
  _id: string;
  _creationTime: number;
  userId?: string; // Optional - comes from agent component
  title?: string; // Optional - may not be set initially
  summary?: string;
  status: "active" | "archived";
  lastMessageAt?: number;
  messageCount?: number;
}

/**
 * Thread list item with preview
 */
export interface HomeThreadListItem extends HomeThread {
  preview?: string;
  hasUnread?: boolean;
}

/**
 * Thread creation params
 */
export interface CreateThreadParams {
  title?: string;
  initialMessage?: string;
}

/**
 * Thread update params
 */
export interface UpdateThreadParams {
  threadId: string;
  title?: string;
  isArchived?: boolean;
}
