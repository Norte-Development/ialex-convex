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

import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUIMessages } from "@convex-dev/agent/react";
import { api } from "../../../convex/_generated/api";
import { useConvex, useMutation } from "convex/react";
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
  PromptInputButton,
} from "@/components/ai-elements/prompt-input";
import { Response } from "@/components/ai-elements/response";
import { Actions, Action } from "@/components/ai-elements/actions";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Sources, SourcesTrigger, SourcesContent, Source } from "@/components/ai-elements/source";
import { Copy, RotateCw, Check, AlertCircle, Globe, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Tool } from "@/components/ai-elements/tool";
import type { ChatStatus, ToolUIPart } from "ai";
import { toast } from "sonner";
import { CitationModal } from "@/components/CaseAgent/citation-modal";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { extractCitationsFromToolOutputs } from "@/components/ai-elements/citations";
import type { Id } from "convex/_generated/dataModel";

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
  msg: AgentMessage;
  copiedMessageId: string | null;
  onCopyMessage: (messageId: string, text: string) => void;
  onCitationClick: (id: string, type: string) => void;
  onRetry?: (userMessage: string) => void;
}

type AgentPart = {
  type?: string;
  state?: string;
  text?: string;
  output?: unknown;
  input?: unknown;
  url?: string;
  title?: string;
  mediaType?: string;
  filename?: string;
  [key: string]: unknown;
};

type AgentMessage = {
  _id?: string;
  id?: string;
  role: "user" | "assistant" | "system";
  status?: "pending" | "streaming" | "done" | "failed" | "success";
  order?: number;
  _creationTime?: number;
  text?: string;
  parts?: AgentPart[];
};

// Tool citations are extracted via shared utility in `ai-elements/citations`.

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
      ?.filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("") ||
    "";

  const isUser = msg.role === "user";
  const messageId = msg._id ?? msg.id ?? "";
  const isCopied = copiedMessageId === messageId;

  // Check for active tools
  const toolCalls =
    msg.parts?.filter((p) => typeof p.type === "string" && p.type.startsWith("tool-")) ||
    [];
  const allToolsCompleted =
    toolCalls.length > 0 &&
    toolCalls.every((p) => p.state === "output-available");
  const hasActiveTools = toolCalls.length > 0 && !allToolsCompleted;

  // Extract source parts (from web search etc.)
  const sourceParts = msg.parts?.filter((part) => part.type === "source-url") || [];
  
  // Extract citations from tool outputs (legislation search, fallos, etc.)
  const toolCitations = msg.parts ? extractCitationsFromToolOutputs(msg.parts) : [];

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
          msg.parts.map((part, partIndex: number) => {
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
                      console.log("🔗 [Citations] Citation clicked in message text:", { id, type });
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
                  <ReasoningTrigger className="text-[10px]!" />
                  <ReasoningContent className="group relative px-3! py-2! text-[10px]! space-y-2 max-w-[85%]">
                    {typeof part.text === "string" ? part.text : ""}
                  </ReasoningContent>
                </Reasoning>
              );
            }

            // Renderizar tool calls
            if (part.type?.startsWith("tool-")) {
              const aiSDKState = part.state;
              const outputType = (part.output as { type?: unknown } | undefined)?.type as
                | string
                | undefined;
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

            if (part.type === "source-url") {
              return null;
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
              console.log("🔗 [Citations] Citation clicked in message text (fallback):", { id, type });
              onCitationClick(id, type);
            }}
          >
            {messageText || "..."}
          </Response>
        )}
        {/* Sources - from source-url parts and tool output citations */}
        {(sourceParts.length > 0 || toolCitations.length > 0) && (
          <Sources className="mt-2">
            <SourcesTrigger count={sourceParts.length + toolCitations.length} />
            <SourcesContent>
              {/* Render source-url parts (web search) */}
              {sourceParts.map((part, i: number) => (
                <Source
                  key={`source-${i}`}
                  href={typeof part.url === "string" ? part.url : undefined}
                  title={typeof part.title === "string" ? part.title : undefined}
                  index={i + 1}
                />
              ))}
              {/* Render tool citations (legislation, fallos, etc.) */}
              {toolCitations.map((cit, i: number) => (
                <button
                  key={`cit-${cit.id}-${i}`}
                  onClick={() => {
                    console.log("🔗 [Citations] Citation clicked from sources list:", cit);
                    onCitationClick(cit.id, cit.type);
                  }}
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
                        : cit.type === "document" || cit.type === "case-doc" || cit.type === "doc"
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
  const convex = useConvex();
  const [inputValue, setInputValue] = useState("");
  const [webSearchEnabled, setWebSearchEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("homeAgentWebSearchEnabled");
      return saved === "true";
    }
    return false;
  });
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("homeAgentWebSearchEnabled", String(webSearchEnabled));
  }, [webSearchEnabled]);

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
  const isStreaming =
    (messages as unknown as AgentMessage[] | undefined)?.some(
      (m) => m.status === "streaming",
    ) ?? false;

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
      const result = await sendMessage(message, webSearchEnabled);
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

  // Determinar el estado del chat para el botón de submit (AI SDK expects ChatStatus)
  const chatStatus: ChatStatus = isStreaming ? "streaming" : "ready";

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
      await sendMessage(messageText, webSearchEnabled);
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
              {(messages as unknown as AgentMessage[]).map((msg) => (
                <HomeAgentMessage
                  key={msg._id || msg.id}
                  msg={msg as AgentMessage}
                  copiedMessageId={copiedMessageId}
                  onCopyMessage={handleCopyMessage}
                  onCitationClick={(id, type) => {
                    // For escritos, navigate directly instead of opening the citation modal.
                    if (type === "escrito") {
                      (async () => {
                        try {
                          const escrito = await convex.query(api.functions.documents.getEscrito, {
                            escritoId: id as Id<"escritos">,
                          });
                          navigate(`/caso/${escrito.caseId}/escritos/${id}`);
                        } catch (error) {
                          console.error("Error navigating to escrito from citation:", error);
                          toast.error("No se pudo abrir el escrito");
                        }
                      })();
                      return;
                    }

                    console.log("🔗 [Citations] Opening citation modal:", { id, type });
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
            <div className="flex items-center gap-2">
              <PromptInputButton
                onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                className={webSearchEnabled ? "text-blue-500 bg-blue-50" : ""}
                title={webSearchEnabled ? "Búsqueda web activada" : "Activar búsqueda web"}
              >
                <Globe className="size-4" />
                <span className="text-xs">{webSearchEnabled ? "Web" : ""}</span>
              </PromptInputButton>
            </div>
            <div className="flex-1" />
            <PromptInputSubmit
              disabled={isStreaming ? false : (!inputValue.trim() || messagesLoading)}
              status={chatStatus}
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
