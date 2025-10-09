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
  createThread: (initialMessage?: string) => Promise<string>;

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
   * Create a new thread with an initial message
   */
  const createThread = useCallback(
    async (initialMessage?: string) => {
      const result = await workflowMutation({
        prompt: initialMessage || "Hola",
        threadId: "", // Empty threadId creates a new thread
      });

      return result.threadId;
    },
    [workflowMutation],
  );

  /**
   * Send a message to the current thread
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!threadId) {
        throw new Error("No thread selected. Use createThread() to start a new conversation.");
      }

      return await workflowMutation({
        prompt: content,
        threadId,
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
    createThread,

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
