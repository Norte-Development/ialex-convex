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

import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUIMessages } from "@convex-dev/agent/react";
import { api } from "../../../convex/_generated/api";
import { useConvex, useMutation, useAction } from "convex/react";
import { useHomeThreads } from "./hooks/useHomeThreads";
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
import { Globe, AlertTriangle, Paperclip, AlertCircle } from "lucide-react";
import type { ChatStatus } from "ai";
import { toast } from "sonner";
import { CitationModal } from "@/components/CaseAgent/citation-modal";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Id } from "convex/_generated/dataModel";
import { HomeAgentAttachmentPreview } from "./HomeAgentAttachmentPreview";
import { HomeAgentMessage, type AgentMessage } from "./HomeAgentMessage";
import type { HomeAgentMediaRef } from "./types";
import { HOME_AGENT_MAX_MEDIA_BYTES } from "./types";

// Tool citations are extracted via shared utility in `ai-elements/citations`.

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
  const [mediaAttachments, setMediaAttachments] = useState<HomeAgentMediaRef[]>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem("homeAgentWebSearchEnabled", String(webSearchEnabled));
  }, [webSearchEnabled]);

  useEffect(() => {
    setMediaAttachments([]);
  }, [threadId]);

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
  const getUploadUrl = useAction(api.agents.home.media.getHomeMediaUploadUrl);

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
  const isInputDisabled = messagesLoading || isStreaming || isUploadingMedia;

  const handleFileButtonClick = () => fileInputRef.current?.click();

  const handleRemoveMedia = useCallback((gcsObject: string) => {
    setMediaAttachments((prev) =>
      prev.filter((item) => item.gcsObject !== gcsObject),
    );
  }, []);

  const handleFilesSelected = useCallback(
    async (filesInput: FileList | File[]) => {
      if (isUploadingMedia) {
        toast.error("Espera a que termine la carga actual.");
        return;
      }

      const files = Array.from(filesInput as ArrayLike<File>);
      if (files.length === 0) {
        return;
      }

      // Reset input value to allow selecting same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setIsUploadingMedia(true);
      try {
        for (const file of files) {
          const kind =
            file.type === "application/pdf"
              ? "pdf"
              : file.type.startsWith("image/")
                ? "image"
                : null;

          if (!kind) {
            toast.error("Formato no soportado", {
              description: `${file.name} no es una imagen ni PDF.`,
            });
            continue;
          }

          if (file.size > HOME_AGENT_MAX_MEDIA_BYTES) {
            toast.error("Archivo demasiado grande", {
              description: `${file.name} supera los ${(HOME_AGENT_MAX_MEDIA_BYTES / (1024 * 1024)).toFixed(0)}MB permitidos.`,
            });
            continue;
          }

          try {
            const uploadConfig = await getUploadUrl({
              filename: file.name,
              contentType: file.type,
              kind,
            });

            if (file.size > uploadConfig.maxSize) {
              toast.error("Archivo supera el límite permitido", {
                description: `${file.name} excede ${(
                  uploadConfig.maxSize /
                  (1024 * 1024)
                ).toFixed(0)}MB.`,
              });
              continue;
            }

            const response = await fetch(uploadConfig.uploadUrl, {
              method: "PUT",
              headers: {
                "Content-Type": file.type,
              },
              body: file,
            });

            if (!response.ok) {
              throw new Error(
                `Fallo la carga (${response.status} ${response.statusText})`,
              );
            }

            setMediaAttachments((prev) => [
              ...prev,
              {
                url: uploadConfig.publicUrl,
                gcsBucket: uploadConfig.gcsBucket,
                gcsObject: uploadConfig.gcsObject,
                contentType: uploadConfig.contentType,
                filename: uploadConfig.filename,
                size: file.size,
                kind,
              },
            ]);
          } catch (error) {
            console.error("Error uploading media", error);
            const description =
              error instanceof Error ? error.message : "Intenta nuevamente.";
            toast.error("No se pudo subir el archivo", {
              description,
            });
          }
        }
      } finally {
        setIsUploadingMedia(false);
      }
    },
    [getUploadUrl, isUploadingMedia],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Don't submit if we're streaming (abort should be handled by button click)
    if (isStreaming) {
      return;
    }

    if (isUploadingMedia) {
      toast.error("Espera a que terminen las cargas antes de enviar.");
      return;
    }
    
    if (!inputValue.trim() || isInputDisabled) return;

    const message = inputValue.trim();
    setInputValue("");
    setSendError(null);

    try {
      const result = await sendMessage(
        message,
        webSearchEnabled,
        mediaAttachments,
      );
      // If no thread was set, navigate to the new thread
      if (!threadId && result.threadId) {
        navigate(`/ai/${result.threadId}`);
      }
      setMediaAttachments([]);
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  return (
    <div
      className={`flex flex-col h-full w-3/4 ${className}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Conversation with auto-scroll */}
      <Conversation className="flex-1">
        <ConversationContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Cargando mensajes...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <div className="p-4 rounded-full bg-muted/50">
                <Paperclip className="size-8 text-muted-foreground/50" />
              </div>
              <div>
                <div className="text-muted-foreground font-medium">No hay mensajes aún</div>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Escribe un mensaje o arrastra archivos aquí para comenzar
                </p>
              </div>
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
          <HomeAgentAttachmentPreview
            media={mediaAttachments}
            onRemove={handleRemoveMedia}
            isUploading={isUploadingMedia}
          />
          <PromptInputTextarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Escribe tu mensaje..."
            disabled={isInputDisabled}
          />
          <PromptInputToolbar>
            <div className="flex items-center gap-2">
              <PromptInputButton
                onClick={handleFileButtonClick}
                disabled={isInputDisabled}
                title="Adjuntar archivo"
              >
                <Paperclip className="size-4" />
              </PromptInputButton>
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
              disabled={
                isStreaming
                  ? false
                  : (!inputValue.trim() || messagesLoading || isUploadingMedia)
              }
              status={chatStatus}
              onClick={handleButtonClick}
              type={isStreaming ? "button" : "submit"}
              aria-label={isStreaming ? "Detener" : "Enviar mensaje"}
            />
          </PromptInputToolbar>
        </PromptInput>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          multiple
          accept="image/*,application/pdf"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFilesSelected(e.target.files);
            }
          }}
        />
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
