import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import {
  optimisticallySendMessage,
  toUIMessages,
  useThreadMessages,
} from "@convex-dev/agent/react"
import { MessageCircle } from "lucide-react"
import { useThread } from "@/context/ThreadContext"
import { useCase } from "@/context/CaseContext"
import { SidebarMessage } from "./SidebarMessage"
import { ChatInput } from "./ChatInput"
import { useEscrito } from "@/context/EscritoContext"
import { useAuth } from "@/context/AuthContext"
import { usePage } from "@/context/PageContext"
import { ContextSummaryBar } from "./ContextSummaryBar"
import { TodoPanel } from "./TodoPanel"
import { Id } from "convex/_generated/dataModel"
import { useState } from "react"
import type { Reference, ReferenceWithOriginal } from "./types/reference-types"


export function ChatContent() {
  const { threadId, createThreadWithTitle } = useThread()
  const { caseId } = useCase()
  const { escritoId, cursorPosition } = useEscrito()
  const { user } = useAuth()
  const { pageState } = usePage()
  
  // State for resolved @-references to display in context bar
  const [lastReferences, setLastReferences] = useState<ReferenceWithOriginal[]>([]);
  // State for current active references from input
  const [currentReferences, setCurrentReferences] = useState<Reference[]>([]);

  // Handle removing references from context bar
  const handleRemoveReference = (index: number) => {
    if (index < lastReferences.length) {
      // Removing from lastReferences (already sent references)
      setLastReferences(prev => prev.filter((_, i) => i !== index));
    } else {
      // Removing from currentReferences (active input references)
      const currentIndex = index - lastReferences.length;
      setCurrentReferences(prev => prev.filter((_, i) => i !== currentIndex));
    }
  };

  const messages = useThreadMessages(
    api.agent.streaming.listMessages,
    threadId ? { threadId } : "skip",
    { initialNumItems: 10, stream: true },
  )

  const sendMessage = useMutation(api.agent.streaming.initiateAsyncStreaming).withOptimisticUpdate(
    optimisticallySendMessage(api.agent.streaming.listMessages),
  )

  const abortStreamByOrder = useMutation(api.agent.streamAbort.abortStreamByOrder)
  const parseAtReferences = useMutation(api.context.context.parseAtReferences)

  const handleSendMessage = async (prompt: string) => {
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

    // If no thread exists, create one with the truncated message as title
    if (!threadId) {
      const truncatedTitle = cleanMessage.length > 50
        ? cleanMessage.substring(0, 50) + "..."
        : cleanMessage

      createThreadWithTitle(truncatedTitle, caseId || undefined).then((newThreadId) => {
        // Send the message after thread is created with rich context
        void sendMessage({
          threadId: newThreadId,
          prompt: cleanMessage, // Use the clean message
          userId: user._id as Id<"users">,
          caseId: caseId || undefined,
          ...currentViewContext
        }).catch(() => {
          // Handle error if needed
        })
      }).catch(() => {
        // Handle error if needed
      })
    } else {
      // Thread exists, send message normally with rich context
      void sendMessage({
        threadId,
        prompt: cleanMessage, // Use the clean message
        userId: user._id as Id<"users">,
        caseId: caseId || undefined,
        ...currentViewContext
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
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.results?.length > 0 ? (
          toUIMessages(messages.results ?? []).map((m) => (
            <SidebarMessage key={m.key} message={m} />
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
        references={[...lastReferences, ...currentReferences.map(ref => ({...ref, originalText: `@${ref.type}:${ref.name}`}))]} 
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