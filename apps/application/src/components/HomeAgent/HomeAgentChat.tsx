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

import { useState, useRef, useEffect } from "react";
import { useThreadMessages, toUIMessages } from "@convex-dev/agent/react";
import { api } from "../../../convex/_generated/api";
import { useHomeThreads } from "./hooks/useHomeThreads";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll al final cuando hay nuevos mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    if (!inputValue.trim() || !threadId || messagesLoading) return;

    const message = inputValue.trim();
    setInputValue("");

    try {
      await sendMessage(message);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`flex flex-col h-full w-3/4 py-15 ${className}`}>
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto space-y-2 p-4">
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
              <div
                key={msg._id || msg.id}
                className={`flex ${isUser ? "justify-end" : "justify-start "}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    isUser ? "bg-primary text-primary-foreground" : "bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold">
                      {isUser ? "Tú" : "iAlex"}
                    </span>
                    {!isUser && isRecent && (
                      <span className="text-blue-600 text-[10px] animate-pulse">
                        🔄
                      </span>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap text-sm">
                    {messageText || "..."}
                  </div>
                  <div className="text-[10px] opacity-70 mt-1">
                    {messageAge < 1000
                      ? "ahora"
                      : `hace ${Math.floor(messageAge / 1000)}s`}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Container */}
      <div className="border-t bg-transparent ">
        <div className="flex gap-2">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu mensaje..."
            className="min-h-[60px] max-h-[200px] resize-none"
            disabled={!threadId || messagesLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || !threadId || messagesLoading}
            size="icon"
            className="h-[60px] w-[60px]"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
