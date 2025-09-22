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
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react"
import type { Reference, ReferenceWithOriginal } from "./types/reference-types"
import { Button } from "@/components/ui/button"

export function ChatContent() {
  const { threadId, createThreadWithTitle } = useThread()
  const { caseId } = useCase()
  const { escritoId, cursorPosition } = useEscrito()
  const { user } = useAuth()
  const { pageState } = usePage()

  // State for resolved @-references to display in context bar
  const [lastReferences, setLastReferences] = useState<ReferenceWithOriginal[]>([])
  // State for current active references from input
  const [currentReferences, setCurrentReferences] = useState<Reference[]>([])

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
    initialNumItems: 20,
    stream: true,
  })

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

  const sendMessage = useMutation(api.agent.streaming.initiateAsyncStreaming).withOptimisticUpdate(
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

    // If no thread exists, create one with the truncated message as title
    if (!threadId) {
      const truncatedTitle = cleanMessage.length > 50 ? cleanMessage.substring(0, 50) + "..." : cleanMessage

      createThreadWithTitle(truncatedTitle, caseId || undefined)
        .then((newThreadId) => {
          // Send the message after thread is created with rich context
          void sendMessage({
            threadId: newThreadId,
            prompt: cleanMessage, // Use the clean message
            userId: user._id as Id<"users">,
            caseId: caseId || undefined,
            ...currentViewContext,
          }).catch(() => {
            // Handle error if needed
          })
        })
        .catch(() => {
          // Handle error if needed
        })
    } else {
      // Thread exists, send message normally with rich context
      void sendMessage({
        threadId,
        prompt: cleanMessage, // Use the clean message
        userId: user._id as Id<"users">,
        caseId: caseId || undefined,
        ...currentViewContext,
      }).catch(() => {
        // Handle error if needed
      })
    }
  }

  const handleAbortStream = () => {
    if (!threadId) return
    const order = messages.results?.find((m) => m.streaming)?.order ?? 0
    void abortStreamByOrder({ threadId, order })
  }

  const isStreaming = messages.results?.some((m) => m.streaming) ?? false

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

        {messages.results?.length > 0 ? (
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
        isStreaming={isStreaming}
        onAbortStream={handleAbortStream}
        onReferencesChange={setCurrentReferences}
      />
    </>
  )
}
