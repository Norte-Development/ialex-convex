/**
 * HomeAgentChat Component
 *
 * Componente reutilizable para chat con el agente legal general (HomeAgent).
 * Incluye soporte completo de streaming en tiempo real.
 *
 * @example
 * ```tsx
 * <HomeAgentChat
 *   threadId="m57a6fd0678c9cs0b28pzt9zh57s5wbf"
 *   onSendMessage={(message) => console.log('Sent:', message)}
 * />
 * ```
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useUIMessages } from "@convex-dev/agent/react";
import { api } from "../../../convex/_generated/api";
import { useMutation } from "convex/react";
import { useHomeThreads } from "./hooks/useHomeThreads";
import {
  Message,
  MessageContent,
} from "@/components/ai-elements/message";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Response } from "@/components/ai-elements/response";
import { Actions, Action } from "@/components/ai-elements/actions";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Copy, RotateCw, Check, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Tool } from "@/components/ai-elements/tool";
import type { ToolUIPart } from "ai";
import { toast } from "sonner";
import { CitationModal } from "@/components/CaseAgent/citation-modal";
import { Button } from "@/components/ui/button";

export interface HomeAgentChatProps {
  /** ID del thread de conversación */
  threadId?: string;
  /** Número inicial de mensajes a cargar (default: 50) */
  initialNumItems?: number;
  /** Callback cuando se envía un mensaje */
  onSendMessage?: (message: string) => void;
  /** Clase CSS personalizada para el contenedor */
  className?: string;
}

interface HomeAgentMessageProps {
  msg: any;
  copiedMessageId: string | null;
  onCopyMessage: (messageId: string, text: string) => void;
  onCitationClick: (id: string, type: string) => void;
  onRetry?: (userMessage: string) => void;
}

/**
 * Componente individual de mensaje
 */
const HomeAgentMessage = ({
  msg,
  copiedMessageId,
  onCopyMessage,
  onCitationClick,
  onRetry,
}: HomeAgentMessageProps) => {
  const messageText =
    msg.text ||
    msg.parts
      ?.filter((p: any) => p.type === "text")
      .map((p: any) => p.text)
      .join("") ||
    "";

  const isUser = msg.role === "user";
  const messageId = msg._id || msg.id;
  const isCopied = copiedMessageId === messageId;

  // Check for active tools
  const toolCalls = msg.parts?.filter((p: any) => p.type?.startsWith("tool-")) || [];
  const allToolsCompleted = toolCalls.length > 0 && toolCalls.every((p: any) => p.state === "output-available");
  const hasActiveTools = toolCalls.length > 0 && !allToolsCompleted;

  return (
    <Message key={messageId} from={msg.role}>
      <MessageContent>
        {/* Show thinking indicator if message is streaming but has no text yet */}
        {!isUser &&
          msg.status === "streaming" &&
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

        {/* Renderizar parts en orden cronológico */}
        {msg.parts && msg.parts.length > 0 ? (
          msg.parts.map((part: any, partIndex: number) => {
            // Renderizar texto
            if (part.type === "text") {
              const displayText = part.text;

              if (isUser) {
                return (
                  <div
                    key={partIndex}
                    className="whitespace-pre-wrap text-sm"
                  >
                    {displayText || "..."}
                  </div>
                );
              } else {
                return (
                  <Response
                    key={partIndex}
                    className="text-sm"
                    onCitationClick={(id, type) => {
                      onCitationClick(id, type);
                    }}
                  >
                    {displayText || "..."}
                  </Response>
                );
              }
            }

            // Renderizar reasoning
            if (part.type === "reasoning") {
              // Simple streaming detection - trust the backend status
              const reasoningIsStreaming = msg.status === "streaming";

              return (
                <Reasoning
                  key={`${messageId}-${partIndex}`}
                  defaultOpen={false}
                  isStreaming={reasoningIsStreaming}
                >
                  <ReasoningTrigger className="!text-[10px]" />
                  <ReasoningContent className="group relative !px-3 !py-2 !text-[10px] space-y-2 max-w-[85%]">
                    {part.text}
                  </ReasoningContent>
                </Reasoning>
              );
            }

            // Renderizar tool calls
            if (part.type?.startsWith("tool-")) {
              const aiSDKState = part.state;
              const outputType = part.output?.type as string | undefined;
              const isError =
                aiSDKState === "output-available" &&
                (outputType?.startsWith("error-") ?? false);

              const toolState = isError
                ? "output-error"
                : aiSDKState === "output-available"
                  ? "output-available"
                  : aiSDKState === "input-available"
                    ? "input-available"
                    : "input-streaming";

              return (
                <Tool
                  key={partIndex}
                  className="mb-2"
                  type={part.type.replace("tool-", "")}
                  state={toolState}
                  output={part.output as ToolUIPart["output"]}
                  input={part.input}
                />
              );
            }

            return null;
          })
        ) : isUser ? (
          <div className="whitespace-pre-wrap text-sm">
            {messageText || "..."}
          </div>
        ) : (
          <Response
            className="text-sm"
            onCitationClick={(id, type) => {
              onCitationClick(id, type);
            }}
          >
            {messageText || "..."}
          </Response>
        )}
        <div className="flex items-center justify-between mt-2">
          <div className="text-[10px] opacity-70">
            {msg._creationTime
              ? formatDistanceToNow(msg._creationTime, {
                  addSuffix: true,
                  locale: es,
                })
              : "ahora"}
          </div>

          {/* Actions - Solo para mensajes de la IA */}
          {!isUser && (
            <Actions>
              <Action
                tooltip={isCopied ? "¡Copiado!" : "Copiar"}
                onClick={() => onCopyMessage(messageId, messageText)}
              >
                {isCopied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Action>

              {onRetry && (
                <Action
                  tooltip="Reintentar"
                  onClick={() => onRetry(messageText)}
                >
                  <RotateCw className="size-4" />
                </Action>
              )}
            </Actions>
          )}
        </div>

        {msg.status === "failed" && (
          <div className="flex items-center gap-2 mt-2 text-red-600 text-sm">
            <AlertCircle className="size-4" />
            <span>Error al procesar el mensaje</span>
          </div>
        )}
      </MessageContent>
    </Message>
  );
};

/**
 * Componente de chat con streaming para HomeAgent
 */
export function HomeAgentChat({
  threadId,
  initialNumItems = 50,
  className = "",
}: HomeAgentChatProps) {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // Estado para el modal de citas
  const [citationModalOpen, setCitationModalOpen] = useState(false);
  const [selectedCitationId, setSelectedCitationId] = useState("");
  const [selectedCitationType, setSelectedCitationType] = useState("");

  // Hook de Convex con streaming habilitado - uses optimized useUIMessages
  const {
    results: messages,
    status,
    loadMore,
  } = useUIMessages(
    api.agents.home.streaming.listMessages,
    threadId ? { threadId } : "skip",
    { initialNumItems, stream: true },
  );

  // Hook para enviar mensajes
  const { sendMessage, messagesLoading } = useHomeThreads({ threadId });

  // Hook para abortar streams
  const abortStreamByOrder = useMutation(
    api.agents.home.streaming.abortStreamByOrder,
  );

  const isLoading = threadId && !messages && status !== "Exhausted";

  // Simple streaming detection - just check if any message has streaming status
  const isStreaming = messages?.some((m: any) => m.status === "streaming") ?? false;

  // Input debe estar deshabilitado si está cargando O si hay streaming
  const isInputDisabled = messagesLoading || isStreaming;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Don't submit if we're streaming (abort should be handled by button click)
    if (isStreaming) {
      return;
    }
    
    if (!inputValue.trim() || isInputDisabled) return;

    const message = inputValue.trim();
    setInputValue("");
    setSendError(null);

    try {
      const result = await sendMessage(message);
      // If no thread was set, navigate to the new thread
      if (!threadId && result.threadId) {
        navigate(`/ai/${result.threadId}`);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Error al enviar el mensaje";
      setSendError(errorMessage);
      toast.error("Error al enviar mensaje", {
        description: errorMessage,
        duration: 5000,
      });
      // Restaurar el mensaje en el input para que el usuario pueda reintentarlo
      setInputValue(message);
    }
  };

  // Determinar el estado del chat para el botón de submit
  const chatStatus = isStreaming ? "streaming" : "awaiting-message";

  // Función para copiar mensaje al clipboard
  const handleCopyMessage = async (messageId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
    }
  };

  // Función para regenerar respuesta
  const handleRegenerateMessage = async (messageText: string) => {
    if (!threadId || isInputDisabled) return;

    setSendError(null);
    try {
      await sendMessage(messageText);
    } catch (error) {
      console.error("Error regenerating message:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Error al regenerar la respuesta";
      setSendError(errorMessage);
      toast.error("Error al regenerar respuesta", {
        description: errorMessage,
        duration: 5000,
      });
    }
  };

  // Función para abortar stream
  const handleAbortStream = useCallback(() => {
    if (!threadId) return;
    const order = messages?.find((m) => m.status === "streaming")?.order ?? 0;
    void abortStreamByOrder({ threadId, order });
  }, [threadId, messages, abortStreamByOrder]);

  // Handle button click - either submit or abort based on streaming state
  const handleButtonClick = (e: React.MouseEvent) => {
    if (isStreaming) {
      e.preventDefault();
      handleAbortStream();
    }
    // For non-streaming state, let the form handle submission naturally
  };

  return (
    <div className={`flex flex-col h-full w-3/4 ${className}`}>
      {/* Conversation with auto-scroll */}
      <Conversation className="flex-1">
        <ConversationContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Cargando mensajes...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">No hay mensajes</div>
            </div>
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
              {messages.map((msg: any) => (
                <HomeAgentMessage
                  key={msg._id || msg.id}
                  msg={msg}
                  copiedMessageId={copiedMessageId}
                  onCopyMessage={handleCopyMessage}
                  onCitationClick={(id, type) => {
                    setCitationModalOpen(true);
                    setSelectedCitationId(id);
                    setSelectedCitationType(type);
                  }}
                  onRetry={handleRegenerateMessage}
                />
              ))}
            </>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Prompt Input */}
      <div className="m-4">
        {sendError && (
          <div className="mb-2 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{sendError}</span>
          </div>
        )}
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputTextarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Escribe tu mensaje..."
            disabled={isInputDisabled}
          />
          <PromptInputToolbar>
            <div className="flex-1" />
            <PromptInputSubmit
              disabled={isStreaming ? false : (!inputValue.trim() || messagesLoading)}
              status={chatStatus as any}
              onClick={handleButtonClick}
              type={isStreaming ? "button" : "submit"}
              aria-label={isStreaming ? "Detener" : "Enviar mensaje"}
            />
          </PromptInputToolbar>
        </PromptInput>
      </div>

      {/* Modal de citas unificado */}
      <CitationModal
        open={citationModalOpen}
        setOpen={setCitationModalOpen}
        citationId={selectedCitationId}
        citationType={selectedCitationType}
      />
    </div>
  );
}
