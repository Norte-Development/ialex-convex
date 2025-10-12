/**
 * useHomeThreads Hook
 *
 * Unified hook for managing home agent threads.
 * Handles both thread list and individual thread operations.
 */

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useCallback, useMemo } from "react";
import type { HomeThread, HomeMessage } from "../types";

/**
 * Hook configuration options
 */
export interface UseHomeThreadsOptions {
  /** Current active thread ID */
  threadId?: string;
  /** Number of threads to fetch in the list */
  threadsLimit?: number;
  /** Number of messages to fetch for the current thread */
  messagesLimit?: number;
}

/**
 * Hook return type
 */
export interface UseHomeThreadsReturn {
  // Thread List
  threads: HomeThread[];
  threadsLoading: boolean;
  hasMoreThreads: boolean;
  startNewConversation: () => Promise<string>;

  // Current Thread
  currentThread: HomeThread | null;
  currentThreadLoading: boolean;
  messages: HomeMessage[];
  messagesLoading: boolean;
  sendMessage: (content: string) => Promise<{ workflowId: string; threadId: string }>;

  // Combined state
  isLoading: boolean;
}

/**
 * Unified hook for home agent threads
 */
export function useHomeThreads(options: UseHomeThreadsOptions = {}): UseHomeThreadsReturn {
  const {
    threadId,
    threadsLimit = 50,
    messagesLimit = 100,
  } = options;

  // ========================================
  // THREAD LIST QUERIES
  // ========================================

  const threadsResult = useQuery(api.agents.threads.listThreads, {
    paginationOpts: { numItems: threadsLimit, cursor: null as any },
    caseId: undefined, // Home threads don't have a caseId
  });

  // ========================================
  // CURRENT THREAD QUERIES
  // ========================================

  const messagesResult = useQuery(
    api.agents.threads.getThreadMessages,
    threadId
      ? {
          threadId,
          paginationOpts: { numItems: messagesLimit, cursor: null as any },
        }
      : "skip",
  );

  const threadMetadata = useQuery(
    api.agents.threads.getThreadDetails,
    threadId ? { threadId } : "skip",
  );

  // ========================================
  // MUTATIONS
  // ========================================

  const workflowMutation = useMutation(
    api.agents.home.workflow.initiateWorkflowStreaming,
  );

  // ========================================
  // HANDLERS
  // ========================================

  /**
   * Start a new conversation (just clears the current thread)
   */
  const startNewConversation = useCallback(
    () => {
      // Don't create a thread - just return empty string to clear current thread
      // Thread will be created when user sends first message
      return Promise.resolve("");
    },
    [],
  );

  /**
   * Send a message to the current thread or create a new one if none exists
   */
  const sendMessage = useCallback(
    async (content: string) => {
      // Thread will be created with message as title in backend if threadId is empty
      return await workflowMutation({
        prompt: content,
        threadId: threadId || "", // Empty string will trigger thread creation in backend
      });
    },
    [threadId, workflowMutation],
  );

  // ========================================
  // DERIVED STATE
  // ========================================

  const threads = useMemo(() => threadsResult?.page || [], [threadsResult]);
  const messages = useMemo(() => messagesResult?.page || [], [messagesResult]);

  const threadsLoading = threadsResult === undefined;
  const messagesLoading = threadId ? messagesResult === undefined : false;
  const currentThreadLoading = threadId ? threadMetadata === undefined : false;

  const isLoading = threadsLoading || messagesLoading || currentThreadLoading;

  const currentThread = useMemo(() => {
    if (!threadId) return null;
    
    // First try to get from metadata query
    if (threadMetadata) return threadMetadata as HomeThread;
    
    // Fallback to finding in threads list
    return threads.find((t) => t._id === threadId) || null;
  }, [threadId, threadMetadata, threads]);

  // ========================================
  // RETURN
  // ========================================

  return {
    // Thread List
    threads,
    threadsLoading,
    hasMoreThreads: threadsResult?.isDone === false,
    startNewConversation,

    // Current Thread
    currentThread,
    currentThreadLoading,
    messages,
    messagesLoading,
    sendMessage,

    // Combined
    isLoading,
  };
}
