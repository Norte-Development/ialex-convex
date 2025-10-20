"use client";

import type React from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  optimisticallySendMessage,
  toUIMessages,
  useThreadMessages,
} from "@convex-dev/agent/react";
import { MessageCircle } from "lucide-react";
import { useThread } from "@/context/ThreadContext";
import { useCase } from "@/context/CaseContext";
import { SidebarMessage } from "./SidebarMessage";
import { ChatInput } from "./ChatInput";
import { useEscrito } from "@/context/EscritoContext";
import { useAuth } from "@/context/AuthContext";
import { usePage } from "@/context/PageContext";
import { ContextSummaryBar } from "./ContextSummaryBar";
import type { Id } from "convex/_generated/dataModel";
import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useTransition,
} from "react";
import { TodoPanel } from "./TodoPanel";
import type { Reference, ReferenceWithOriginal } from "./types/reference-types";
import { Button } from "@/components/ui/button";

interface ScrollState {
  userHasScrolled: boolean;
  shouldAutoScroll: boolean;
  isLoadingMore: boolean;
  isInitialLoad: boolean;
}

export function ChatContent() {
  const { threadId, createThreadWithTitle, setThreadId } = useThread();
  const { caseId } = useCase();
  const { escritoId, cursorPosition } = useEscrito();
  const { user } = useAuth();
  const { pageState } = usePage();
  // State for resolved @-references to display in context bar
  const [lastReferences, setLastReferences] = useState<ReferenceWithOriginal[]>(
    [],
  );
  // State for current active references from input
  const [currentReferences, setCurrentReferences] = useState<Reference[]>([]);
  // State to track when we've just sent a message but AI hasn't started responding
  const [awaitingResponse, setAwaitingResponse] = useState(false);

  // Refs for scroll management
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const [scrollState, setScrollState] = useState<ScrollState>({
    userHasScrolled: false,
    shouldAutoScroll: true,
    isLoadingMore: false,
    isInitialLoad: true,
  });

  const lastScrollTopRef = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>(null);
  const isScrollingProgrammaticallyRef = useRef(false);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const [_isPending, startTransition] = useTransition();

  // Handle removing references from context bar
  const handleRemoveReference = useCallback(
    (index: number) => {
      startTransition(() => {
        if (index < lastReferences.length) {
          // Removing from lastReferences (already sent references)
          setLastReferences((prev) => prev.filter((_, i) => i !== index));
        } else {
          // Removing from currentReferences (active input references)
          const currentIndex = index - lastReferences.length;
          setCurrentReferences((prev) =>
            prev.filter((_, i) => i !== currentIndex),
          );
        }
      });
    },
    [lastReferences.length],
  );

  const messages = useThreadMessages(
    api.agents.case.streaming.listMessages,
    threadId ? { threadId } : "skip",
    {
      initialNumItems: 5,
      stream: true,
    },
  );

  // Determine if messages are loading
  const isLoadingMessages =
    threadId && !messages.results && messages.status !== "Exhausted";

  const scrollToBottom = useCallback(() => {
    if (!messagesContainerRef.current) return;

    isScrollingProgrammaticallyRef.current = true;

    // Direct scrollTop is faster and doesn't cause animation jank during streaming
    messagesContainerRef.current.scrollTop =
      messagesContainerRef.current.scrollHeight;

    // Reset programmatic scroll flag immediately for instant scrolling
    requestAnimationFrame(() => {
      isScrollingProgrammaticallyRef.current = false;
    });
  }, []);

  const isNearBottom = useCallback(() => {
    if (!messagesContainerRef.current) return false;

    const { scrollTop, scrollHeight, clientHeight } =
      messagesContainerRef.current;
    const threshold = 100; // pixels from bottom
    return scrollHeight - scrollTop - clientHeight < threshold;
  }, []);

  const handleContentResize = useCallback(() => {
    if (!messagesContainerRef.current || isScrollingProgrammaticallyRef.current)
      return;

    const { scrollTop, scrollHeight, clientHeight } =
      messagesContainerRef.current;
    const threshold = 100;
    const nearBottom = scrollHeight - scrollTop - clientHeight < threshold;

    if (scrollState.shouldAutoScroll && nearBottom) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [scrollState.shouldAutoScroll]);

  useLayoutEffect(() => {
    if (
      messagesContainerRef.current &&
      messages.results?.length &&
      scrollState.isInitialLoad
    ) {
      // Use instant scroll for initial load to avoid visual jumps
      scrollToBottom();
      setScrollState((prev) => ({
        ...prev,
        isInitialLoad: false,
        shouldAutoScroll: true,
        userHasScrolled: false,
      }));
    }
  }, [
    messages.results?.length,
    threadId,
    scrollState.isInitialLoad,
    scrollToBottom,
  ]);

  // Reset initial load flag when thread changes
  useEffect(() => {
    setScrollState({
      isInitialLoad: true,
      userHasScrolled: false,
      shouldAutoScroll: true,
      isLoadingMore: false,
    });
    setAwaitingResponse(false); // Clear awaiting response when switching threads
  }, [threadId]);

  // Track previous message count to detect new messages (not from pagination)
  const prevMessageCountRef = useRef(0);

  useEffect(() => {
    if (messagesContainerRef.current && messages.results?.length) {
      const currentCount = messages.results.length;
      const prevCount = prevMessageCountRef.current;

      // If we have more messages than before and it's not the initial load
      if (
        currentCount > prevCount &&
        !scrollState.isInitialLoad &&
        prevCount > 0
      ) {
        // Only auto-scroll if user hasn't manually scrolled away or is near bottom
        if (
          scrollState.shouldAutoScroll &&
          (isNearBottom() || !scrollState.userHasScrolled)
        ) {
          scrollToBottom();
        }
      }

      prevMessageCountRef.current = currentCount;
    }
  }, [
    messages.results?.length,
    scrollState.isInitialLoad,
    scrollState.shouldAutoScroll,
    scrollState.userHasScrolled,
    isNearBottom,
    scrollToBottom,
  ]);

  const handleLoadMore = useCallback(async () => {
    if (
      !messages.loadMore ||
      scrollState.isLoadingMore ||
      !messagesContainerRef.current
    )
      return;

    // Store current scroll position and first visible message
    const container = messagesContainerRef.current;
    const scrollHeightBefore = container.scrollHeight;
    const scrollTopBefore = container.scrollTop;

    setScrollState((prev) => ({ ...prev, isLoadingMore: true }));
    try {
      await messages.loadMore(20);

      // Restore scroll position after new messages are loaded
      requestAnimationFrame(() => {
        if (messagesContainerRef.current) {
          const scrollHeightAfter = messagesContainerRef.current.scrollHeight;
          const heightDifference = scrollHeightAfter - scrollHeightBefore;

          // Maintain relative position by adjusting for new content height
          messagesContainerRef.current.scrollTop =
            scrollTopBefore + heightDifference;
        }
      });
    } finally {
      setScrollState((prev) => ({ ...prev, isLoadingMore: false }));
    }
  }, [messages.loadMore, scrollState.isLoadingMore]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

      // Skip if this is a programmatic scroll
      if (isScrollingProgrammaticallyRef.current) return;

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Use RAF for immediate visual feedback, timeout for state updates
      requestAnimationFrame(() => {
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
        const hasScrolledUp = scrollTop < lastScrollTopRef.current;

        scrollTimeoutRef.current = setTimeout(() => {
          if (hasScrolledUp && !isAtBottom) {
            setScrollState((prev) => ({
              ...prev,
              userHasScrolled: true,
              shouldAutoScroll: false,
            }));
          } else if (isAtBottom) {
            // User scrolled back to bottom, re-enable auto-scroll
            setScrollState((prev) => ({
              ...prev,
              userHasScrolled: false,
              shouldAutoScroll: true,
            }));
          }

          lastScrollTopRef.current = scrollTop;

          // Load more when user scrolls to the top (within 100px)
          if (
            scrollTop < 100 &&
            !scrollState.isLoadingMore &&
            messages.status === "CanLoadMore"
          ) {
            handleLoadMore();
          }
        }, 16); // ~60fps debouncing
      });
    },
    [scrollState.isLoadingMore, messages.status, handleLoadMore],
  );

  useEffect(() => {
    if (!messagesContainerRef.current) return;

    // Clean up existing observer
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
    }

    let rafId: number | null = null;
    let lastCallTime = 0;
    const throttleMs = 16; // ~60fps

    // Create new ResizeObserver with throttling
    resizeObserverRef.current = new ResizeObserver(() => {
      const now = Date.now();

      if (rafId) cancelAnimationFrame(rafId);

      if (now - lastCallTime >= throttleMs) {
        lastCallTime = now;
        debouncedHandleContentResize();
      } else {
        rafId = requestAnimationFrame(() => {
          lastCallTime = Date.now();
          handleContentResize();
        });
      }
    });

    // Observe the messages container
    resizeObserverRef.current.observe(messagesContainerRef.current);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [handleContentResize]);

  const initiateWorkflow = useMutation(
    api.agents.case.workflow.initiateWorkflowStreaming,
  ).withOptimisticUpdate(
    optimisticallySendMessage(api.agents.case.streaming.listMessages),
  );

  const abortStreamByOrder = useMutation(
    api.agents.core.streaming.streamAbort.abortStreamByOrder,
  );
  const parseAtReferences = useMutation(api.context.context.parseAtReferences);

  const handleSendMessage = useCallback(
    async (prompt: string) => {
      if (!user?._id) return;

      // Parse @ references first
      const { cleanMessage, references } = await parseAtReferences({
        userId: user._id as Id<"users">,
        message: prompt,
        caseId: caseId || undefined,
      });

      // Store references for display in context bar
      setLastReferences(references);

      // Gather rich view context from PageContext
      const currentViewContext = {
        currentPage: pageState.currentPage,
        currentView: pageState.currentView,
        cursorPosition: cursorPosition?.line,
        ...(escritoId && { currentEscritoId: escritoId as Id<"escritos"> }), // Only include if escritoId exists and cast to proper type
        selectedItems: pageState.selectedItems,
        searchQuery: pageState.searchQuery,
      };

      setScrollState((prev) => ({
        ...prev,
        shouldAutoScroll: true,
        userHasScrolled: false,
      }));
      setAwaitingResponse(true); // Set awaiting response state

      // If no thread exists, create one with the truncated message as title
      try {
        let activeThreadId = threadId;
        if (!activeThreadId) {
          const truncatedTitle =
            cleanMessage.length > 50
              ? `${cleanMessage.substring(0, 50)}...`
              : cleanMessage;
          activeThreadId = await createThreadWithTitle(
            truncatedTitle,
            caseId || undefined,
          );
        }

        const {
          threadId: newThreadId,
          workflowId,
          messageId,
        } = await initiateWorkflow({
          prompt: cleanMessage,
          threadId: activeThreadId,
          caseId: caseId ?? undefined,
          currentPage: currentViewContext.currentPage,
          currentView: currentViewContext.currentView,
          selectedItems: currentViewContext.selectedItems,
          cursorPosition: currentViewContext.cursorPosition,
          searchQuery: currentViewContext.searchQuery,
          currentEscritoId: currentViewContext.currentEscritoId,
        });

        if (!threadId) {
          setThreadId(newThreadId);
        }
        console.debug("Workflow started", {
          workflowId,
          threadId: newThreadId,
          messageId,
        });
      } catch (error) {
        console.error("Failed to initiate workflow", error);
        setAwaitingResponse(false);
      }
    },
    [
      user?._id,
      parseAtReferences,
      caseId,
      pageState,
      cursorPosition,
      escritoId,
      threadId,
      createThreadWithTitle,
      initiateWorkflow,
      setThreadId,
    ],
  );

  const handleAbortStream = useCallback(() => {
    if (!threadId) return;
    // Try to get the order from active streams first (more efficient)
    let order = 0;
    const streams = messages.results; // Type assertion since streams property exists but isn't typed
    if (streams && Array.isArray(streams) && streams.length > 0) {
      const activeStream = streams.find(
        (stream) => stream.streaming || stream.status === "pending",
      );
      if (activeStream) {
        order = activeStream.order ?? 0;
      }
    }
    // Fallback to checking recent messages if no active stream found
    if (order === 0) {
      const recentMessages = messages.results?.slice(-5) ?? [];
      const streamingMessage = recentMessages.find((m) => m.streaming);
      order = streamingMessage?.order ?? 0;
    }
    void abortStreamByOrder({ threadId, order });
  }, [threadId, messages.results, abortStreamByOrder]);

  const isStreaming = useMemo(() => {
    // First check if we have any active streams from the messages response
    // This captures all phases: reasoning, tool execution, and text streaming
    const streams = messages.results;
    if (streams && Array.isArray(streams) && streams.length > 0) {
      // Check if any stream has a status that indicates active processing
      const hasActiveStream = streams.some(
        (stream) => stream.streaming || stream.status === "pending",
      );
      if (hasActiveStream) return true;
    }

    // Check messages for streaming state, but be smart about tool execution
    const recentMessages = messages.results?.slice(-5) ?? [];
    const hasStreamingMessage = recentMessages.some((m) => {
      if (!m.streaming) return false;
      // If message has streaming=true but has tool calls, check if tools are done
      const toolParts =
        (m as any).parts?.filter((p: any) => p.type?.startsWith("tool-")) || [];
      if (toolParts.length > 0) {
        // If all tools have completed (have output), consider streaming done
        const allToolsDone = toolParts.every(
          (p: any) => p.state === "output-available",
        );
        if (allToolsDone) {
          // Check if there's text content being generated
          const hasTextPart = (m as any).parts?.some(
            (p: any) => p.type === "text",
          );
          // Only streaming if text is being generated, not just tools executing
          return hasTextPart && m.streaming;
        }
      }
      return m.streaming;
    });
    return hasStreamingMessage;
  }, [messages.results]); // Simplified dependency - just depend on results reference

  // Clear awaiting response state when AI starts responding with actual content OR when streaming finishes
  useEffect(() => {
    if (!awaitingResponse) return;
    // Clear if AI has started producing text or parts
    const hasAssistantContent = messages.results?.some(
      (m) =>
        (m as any).role === "assistant" &&
        (m as any).parts &&
        (m as any).parts.length > 0,
    );
    // Also clear if streaming is done
    const shouldClear = hasAssistantContent || !isStreaming;
    if (shouldClear) {
      setAwaitingResponse(false);
    }
  }, [awaitingResponse, isStreaming, messages.results]);

  // Optimize memoization: use stable callback and only update when message structure changes
  const memoizedMessages = useMemo(() => {
    return toUIMessages(messages.results ?? []).map((m: any) => (
      <SidebarMessage
        key={m.key}
        message={m}
        onContentChange={handleContentResize}
      />
    ));
  }, [messages.results, handleContentResize]);

  const combinedReferences = useMemo(
    () => [
      ...lastReferences,
      ...currentReferences.map((ref) => ({
        ...ref,
        originalText: `@${ref.type}:${ref.name}`,
      })),
    ],
    [lastReferences, currentReferences],
  );

  return (
    <>
      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 relative"
        onScroll={handleScroll}
      >
        {/* Load More Button - shown when there are more messages to load */}
        {messages.status === "CanLoadMore" && (
          <div className="flex justify-center py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLoadMore}
              disabled={scrollState.isLoadingMore}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {scrollState.isLoadingMore ? "..." : "↑ Más mensajes"}
            </Button>
          </div>
        )}

        {isLoadingMessages ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 text-sm">
            <div className="animate-spin rounded-full h-8 w-8 mb-2" />
            <p>Cargando mensajes...</p>
          </div>
        ) : messages.results?.length > 0 ? (
          memoizedMessages
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 text-sm">
            <MessageCircle className="w-8 h-8 mb-2 text-gray-400" />
            <p>Inicia una conversación con tu asistente de IA</p>
          </div>
        )}
      </div>

      {/* Todo panel */}
      {/* <TodoPanel /> */}

      {/* Minimal context summary */}
      <ContextSummaryBar
        references={combinedReferences}
        onRemoveReference={handleRemoveReference}
      />

      {/* Input area */}
      <ChatInput
        onSendMessage={handleSendMessage}
        isStreaming={isStreaming || awaitingResponse}
        onAbortStream={handleAbortStream}
        onReferencesChange={setCurrentReferences}
      />
    </>
  );
}
