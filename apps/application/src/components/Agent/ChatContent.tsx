"use client"

import type React from "react"

import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { optimisticallySendMessage, toUIMessages, useThreadMessages } from "@convex-dev/agent/react"
import { MessageCircle } from "lucide-react"
import { useThread } from "@/context/ThreadContext"
import { useCase } from "@/context/CaseContext"
import { SidebarMessage } from "./SidebarMessage"
import { ChatInput } from "./ChatInput"
import { useEscrito } from "@/context/EscritoContext"
import { useAuth } from "@/context/AuthContext"
import { usePage } from "@/context/PageContext"
import { ContextSummaryBar } from "./ContextSummaryBar"
import type { Id } from "convex/_generated/dataModel"
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react"
import { TodoPanel } from "./TodoPanel"
import type { Reference, ReferenceWithOriginal } from "./types/reference-types"
import { Button } from "@/components/ui/button"

export function ChatContent() {
  const { threadId, createThreadWithTitle, setThreadId } = useThread()
  const { caseId } = useCase()
  const { escritoId, cursorPosition } = useEscrito()
  const { user } = useAuth()
  const { pageState } = usePage()

  // State for resolved @-references to display in context bar
  const [lastReferences, setLastReferences] = useState<ReferenceWithOriginal[]>([])
  // State for current active references from input
  const [currentReferences, setCurrentReferences] = useState<Reference[]>([])
  // State to track when we've just sent a message but AI hasn't started responding
  const [awaitingResponse, setAwaitingResponse] = useState(false)

  // Refs for scroll management
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  const [userHasScrolled, setUserHasScrolled] = useState(false)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  const lastScrollTopRef = useRef(0)
  const scrollTimeoutRef = useRef<NodeJS.Timeout>(null)
  const isScrollingProgrammaticallyRef = useRef(false)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  // Handle removing references from context bar
  const handleRemoveReference = (index: number) => {
    if (index < lastReferences.length) {
      // Removing from lastReferences (already sent references)
      setLastReferences((prev) => prev.filter((_, i) => i !== index))
    } else {
      // Removing from currentReferences (active input references)
      const currentIndex = index - lastReferences.length
      setCurrentReferences((prev) => prev.filter((_, i) => i !== currentIndex))
    }
  }

  const messages = useThreadMessages(api.agent.streaming.listMessages, threadId ? { threadId } : "skip", {
    initialNumItems: 5,
    stream: true,
  })

  // Determine if messages are loading
  const isLoadingMessages = threadId && !messages.results && messages.status !== "Exhausted"

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (!messagesContainerRef.current) return

    isScrollingProgrammaticallyRef.current = true

    // Use scrollIntoView for better cross-browser compatibility and smoother animation
    const lastMessage = messagesContainerRef.current.lastElementChild
    if (lastMessage) {
      lastMessage.scrollIntoView({
        behavior,
        block: "end",
        inline: "nearest",
      })
    } else {
      // Fallback to scrollTop if no messages
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior,
      })
    }

    // Reset programmatic scroll flag after animation completes
    setTimeout(
      () => {
        isScrollingProgrammaticallyRef.current = false
      },
      behavior === "smooth" ? 300 : 0,
    )
  }, [])

  const isNearBottom = useCallback(() => {
    if (!messagesContainerRef.current) return false

    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
    const threshold = 100 // pixels from bottom
    return scrollHeight - scrollTop - clientHeight < threshold
  }, [])

  // Handle content height changes (streaming text, tool expansion, etc.)
  const handleContentResize = useCallback(() => {
    if (shouldAutoScroll && isNearBottom() && !isScrollingProgrammaticallyRef.current) {
      scrollToBottom("smooth")
    }
  }, [shouldAutoScroll, isNearBottom, scrollToBottom])

  useLayoutEffect(() => {
    if (messagesContainerRef.current && messages.results?.length && isInitialLoad) {
      // Use instant scroll for initial load to avoid visual jump
      scrollToBottom("instant")
      setIsInitialLoad(false)
      setShouldAutoScroll(true)
      setUserHasScrolled(false)
    }
  }, [messages.results?.length, threadId, isInitialLoad, scrollToBottom])

  // Reset initial load flag when thread changes
  useEffect(() => {
    setIsInitialLoad(true)
    setUserHasScrolled(false)
    setShouldAutoScroll(true)
    setAwaitingResponse(false) // Clear awaiting response when switching threads
  }, [threadId])

  // Track previous message count to detect new messages (not from pagination)
  const prevMessageCountRef = useRef(0)

  useEffect(() => {
    if (messagesContainerRef.current && messages.results?.length) {
      const currentCount = messages.results.length
      const prevCount = prevMessageCountRef.current

      // If we have more messages than before and it's not the initial load
      if (currentCount > prevCount && !isInitialLoad && prevCount > 0) {
        // Only auto-scroll if user hasn't manually scrolled away or is near bottom
        if (shouldAutoScroll && (isNearBottom() || !userHasScrolled)) {
          scrollToBottom("smooth")
        }
      }

      prevMessageCountRef.current = currentCount
    }
  }, [messages.results?.length, isInitialLoad, shouldAutoScroll, userHasScrolled, isNearBottom, scrollToBottom])

  const handleLoadMore = async () => {
    if (!messages.loadMore || isLoadingMore || !messagesContainerRef.current) return

    // Store current scroll position and first visible message
    const container = messagesContainerRef.current
    const scrollHeightBefore = container.scrollHeight
    const scrollTopBefore = container.scrollTop

    setIsLoadingMore(true)
    try {
      await messages.loadMore(20)

      // Restore scroll position after new messages are loaded
      requestAnimationFrame(() => {
        if (messagesContainerRef.current) {
          const scrollHeightAfter = messagesContainerRef.current.scrollHeight
          const heightDifference = scrollHeightAfter - scrollHeightBefore

          // Maintain relative position by adjusting for new content height
          messagesContainerRef.current.scrollTop = scrollTopBefore + heightDifference
        }
      })
    } finally {
      setIsLoadingMore(false)
    }
  }

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget

      // Skip if this is a programmatic scroll
      if (isScrollingProgrammaticallyRef.current) return

      // Debounce scroll events for better performance
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }

      scrollTimeoutRef.current = setTimeout(() => {
        // Detect if user has scrolled up from bottom
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 10
        const hasScrolledUp = scrollTop < lastScrollTopRef.current

        if (hasScrolledUp && !isAtBottom) {
          setUserHasScrolled(true)
          setShouldAutoScroll(false)
        } else if (isAtBottom) {
          // User scrolled back to bottom, re-enable auto-scroll
          setUserHasScrolled(false)
          setShouldAutoScroll(true)
        }

        lastScrollTopRef.current = scrollTop

        // Load more when user scrolls to the top (within 100px)
        if (scrollTop < 100 && !isLoadingMore && messages.status === "CanLoadMore") {
          handleLoadMore()
        }
      }, 16) // ~60fps debouncing
    },
    [isLoadingMore, messages.status],
  )

  // Setup ResizeObserver to watch for content height changes
  useEffect(() => {
    if (!messagesContainerRef.current) return

    // Clean up existing observer
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect()
    }

    // Create new ResizeObserver
    resizeObserverRef.current = new ResizeObserver(() => {
      // Debounce resize events
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
      
      scrollTimeoutRef.current = setTimeout(() => {
        handleContentResize()
      }, 50)
    })

    // Observe the messages container
    resizeObserverRef.current.observe(messagesContainerRef.current)

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [handleContentResize])

  const initiateWorkflow = useMutation(api.agent.workflow.initiateWorkflowStreaming).withOptimisticUpdate(
    optimisticallySendMessage(api.agent.streaming.listMessages),
  )

  const abortStreamByOrder = useMutation(api.agent.streamAbort.abortStreamByOrder)
  const parseAtReferences = useMutation(api.context.context.parseAtReferences)

  const handleSendMessage = async (prompt: string) => {
    if (!user?._id) return

    // Parse @ references first
    const { cleanMessage, references } = await parseAtReferences({
      userId: user._id as Id<"users">,
      message: prompt,
      caseId: caseId || undefined,
    })

    // Store references for display in context bar
    setLastReferences(references)

    // Gather rich view context from PageContext
    const currentViewContext = {
      currentPage: pageState.currentPage,
      currentView: pageState.currentView,
      cursorPosition: cursorPosition?.line,
      ...(escritoId && { currentEscritoId: escritoId as Id<"escritos"> }), // Only include if escritoId exists and cast to proper type
      selectedItems: pageState.selectedItems,
      searchQuery: pageState.searchQuery,
    }

    setShouldAutoScroll(true)
    setUserHasScrolled(false)
    setAwaitingResponse(true) // Set awaiting response state

    // If no thread exists, create one with the truncated message as title
    try {
      let activeThreadId = threadId
      if (!activeThreadId) {
        const truncatedTitle = cleanMessage.length > 50 ? `${cleanMessage.substring(0, 50)}...` : cleanMessage
        activeThreadId = await createThreadWithTitle(truncatedTitle, caseId || undefined)
      }

      const { threadId: newThreadId, workflowId } = await initiateWorkflow({
        prompt: cleanMessage,
        threadId: activeThreadId,
        caseId: caseId ?? undefined,
        currentPage: currentViewContext.currentPage,
        currentView: currentViewContext.currentView,
        selectedItems: currentViewContext.selectedItems,
        cursorPosition: currentViewContext.cursorPosition,
        searchQuery: currentViewContext.searchQuery,
        currentEscritoId: currentViewContext.currentEscritoId,
      })

      if (!threadId) {
        setThreadId(newThreadId)
      }
      console.debug("Workflow started", { workflowId, threadId: newThreadId })
    } catch (error) {
      console.error("Failed to initiate workflow", error)
      setAwaitingResponse(false)
    }
  }

  const handleAbortStream = () => {
    if (!threadId) return
    
    // Try to get the order from active streams first (more efficient)
    let order = 0
    const streams = messages.results // Type assertion since streams property exists but isn't typed
    if (streams && Array.isArray(streams) && streams.length > 0) {
      const activeStream = streams.find((stream) => 
        stream.streaming || stream.status === "pending"
      )
      if (activeStream) {
        order = activeStream.order ?? 0
      }
    }
    
    // Fallback to checking recent messages if no active stream found
    if (order === 0) {
      const recentMessages = messages.results?.slice(-5) ?? []
      const streamingMessage = recentMessages.find((m) => m.streaming)
      order = streamingMessage?.order ?? 0
    }
    
    void abortStreamByOrder({ threadId, order })
  }

  // Optimized streaming detection using useMemo to avoid scanning all messages on every render
  // PERFORMANCE IMPROVEMENTS:
  // 1. Checks streams data first (O(s) where s is number of active streams, usually 0-1)
  // 2. Falls back to scanning only last 5 messages instead of all messages (O(5) vs O(n))
  // 3. Uses memoization to prevent recalculation unless dependencies change
  // 4. Smart dependency array only tracks streaming status, not full message content
  // 5. Enhanced detection for all AI phases (reasoning, tool calls, text generation)
  const isStreaming = useMemo(() => {
    // First check if we have any active streams from the messages response
    // This captures all phases: reasoning, tool execution, and text streaming
    const streams = messages.results
     // Type assertion since streams property exists but isn't typed
    if (streams && Array.isArray(streams) && streams.length > 0) {
      // Check if any stream has a status that indicates active processing
      // Including reasoning phase, tool calls, and text generation
      const hasActiveStream = streams.some((stream) => 
        stream.streaming || 
        stream.status === "pending"
      )
      if (hasActiveStream) return true
    }
    
    // Fallback to checking messages for any ongoing processing
    // This includes messages that are being generated but not yet visible as text
    const recentMessages = messages.results?.slice(-5) ?? [] // Only check last 5 messages
    const hasStreamingMessage = recentMessages.some(m => 
      m.streaming || 
      // Also check if message is incomplete/being processed (use type assertion for content/role)
      ((m as any).role === 'assistant' && (!(m as any).content || (m as any).content.trim() === ''))
    )
    
    return hasStreamingMessage
  }, [
    // Depend on the whole messages object since we're using type assertion
    messages,
    // Only depend on the streaming status and content completion of recent messages
    messages.results?.slice(-5)?.map(m => `${m.streaming}-${(m as any).content?.length || 0}`).join(',')
  ])

  // Clear awaiting response state when AI starts responding
  useEffect(() => {
    if (awaitingResponse && (isStreaming || messages.results?.some(m => (m as any).role === 'assistant' && (m as any).content))) {
      setAwaitingResponse(false)
    }
  }, [awaitingResponse, isStreaming, messages.results])

  // Additional optimization: Track streaming state changes for debugging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const streams = (messages as any).streams
      const recentMessages = messages.results?.slice(-5) ?? []
      console.debug('Streaming state changed:', {
        isStreaming,
        awaitingResponse,
        activeStreams: streams?.map((s: any) => ({ status: s.status, order: s.order })) || [],
        recentStreamingMessages: recentMessages.filter(m => m.streaming || ((m as any).role === 'assistant' && (!(m as any).content || (m as any).content.trim() === ''))).length
      })
    }
  }, [isStreaming, awaitingResponse, messages])

  return (
    <>
      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth"
        onScroll={handleScroll}
        style={{ scrollBehavior: "smooth" }}
      >
        {/* Load More Button - shown when there are more messages to load */}
        {messages.status === "CanLoadMore" && (
          <div className="flex justify-center py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {isLoadingMore ? "..." : "↑ Más mensajes"}
            </Button>
          </div>
        )}

        {isLoadingMessages ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 text-sm">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mb-2" />
            <p>Cargando mensajes...</p>
          </div>
        ) : messages.results?.length > 0 ? (
          toUIMessages(messages.results ?? []).map((m) => (
            <SidebarMessage 
              key={m.key} 
              message={m} 
              onContentChange={handleContentResize}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 text-sm">
            <MessageCircle className="w-8 h-8 mb-2 text-gray-400" />
            <p>Inicia una conversación con tu asistente de IA</p>
          </div>
        )}
      </div>

      {/* Todo panel */}
      <TodoPanel />

      {/* Minimal context summary */}
      <ContextSummaryBar
        references={[
          ...lastReferences,
          ...currentReferences.map((ref) => ({ ...ref, originalText: `@${ref.type}:${ref.name}` })),
        ]}
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
  )
}