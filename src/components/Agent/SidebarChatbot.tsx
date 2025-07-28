import type React from "react"

import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import {
  optimisticallySendMessage,
  toUIMessages,
  useSmoothText,
  useThreadMessages,
  type UIMessage,
} from "@convex-dev/agent/react"
import { useCallback, useEffect, useState, useRef } from "react"
import { cn } from "@/lib/utils"
import { MessageCircle, X, Send, Square, GripVertical } from "lucide-react"
import { useThread } from "@/context/ThreadContext"
import { useCase } from "@/context/CaseContext"

interface SidebarChatbotProps {
  isOpen: boolean
  onToggle: () => void
  width: number
  onWidthChange: (width: number) => void
  onResizeStart: () => void
  onResizeEnd: () => void
}

export default function SidebarChatbot({
  isOpen,
  onToggle,
  width,
  onWidthChange,
  onResizeStart,
  onResizeEnd,
}: SidebarChatbotProps) {
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  // Resize functionality
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsResizing(true)
      onResizeStart()
    },
    [onResizeStart],
  )

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return

      const newWidth = window.innerWidth - e.clientX
      const minWidth = 280
      const maxWidth = 600

      const constrainedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth)
      onWidthChange(constrainedWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      onResizeEnd()
    }

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
  }, [isResizing, onWidthChange, onResizeEnd])

  return (
    <>
      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed bottom-6 right-6 z-30 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-105"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={cn(
          "fixed top-14 right-0 h-[calc(100vh-56px)] bg-white border-l border-gray-200 shadow-lg z-20 transform flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full",
          isResizing ? "transition-none" : "transition-transform duration-300 ease-in-out",
        )}
        style={{ width: `${width}px` }}
      >
        {/* Resize Handle */}
        <div
          className="absolute left-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors group"
          onMouseDown={handleMouseDown}
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-3 h-8 bg-gray-300 hover:bg-blue-500 rounded-r-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="w-3 h-3 text-white" />
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-800">Alex - Tu agente legal</h2>
          </div>
          <button onClick={onToggle} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Chat Content */}
        <div className="flex-1 flex flex-col min-h-0">
          <ChatContent />
        </div>
      </div>

      {/* Resize overlay */}
      {isResizing && <div className="fixed inset-0 z-50 cursor-col-resize" />}
    </>
  )
}

function ChatContent() {
  const { threadId, createThreadWithTitle } = useThread()
  const { caseId } = useCase()
  console.log("caseId", caseId)
  const messages = useThreadMessages(
    api.agent.streaming.listMessages,
    threadId ? { threadId } : "skip",
    { initialNumItems: 10, stream: true },
  )

  const sendMessage = useMutation(api.agent.streaming.initiateAsyncStreaming).withOptimisticUpdate(
    optimisticallySendMessage(api.agent.streaming.listMessages),
  )

  const abortStreamByOrder = useMutation(api.agent.streamAbort.abortStreamByOrder)

  const [prompt, setPrompt] = useState("")

  function onSendClicked() {
    if (prompt.trim() === "") return
    
    const trimmedPrompt = prompt.trim()
    setPrompt("")

    // If no thread exists, create one with the truncated message as title
    if (!threadId) {
      const truncatedTitle = trimmedPrompt.length > 50 
        ? trimmedPrompt.substring(0, 50) + "..." 
        : trimmedPrompt
      
      createThreadWithTitle(truncatedTitle, caseId || undefined).then((newThreadId) => {
        // Send the message after thread is created
        void sendMessage({ threadId: newThreadId, prompt: trimmedPrompt }).catch(() => setPrompt(trimmedPrompt))
      }).catch(() => setPrompt(trimmedPrompt))
    } else {
      // Thread exists, send message normally
      void sendMessage({ threadId, prompt: trimmedPrompt }).catch(() => setPrompt(trimmedPrompt))
    }
  }

  const isStreaming = messages.results?.some((m) => m.streaming)

  return (
    <>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.results?.length > 0 ? (
          toUIMessages(messages.results ?? []).map((m) => <SidebarMessage key={m.key} message={m} />)
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 text-sm">
            <MessageCircle className="w-8 h-8 mb-2 text-gray-400" />
            <p>Start a conversation with your AI assistant</p>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            onSendClicked()
          }}
        >
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            placeholder="¿En que trabajamos hoy?"
          />
          {isStreaming ? (
            <button
              className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
              onClick={() => {
                const order = messages.results.find((m) => m.streaming)?.order ?? 0
                void abortStreamByOrder({ threadId: threadId || "", order })
              }}
              type="button"
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!prompt.trim()}
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>
    </>
  )
}

function SidebarMessage({ message }: { message: UIMessage }) {
  const isUser = message.role === "user"
  const [visibleText] = useSmoothText(message.content, {
    startStreaming: message.status === "streaming",
  })

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "rounded-lg px-3 py-2 max-w-[85%] text-sm whitespace-pre-wrap shadow-sm",
          isUser ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800",
          {
            "bg-green-100 text-green-800": !isUser && message.status === "streaming",
            "bg-red-100 text-red-800": message.status === "failed",
          },
        )}
      >
        {visibleText}
      </div>
    </div>
  )
}
