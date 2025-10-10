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
  const [inputValue, setInputValue] = useState("");

  // Hook de Convex con streaming habilitado
  const messagesResult = useThreadMessages(
    api.agents.home.streaming.listMessages,
    threadId ? { threadId } : "skip",
    {
      initialNumItems,
      stream: true, // ← Habilita streaming en tiempo real
    },
  );

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
    if (!inputValue.trim() || !threadId || messagesLoading) return;

    const message = inputValue.trim();
    setInputValue("");

    try {
      await sendMessage(message);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // Determinar el estado del chat para el botón de submit
  const chatStatus = messagesLoading ? "streaming" : "awaiting-message";

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
            messages.map((msg: any) => {
              const messageText =
                msg.text ||
                msg.parts
                  ?.filter((p: any) => p.type === "text")
                  .map((p: any) => p.text)
                  .join("") ||
                "";

              const isUser = msg.role === "user";
              const messageAge = Date.now() - (msg._creationTime || 0);
              const isRecent = messageAge < 5000;

              return (
                <Message key={msg._id || msg.id} from={msg.role}>
                  <MessageContent>
                    <div className="flex items-center gap-2 mb-1">
                      {!isUser && isRecent && (
                        <span className="text-blue-600 text-[10px] animate-pulse">
                          🔄
                        </span>
                      )}
                    </div>
                    {isUser ? (
                      // Mensajes del usuario: texto plano
                      <div className="whitespace-pre-wrap text-sm">
                        {messageText || "..."}
                      </div>
                    ) : (
                      // Mensajes de la IA: markdown con Response
                      <Response className="text-sm">
                        {messageText || "..."}
                      </Response>
                    )}
                    <div className="text-[10px] opacity-70 mt-1">
                      {messageAge < 1000
                        ? "ahora"
                        : `hace ${Math.floor(messageAge / 1000)}s`}
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
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Prompt Input */}
      <PromptInput onSubmit={handleSubmit} className="m-4">
        <PromptInputTextarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Escribe tu mensaje..."
          disabled={!threadId || messagesLoading}
        />
        <PromptInputToolbar>
          <div className="flex-1" />
          <PromptInputSubmit
            disabled={!inputValue.trim() || !threadId}
            status={chatStatus as any}
          />
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}
