import { CirclePlus, MessageCircleReply } from "lucide-react";
import { useState } from "react";
import { ChatHistoryDialog } from "./ChatHistoryDialog";
import { Button } from "../ui/button";

interface SidebarHeaderProps {
  onToggle: () => void;
  caseId?: string;
  currentThreadId?: string;
  onThreadSelect?: (threadId: string) => void;
}

export function SidebarHeader({
  onToggle,
  caseId,
  currentThreadId,
  onThreadSelect,
  onNewConversation,
}: SidebarHeaderProps) {
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between p-4 relative">
        <Button
          variant="ghost"
          className="flex items-center justify-center text-xs p-1 gap-1 bg-[#3946D7] text-white"
        >
          <CirclePlus size={16} />
          Nuevo chat
        </Button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setHistoryOpen(true)}
            className="p-1 cursor-pointer"
            title="Historial de conversaciones"
          >
            <MessageCircleReply className="w-5 h-5 text-[#3946D7]" />
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
  );
}
