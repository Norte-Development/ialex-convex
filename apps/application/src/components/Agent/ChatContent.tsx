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

export function ChatContent() {
  const { threadId, createThreadWithTitle } = useThread()
  const { caseId } = useCase()

  const messages = useThreadMessages(
    api.agent.streaming.listMessages,
    threadId ? { threadId } : "skip",
    { initialNumItems: 10, stream: true },
  )

  const sendMessage = useMutation(api.agent.streaming.initiateAsyncStreaming).withOptimisticUpdate(
    optimisticallySendMessage(api.agent.streaming.listMessages),
  )

  const abortStreamByOrder = useMutation(api.agent.streamAbort.abortStreamByOrder)

  const handleSendMessage = (prompt: string) => {
    // If no thread exists, create one with the truncated message as title
    if (!threadId) {
      const truncatedTitle = prompt.length > 50 
        ? prompt.substring(0, 50) + "..." 
        : prompt
      
      createThreadWithTitle(truncatedTitle, caseId || undefined).then((newThreadId) => {
        // Send the message after thread is created
        void sendMessage({ threadId: newThreadId, prompt }).catch(() => {
          // Handle error if needed
        })
      }).catch(() => {
        // Handle error if needed
      })
    } else {
      // Thread exists, send message normally
      void sendMessage({ threadId, prompt }).catch(() => {
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
            <p>Start a conversation with your AI assistant</p>
          </div>
        )}
      </div>

      {/* Input area */}
      <ChatInput
        onSendMessage={handleSendMessage}
        isStreaming={isStreaming}
        onAbortStream={handleAbortStream}
      />
    </>
  )
} 