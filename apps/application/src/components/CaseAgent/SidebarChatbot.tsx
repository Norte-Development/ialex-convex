import type React from "react";
import { useCallback, useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { ResizeHandle } from "./ResizeHandle";
import { SidebarHeader } from "./SidebarHeader";
import { ChatContent } from "./ChatContent";
import type { SidebarChatbotProps } from "./types";
import { useCase } from "@/context/CaseContext";
import { useThread } from "@/context/ThreadContext";

export default function SidebarChatbot({
  isOpen,
  onToggle,
  width,
  onWidthChange,
  onResizeStart,
  onResizeEnd,
}: SidebarChatbotProps) {
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { caseId } = useCase();
  const { threadId, setThreadId } = useThread();

  // Resize functionality
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      onResizeStart();
    },
    [onResizeStart],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = window.innerWidth - e.clientX;
      const minWidth = 280;
      const maxWidth = 600;

      const constrainedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
      onWidthChange(constrainedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      onResizeEnd();
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, onWidthChange, onResizeEnd]);

  const handleNewConversation = useCallback(() => {
    // Clear the current thread to start fresh
    setThreadId(undefined);
    // Clear the hash to reflect no active thread
    window.location.hash = "";
  }, [setThreadId]);

  return (
    <>
      {/* Sidebar */}
      <div
        data-tutorial="case-chat"
        ref={sidebarRef}
        className={cn(
          "fixed bg-[#E2EFF7] border-l border-gray-200 shadow-lg transform flex flex-col",
          // Desktop: normal sidebar behavior below navbar
          "md:top-10 md:right-0 md:h-[calc(100vh-41px)] md:z-20",
          // Mobile: fullscreen above everything with dynamic viewport and safe areas
          "max-md:inset-0 max-md:w-full max-md:h-dvh max-md:z-50",
          "max-md:pt-[env(safe-area-inset-top)] max-md:pb-[env(safe-area-inset-bottom)]",
          isOpen ? "translate-x-0" : "translate-x-full",
          isResizing
            ? "transition-none"
            : "transition-transform duration-300 ease-in-out",
        )}
        style={{ width: window.innerWidth < 768 ? "100%" : `${width}px` }}
      >
        {/* Resize Handle - only on desktop */}
        <div className="hidden md:block">
          <ResizeHandle onMouseDown={handleMouseDown} />
        </div>

        {/* Header */}
        <SidebarHeader
          onToggle={onToggle}
          caseId={caseId || undefined}
          currentThreadId={threadId || undefined}
          onThreadSelect={setThreadId}
          onNewConversation={handleNewConversation}
        />

        {/* Chat Content */}
        <div className="flex-1 flex flex-col min-h-0 border-transparent">
          <ChatContent threadId={threadId} />
        </div>
      </div>

      {/* Resize overlay */}
      {isResizing && <div className="fixed inset-0 z-50 cursor-col-resize" />}
    </>
  );
}
