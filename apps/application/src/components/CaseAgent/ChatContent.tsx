"use client";

import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  optimisticallySendMessage,
  useUIMessages,
} from "@convex-dev/agent/react";
import { MessageCircle, Copy, ThumbsUp, ThumbsDown, AlertTriangle } from "lucide-react";
import { useThread } from "@/context/ThreadContext";
import { useCase } from "@/context/CaseContext";
import { useChatbot } from "@/context/ChatbotContext";
import { ChatInput } from "./ChatInput";
import { useEscrito } from "@/context/EscritoContext";
import { useAuth } from "@/context/AuthContext";
import { usePage } from "@/context/PageContext";
import { useParams } from "react-router-dom";
import { ContextSummaryBar } from "./ContextSummaryBar";
import type { Id } from "convex/_generated/dataModel";
import { useState, useCallback, useMemo } from "react";
import type {
  Reference,
  ReferenceWithOriginal,
  SelectionMeta,
} from "./types/reference-types";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "../ai-elements/conversation";
import { tracking } from "@/lib/tracking";
import { Message, MessageContent, MessageAvatar } from "../ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "../ai-elements/reasoning";
import { Sources, SourcesTrigger, SourcesContent, Source } from "../ai-elements/source";
import { Actions, Action } from "../ai-elements/actions";
import { Tool } from "../ai-elements/tool";
import { MessageText } from "../ai-elements/message-text";
import { CitationModal } from "./citation-modal";
import { SelectionChip } from "./SelectionChip";
import { cn } from "@/lib/utils";
import type { ToolUIPart } from "ai";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Extended message type that includes status property from Convex agent
type AgentMessage = {
  id: string;
  key: string;
  role: "user" | "assistant" | "system";
  status?: "pending" | "streaming" | "done" | "failed" | "success";
  order?: number;
  parts?: Array<{
    type: string;
    text?: string;
    [key: string]: unknown;
  }>;
};

/** Citation extracted from tool outputs */
interface ToolCitation {
  id: string;
  type: string;
  title: string;
  url?: string;
}

/**
 * Extracts citations from tool outputs in message parts.
 * Supports multiple output shapes depending on the underlying tool/runtime:
 * - output.type === "json" with output.value.citations
 * - output.citations directly (some tool adapters)
 * - output.value being a JSON string containing { citations: [...] }
 */
function extractCitationsFromToolOutputs(parts: unknown[]): ToolCitation[] {
  const citations: ToolCitation[] = [];
  const seen = new Set<string>();

  const addCitation = (raw: unknown) => {
    const c = raw as { id?: unknown; type?: unknown; title?: unknown; url?: unknown };
    if (!c?.id || !c?.type) return;
    const id = String(c.id);
    const type = String(c.type);
    const key = `${type}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    citations.push({
      id,
      type,
      title: String(c.title || "Fuente"),
      url: c.url ? String(c.url) : undefined,
    });
  };

  const tryExtractFromContainer = (container: unknown) => {
    if (!container) return;
    const obj = container as { citations?: unknown };
    const arr = obj.citations;
    if (!Array.isArray(arr)) return;
    for (const raw of arr) addCitation(raw);
  };

  const tryParseJsonString = (value: unknown): unknown => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Fast check to avoid parsing arbitrary strings.
    if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return null;
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  };

  for (const part of parts) {
    const p = part as {
      type?: string;
      state?: string;
      output?: unknown;
    };

    if (!p.type?.startsWith("tool-")) continue;
    if (p.state !== "output-available") continue;

    const output = p.output as any;
    if (!output) continue;

    // Common case: ai-sdk ToolUIPart output wrapper { type, value }
    tryExtractFromContainer(output?.value);
    // Some adapters: citations directly on output
    tryExtractFromContainer(output);

    // Handle stringified JSON in output.value (or output itself)
    const parsedFromValue = tryParseJsonString(output?.value);
    if (parsedFromValue) tryExtractFromContainer(parsedFromValue);
    const parsedFromOutput = tryParseJsonString(output);
    if (parsedFromOutput) tryExtractFromContainer(parsedFromOutput);
  }

  return citations;
}

export function ChatContent({ threadId }: { threadId: string | undefined }) {
  const { createThreadWithTitle, setThreadId } = useThread();
  const { caseId } = useCase();
  const { escritoId, cursorPosition } = useEscrito();
  const { user } = useAuth();
  const { pageState } = usePage();
  const { pendingPrompt, setPendingPrompt } = useChatbot();
  const { documentId } = useParams();

  // State for resolved @-references to display in context bar
  const [lastReferences, setLastReferences] = useState<ReferenceWithOriginal[]>(
    [],
  );
  // State for current active references from input
  const [currentReferences, setCurrentReferences] = useState<Reference[]>([]);
  // State for local UI parts (selections) by messageId
  const [messageLocalParts, setMessageLocalParts] = useState<
    Record<string, Array<{ type: "selection"; selection: SelectionMeta }>>
  >({});

  // Web search toggle state
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  // Citation modal state
  const [citationOpen, setCitationOpen] = useState(false);
  const [citationId, setCitationId] = useState("");
  const [citationType, setCitationType] = useState("");

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
    { initialNumItems: 50, stream: true },
  );

  // Only show messages when there is an active thread
  // This ensures the UI clears immediately when starting a new conversation
  const visibleMessages = threadId ? messages : [];

  // Clear pending prompt when ChatInput confirms it has been processed
  const handleInitialPromptProcessed = useCallback(() => {
    setPendingPrompt(null);
  }, [setPendingPrompt]);

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
    async (prompt: string, activeReferences?: Reference[]) => {
      if (!user?._id) return;

      // Separate selection references from regular references
      const selectionRefs = (activeReferences || []).filter(
        (ref) => ref.type === "selection",
      );
      const regularRefs = (activeReferences || []).filter(
        (ref) => ref.type !== "selection",
      );

      // Convert regular references to resolvedReferences format for backend
      const resolvedReferences = regularRefs.map((ref) => ({
        type: ref.type as "client" | "document" | "escrito" | "case",
        id: ref.id,
        name: ref.name,
        originalText: `@${ref.type}:${ref.name}`,
      }));

      // Map selection references to escrito references with selection metadata
      const selectionResolvedRefs = selectionRefs
        .filter((ref) => ref.selection)
        .map((ref) => ({
          type: "escrito" as const,
          id: ref.selection!.escritoId,
          name: ref.name,
          originalText: ref.name,
          selection: ref.selection,
        }));

      // Combine all resolved references
      const allResolvedReferences = [
        ...resolvedReferences,
        ...selectionResolvedRefs,
      ];

      // Parse @ references with resolved references from frontend (only regular refs, not selections)
      const { cleanMessage, references } = await parseAtReferences({
        userId: user._id as Id<"users">,
        message: prompt,
        resolvedReferences: resolvedReferences,
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
        ...(documentId && { currentDocumentId: documentId as Id<"documents"> }), // Only include if documentId exists and cast to proper type
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

          // Track AI chat started
          tracking.aiChatStarted({
            threadId: activeThreadId,
            context: caseId ? "case" : "home",
            caseId: caseId || undefined,
          });
        }

        // Track message sent
        tracking.aiMessageSent({
          threadId: activeThreadId,
          messageLength: cleanMessage.length,
          hasReferences: references.length > 0,
        });

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
          currentDocumentId: currentViewContext.currentDocumentId, // Add this line
          resolvedReferences: allResolvedReferences,
          webSearch: webSearchEnabled,
        });

        // Store local parts (selections) for this message
        if (selectionRefs.length > 0 && messageId) {
          setMessageLocalParts((prev) => ({
            ...prev,
            [messageId]: selectionRefs
              .filter((ref) => ref.selection)
              .map((ref) => ({
                type: "selection" as const,
                selection: ref.selection!,
              })),
          }));
        }

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
        const errorThreadId = threadId || "unknown";
        tracking.aiError({
          errorType: error instanceof Error ? error.message : "unknown",
          threadId: errorThreadId,
        });
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
    const order =
      visibleMessages?.find((m) => m.status === "streaming")?.order ?? 0;
    void abortStreamByOrder({ threadId, order });

    // Track chat abort
    tracking.aiChatAborted({ threadId });
  }, [threadId, visibleMessages, abortStreamByOrder]);

  // Simple streaming detection - only if a thread exists
  const isStreaming =
    !!threadId &&
    (visibleMessages?.some((m) => m.status === "streaming") ?? false);

  const combinedReferences = useMemo(
    () => [
      ...lastReferences,
      ...currentReferences
        .filter((ref) => ref.type !== "selection")
        .map((ref) => ({
          ...ref,
          originalText: `@${ref.type}:${ref.name}`,
        })),
    ],
    [lastReferences, currentReferences],
  );

  return (
    <>
      {/* Web search hallucination warning */}
      {webSearchEnabled && (
        <div className="mb-2">
          <Alert className="border-amber-400 bg-amber-50">
            <AlertTriangle className="size-4 text-amber-600" />
            <AlertTitle className="text-amber-900 text-xs">
              Búsqueda web activada
            </AlertTitle>
            <AlertDescription className="text-[11px] text-amber-800">
              Las respuestas con búsqueda web son más propensas a alucinaciones. Verifica siempre la información con fuentes confiables antes de usarla en tu caso.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Messages area with auto-scroll */}
      <Conversation className="flex-1">
        <ConversationContent className="space-y-3">
          {(!threadId || visibleMessages?.length === 0) ? (
            <ConversationEmptyState
              icon={<MessageCircle className="w-12 h-12" />}
              title="Inicia una conversación"
              description="Escribe un mensaje para comenzar a chatear con tu asistente de IA"
            />
          ) : (
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
              {visibleMessages.map((m) => (
                <MessageItem
                  key={m.id}
                  message={m}
                  user={user}
                  localParts={messageLocalParts[m.id]}
                  onCitationClick={(id, type) => {
                    setCitationOpen(true);
                    setCitationId(id);
                    setCitationType(type);
                  }}
                />
              ))}
            </>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

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
        initialPrompt={pendingPrompt || undefined}
        onInitialPromptProcessed={handleInitialPromptProcessed}
        webSearchEnabled={webSearchEnabled}
        onWebSearchToggle={setWebSearchEnabled}
      />

      {/* Citation modal */}
      <CitationModal
        open={citationOpen}
        setOpen={setCitationOpen}
        citationId={citationId}
        citationType={citationType}
      />
    </>
  );
}

// Separate component for rendering individual messages
type MessageItemProps = {
  message: AgentMessage;
  user: { name: string } | null | undefined;
  localParts?: Array<{ type: "selection"; selection: SelectionMeta }>;
  onCitationClick: (id: string, type: string) => void;
};

function MessageItem({
  message,
  user,
  localParts,
  onCitationClick,
}: MessageItemProps) {
  const isUser = message.role === "user";

  // Calculate messageText for the copy button and empty checks
  const messageText =
    message.parts
      ?.filter((part) => part.type === "text")
      .map((part: any) => part.text)
      .join("") || "";

  // Tool call detection for thinking indicator
  const toolCalls =
    message.parts?.filter((part) => (part as any).type?.startsWith("tool-")) ||
    [];
  const hasActiveTools =
    toolCalls.length > 0 &&
    !toolCalls.every((part: any) => part.state === "output-available");

  // Extract source-url parts (web search, etc.)
  const sourceParts =
    message.parts?.filter((part) => part.type === "source-url") || [];

  // Extract citations from tool outputs (legislation, fallos, etc.)
  const toolCitations = message.parts
    ? extractCitationsFromToolOutputs(message.parts as unknown[])
    : [];

  return (
    <Message
      from={message.role}
      className={cn(
        "!justify-start",
        isUser ? "!flex-row-reverse" : "!flex-row",
      )}
    >
      <MessageAvatar
        src={isUser ? "" : "/logo.ico"}
        name={isUser ? user?.name || "Usuario" : "iAlex"}
        className={cn("shrink-0", isUser ? "ml-2" : "mr-2")}
      />

      <MessageContent
        className={cn(
          "group relative !rounded-lg !px-3 !py-2 !text-[12px] shadow-sm space-y-2 max-w-[85%]",
          isUser && "!bg-[#F3F4F6] !text-black",
          !isUser && "!bg-[#F3F4F6] !text-black",
          message.status === "failed" &&
            "!bg-red-100 !text-red-800 border-l-2 border-red-400",
        )}
      >
        {/* Thinking indicator */}
        {!isUser &&
          message.status === "streaming" &&
          (!messageText || messageText.trim() === "") && (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
              <span className="text-xs text-gray-500 italic">
                {hasActiveTools ? "Procesando herramientas..." : "Pensando..."}
              </span>
            </div>
          )}

        {/* Selection chips for user messages */}
        {isUser && localParts && localParts.length > 0 && (
          <div className="flex flex-col gap-2">
            {localParts.map(
              (part, idx) =>
                part.type === "selection" && (
                  <SelectionChip key={idx} selection={part.selection} />
                ),
            )}
          </div>
        )}

        {/* Message parts */}
        {message.parts?.map((part, index) => {
          if (part.type === "text") {
            const displayText = (part as any).text || "";
            const textPreview = displayText
              .substring(0, 20)
              .replace(/\s/g, "_");

            return (
              <div
                key={`text-${index}-${textPreview}`}
                className="prose prose-sm max-w-none whitespace-pre-wrap"
              >
                <MessageText
                  text={displayText}
                  renderMarkdown={true}
                  onCitationClick={!isUser ? onCitationClick : undefined}
                />
              </div>
            );
          }

          if (part.type === "reasoning") {
            const reasoningText = (part.text || "") as string & React.ReactNode;
            return (
              <Reasoning
                key={`${message.id}-${index}`}
                defaultOpen={false}
                isStreaming={message.status === "streaming"}
              >
                <ReasoningTrigger className="!text-[10px]" />
                <ReasoningContent className="group relative !px-3 !py-2 !text-[10px] space-y-2 max-w-[85%]">
                  {reasoningText}
                </ReasoningContent>
              </Reasoning>
            );
          }

          if (part.type === "source-url") {
            return null;
          }

          if (part.type === "file") {
            const fileUrl = (part as any).url;
            const mediaType = (part as any).mediaType;
            const filename = (part as any).filename || "";

            if (mediaType?.startsWith("image/")) {
              return (
                <div
                  key={`file-img-${index}-${filename.substring(0, 20)}`}
                  className="mt-2"
                >
                  <img
                    src={fileUrl}
                    alt={filename || "Attached image"}
                    className="max-w-full h-auto rounded"
                  />
                </div>
              );
            }

            return (
              <div
                key={`file-doc-${index}-${filename.substring(0, 20)}`}
                className="text-xs bg-gray-50 border border-gray-200 rounded p-2"
              >
                <strong>File:</strong> {filename || "Unknown file"}
              </div>
            );
          }

          if (part.type.startsWith("tool-")) {
            const aiSDKState = (part as any).state;
            const outputType = (part as any)?.output?.type as
              | string
              | undefined;
            const isError =
              aiSDKState === "output-available" &&
              (outputType?.startsWith("error-") ?? false);
            const toolName = part.type.replace("tool-", "");

            const toolState = isError
              ? "output-error"
              : aiSDKState === "output-available"
                ? "output-available"
                : aiSDKState === "input-available"
                  ? "input-available"
                  : "input-streaming";

            return (
              <Tool
                key={`tool-${toolName}-${index}-${aiSDKState}`}
                className="mb-4"
                type={toolName}
                state={toolState}
                output={(part as any)?.output as ToolUIPart["output"]}
                input={(part as any)?.input}
              />
            );
          }

          return null;
        })}

        {/* Sources - from source-url parts and tool output citations */}
        {(sourceParts.length > 0 || toolCitations.length > 0) && (
          <Sources className="mt-2">
            <SourcesTrigger count={sourceParts.length + toolCitations.length} />
            <SourcesContent>
              {/* Render source-url parts (web search) */}
              {sourceParts.map((part: any, i: number) => (
                <Source
                  key={`source-${i}`}
                  href={part.url}
                  title={part.title}
                  index={i + 1}
                />
              ))}
              {/* Render tool citations (legislation, fallos, etc.) */}
              {toolCitations.map((cit, i) => (
                <button
                  key={`cit-${cit.id}-${i}`}
                  onClick={() => onCitationClick(cit.id, cit.type)}
                  className="flex items-center gap-2.5 p-2 rounded-md hover:bg-muted/80 transition-all duration-200 no-underline group/source w-full text-left"
                >
                  <div className="flex items-center justify-center h-5 w-5 shrink-0 rounded-full bg-background border text-[10px] font-medium text-muted-foreground group-hover/source:text-foreground group-hover/source:border-primary/20">
                    {sourceParts.length + i + 1}
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="text-xs font-medium truncate text-foreground/90 group-hover/source:text-primary">
                      {cit.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate opacity-70">
                      {cit.type === "leg"
                        ? "Legislación"
                        : cit.type === "fallo"
                        ? "Jurisprudencia"
                        : cit.type === "document"
                        ? "Documento"
                        : cit.type === "case-doc"
                        ? "Documento"
                        : cit.type === "doc"
                        ? "Documento"
                        : cit.type === "escrito"
                        ? "Escrito"
                        : cit.type}
                    </span>
                  </div>
                </button>
              ))}
            </SourcesContent>
          </Sources>
        )}

        {/* Failed status */}
        {!isUser && message.status === "failed" && (
          <div className="flex items-center gap-1 mt-2 text-red-600">
            <span className="text-xs">❌ Error al procesar el mensaje</span>
          </div>
        )}

        {/* Actions */}
        {!isUser && message.status !== "streaming" && (
          <Actions className="mt-2 transition-opacity">
            <Action
              tooltip="Copiar respuesta"
              onClick={() => navigator.clipboard.writeText(messageText)}
              className="cursor-pointer"
            >
              <Copy size={14} className="text-gray-500" />
            </Action>
            <Action tooltip="Me gusta" className="cursor-pointer">
              <ThumbsUp size={14} className="text-gray-500" />
            </Action>
            <Action tooltip="No me gusta" className="cursor-pointer">
              <ThumbsDown size={14} className="text-gray-500" />
            </Action>
          </Actions>
        )}
      </MessageContent>
    </Message>
  );
}
