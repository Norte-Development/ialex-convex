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

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useThreadMessages, toUIMessages } from "@convex-dev/agent/react";
import { api } from "../../../convex/_generated/api";
import { useHomeThreads } from "./hooks/useHomeThreads";
import {
  Message,
  MessageContent,
  MessageAvatar,
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
import { Loader } from "@/components/ai-elements/loader";
import { Actions, Action } from "@/components/ai-elements/actions";
import { Copy, RotateCw, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Tool } from "@/components/ai-elements/tool";
import type { ToolUIPart } from "ai";

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
  const [inputValue, setInputValue] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Hook de Convex con streaming habilitado
  const messagesResult = useThreadMessages(
    api.agents.home.streaming.listMessages,
    threadId ? { threadId } : "skip",
    {
      initialNumItems,
      stream: true, // ← Habilita streaming en tiempo real
    },
  );

  console.log("messagesResult", messagesResult);

  // Hook para enviar mensajes
  const { sendMessage, messagesLoading } = useHomeThreads({ threadId });

  // Convertir mensajes al formato UI
  const messages = toUIMessages(messagesResult.results || []);
  const isLoading =
    threadId &&
    !messagesResult.results &&
    messagesResult.status !== "Exhausted";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || messagesLoading) return;

    const message = inputValue.trim();
    setInputValue("");

    try {
      const result = await sendMessage(message);
      // If no thread was set, navigate to the new thread
      if (!threadId && result.threadId) {
        navigate(`/ai/${result.threadId}`);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // Determinar el estado del chat para el botón de submit
  const chatStatus = messagesLoading ? "streaming" : "awaiting-message";

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
    if (!threadId || messagesLoading) return;

    try {
      await sendMessage(messageText);
    } catch (error) {
      console.error("Error regenerating message:", error);
    }
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
            messages.map((msg: any, index: number) => {
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

              // Encontrar el último mensaje del usuario antes de este mensaje de IA
              const lastUserMessage =
                !isUser && index > 0
                  ? messages[index - 1]?.role === "user"
                    ? messages[index - 1]
                    : null
                  : null;

              return (
                <Message key={messageId} from={msg.role}>
                  <MessageContent>
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
                              <Response key={partIndex} className="text-sm">
                                {displayText || "..."}
                              </Response>
                            );
                          }
                        }

                        // Renderizar tool calls
                        if (part.type?.startsWith("tool-")) {
                          const aiSDKState = part.state;
                          const outputType = part.output?.type as
                            | string
                            | undefined;
                          const isError =
                            aiSDKState === "output-available" &&
                            (outputType?.startsWith("error-") ?? false);

                          // Mapear estados a estados del componente Tool
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
                            />
                          );
                        }

                        return null;
                      })
                    ) : // Fallback si no hay parts
                    isUser ? (
                      <div className="whitespace-pre-wrap text-sm">
                        {messageText || "..."}
                      </div>
                    ) : (
                      <Response className="text-sm">
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
                            onClick={() =>
                              handleCopyMessage(messageId, messageText)
                            }
                          >
                            {isCopied ? (
                              <Check className="size-4" />
                            ) : (
                              <Copy className="size-4" />
                            )}
                          </Action>

                          {lastUserMessage && (
                            <Action
                              tooltip="Regenerar respuesta"
                              onClick={() => {
                                const userText =
                                  lastUserMessage.text ||
                                  lastUserMessage.parts
                                    ?.filter((p: any) => p.type === "text")
                                    .map((p: any) => p.text)
                                    .join("") ||
                                  "";
                                handleRegenerateMessage(userText);
                              }}
                              disabled={messagesLoading}
                            >
                              <RotateCw className="size-4" />
                            </Action>
                          )}
                        </Actions>
                      )}
                    </div>
                  </MessageContent>
                  <MessageAvatar
                    src={isUser ? "" : "/ialex-logo.png"}
                    name={isUser ? "Tú" : "iAlex"}
                  />
                </Message>
              );
            })
          )}
          {messagesLoading && (
            <div className="flex items-center gap-2 py-4">
              <Loader size={20} />
              <span className="text-muted-foreground text-sm">
                iAlex está escribiendo...
              </span>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Prompt Input */}
      <PromptInput onSubmit={handleSubmit} className="m-4">
        <PromptInputTextarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Escribe tu mensaje..."
          disabled={messagesLoading}
        />
        <PromptInputToolbar>
          <div className="flex-1" />
          <PromptInputSubmit
            disabled={!inputValue.trim()}
            status={chatStatus as any}
          />
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}
