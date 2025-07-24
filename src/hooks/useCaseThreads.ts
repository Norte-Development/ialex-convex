import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Thread } from "../../types/thread";

interface UseCaseThreadsOptions {
  caseId?: Id<"cases">;
}

interface UseCaseThreadsReturn {
  // Data
  threads: Thread[];
  activeThread: Thread | null;
  isLoading: boolean;
  error: string | null;
  
  // Operations
  loadThreadsForCase: (caseId: Id<"cases">) => void;
  selectThread: (threadId: string) => void;
  createNewThread: (message: string) => Promise<Thread>;
  archiveThread: (threadId: string) => Promise<void>;
}

export const useCaseThreads = (options: UseCaseThreadsOptions = {}): UseCaseThreadsReturn => {
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentCaseId, setCurrentCaseId] = useState<Id<"cases"> | undefined>(options.caseId);

  // Query threads for the current case
  const threadsQuery = useQuery(
    api.functions.chat.getThreadMetadata,
    currentCaseId ? { caseId: currentCaseId } : "skip"
  );

  // Mutations
  const archiveThreadMutation = useMutation(api.functions.chat.archiveThread);
  const createThreadMutation = useMutation(api.functions.chat.createThreadMetadata);

  /**
   * Load threads for a specific case
   * Updates the current case ID which triggers the query to refetch
   */
  const loadThreadsForCase = useCallback((caseId: Id<"cases">) => {
    setError(null);
    setCurrentCaseId(caseId);
    // Reset active thread when changing cases
    setActiveThread(null);
  }, []);

  // Filter out threads without threadId and map to Thread type
  const validThreads: Thread[] = (threadsQuery || [])
    .filter(thread => thread.threadId)
    .map(thread => ({
      _id: thread._id,
      threadId: thread.threadId!,
      caseId: thread.caseId,
      title: thread.title,
      agentType: thread.agentType,
      isActive: thread.isActive,
    }));

  /**
   * Select an active thread by threadId
   * Finds the thread in the current threads list and sets it as active
   */
  const selectThread = useCallback((threadId: string) => {
    setError(null);
    const selectedThread = validThreads.find(thread => thread.threadId === threadId);
    
    if (selectedThread) {
      setActiveThread(selectedThread);
    } else {
      setError(`Thread with ID ${threadId} not found`);
    }
  }, [validThreads]);

  /**
   * Create a new thread with generated UUID and save to database
   * Takes a message which gets truncated to 50 characters for the title
   */
  const createNewThread = useCallback(async (message: string): Promise<Thread> => {
    setError(null);
    try {
      const threadId = crypto.randomUUID();
      const title = message.length > 50 ? message.substring(0, 50) + "..." : message;
      
      // Save to database using Convex mutation
      const threadDocId = await createThreadMutation({
        threadId,
        caseId: currentCaseId,
        title,
        agentType: "memory_agent",
      });
      
      const newThread: Thread = {
        _id: threadDocId,
        threadId,
        caseId: currentCaseId,
        isActive: true,
        title,
        agentType: "memory_agent",
      };
      
      // Set as active thread
      setActiveThread(newThread);
      
      return newThread;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error creating thread";
      setError(errorMessage);
      throw err;
    }
  }, [currentCaseId, createThreadMutation]);

  /**
   * Archive a thread (soft delete)
   * Uses the Convex mutation to mark thread as inactive
   */
  const archiveThread = useCallback(async (threadId: string) => {
    setError(null);
    try {
      await archiveThreadMutation({ threadId });
      
      // If the archived thread was the active thread, clear it
      if (activeThread?.threadId === threadId) {
        setActiveThread(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error archiving thread";
      setError(errorMessage);
      throw err;
    }
  }, [archiveThreadMutation, activeThread]);

  return {
    // Data
    threads: validThreads,
    activeThread,
    isLoading: threadsQuery === undefined,
    error,
    
    // Operations
    loadThreadsForCase,
    selectThread,
    createNewThread,
    archiveThread,
  };
};
