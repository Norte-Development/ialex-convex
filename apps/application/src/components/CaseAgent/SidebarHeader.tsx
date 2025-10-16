import { MessageCircle, X, History, Plus } from "lucide-react"
import { useState } from "react"
import { ChatHistoryDialog } from "./ChatHistoryDialog"

interface SidebarHeaderProps {
  onToggle: () => void
  caseId?: string
  currentThreadId?: string
  onThreadSelect?: (threadId: string) => void
  onNewConversation?: () => void
}

export function SidebarHeader({
  onToggle,
  caseId,
  currentThreadId,
  onThreadSelect,
  onNewConversation,
}: SidebarHeaderProps) {
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-gray-800">Alex - Tu agente legal</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onNewConversation}
            className="p-1 hover:bg-gray-200 rounded-full transition-colors"
            title="Nueva conversación"
          >
            <Plus className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={() => setHistoryOpen(true)}
            className="p-1 hover:bg-gray-200 rounded-full transition-colors"
            title="Historial de conversaciones"
          >
            <History className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <ChatHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        caseId={caseId}
        currentThreadId={currentThreadId}
        onThreadSelect={onThreadSelect || (() => {})}
      />
    </>
  )
} 