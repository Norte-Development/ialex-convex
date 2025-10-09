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

import { useThreadMessages, toUIMessages } from "@convex-dev/agent/react";
import { api } from "../../../convex/_generated/api";

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
  // Hook de Convex con streaming habilitado
  const messagesResult = useThreadMessages(
    api.agents.home.streaming.listMessages,
    threadId ? { threadId } : "skip",
    {
      initialNumItems,
      stream: true, // ← Habilita streaming en tiempo real
    }
  );

  // Convertir mensajes al formato UI
  const messages = toUIMessages(messagesResult.results || []);
  const isLoading = threadId && !messagesResult.results && messagesResult.status !== "Exhausted";

  return (
    <div className={`flex flex-col h-full ${className}`}>
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
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    isUser
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
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
      </div>
    </div>
  );
}
