"use client";

import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { optimisticallySendMessage, useUIMessages } from "@convex-dev/agent/react";
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
  useCallback,
  useMemo,
} from "react";
import type { Reference, ReferenceWithOriginal } from "./types/reference-types";
import { Button } from "@/components/ui/button";

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

  // Simple scroll management
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Handle removing references from context bar
  const handleRemoveReference = useCallback(
    (index: number) => {
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
    },
    [lastReferences.length],
  );

  const {
    results: messages,
    status,
    loadMore,
  } = useUIMessages(
    api.agents.case.streaming.listMessages,
    !threadId ? "skip" : ({ threadId } as any),
    { initialNumItems: 10, stream: true },
  );

  console.log("messages", messages);

  // Simple auto-scroll like HomeAgentPage
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Clear references when thread changes to prevent trailing state
  useEffect(() => {
    setLastReferences([]);
    setCurrentReferences([]);
  }, [threadId]);

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
    const order = messages?.find((m) => m.status === "streaming")?.order ?? 0;
    void abortStreamByOrder({ threadId, order });
  }, [threadId, messages, abortStreamByOrder]);

  // Simple streaming detection - just check if any message has streaming status
  const isStreaming = messages?.some((m) => m.status === "streaming") ?? false;

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
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages?.length > 0 ? (
          <>
            {status === "CanLoadMore" && (
              <div className="flex justify-center py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => loadMore(20)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  ↑ Más mensajes
                </Button>
              </div>
            )}
            {messages.map((m) => (
              <SidebarMessage key={m.key} message={m} />
            ))}
            <div ref={messagesEndRef} />
          </>
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
        isStreaming={isStreaming}
        onAbortStream={handleAbortStream}
        onReferencesChange={setCurrentReferences}
      />
    </>
  );
}

