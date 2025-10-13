/**
 * Streaming Tests
 *
 * Tests para validar el streaming de mensajes del agente.
 */

import { useState, useEffect } from "react";
import { useThreadMessages, toUIMessages } from "@convex-dev/agent/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHomeThreads } from "../hooks/useHomeThreads";
import { api } from "../../../../convex/_generated/api";

interface StreamingTestProps {
  threadId?: string;
}

export function StreamingTest({ threadId }: StreamingTestProps) {
  const hook = useHomeThreads({ threadId });

  // useThreadMessages con streaming - EXACTAMENTE igual que CaseAgent
  const messagesResult = useThreadMessages(
    api.agents.home.streaming.listMessages,
    threadId ? { threadId } : "skip",
    {
      initialNumItems: 5,
      stream: true,
    },
  );

  // Convertir a UI messages igual que CaseAgent
  const messages = toUIMessages(messagesResult.results || []);
  const isLoadingMessages =
    threadId &&
    !messagesResult.results &&
    messagesResult.status !== "Exhausted";
  const [testLog, setTestLog] = useState<string[]>([]);
  const [streamingState, setStreamingState] = useState<{
    isStreaming: boolean;
    startTime: number | null;
    charsReceived: number;
    lastUpdate: number | null;
  }>({
    isStreaming: false,
    startTime: null,
    charsReceived: 0,
    lastUpdate: null,
  });

  const addLog = (
    message: string,
    type: "info" | "success" | "error" = "info",
  ) => {
    const emoji = type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️";
    setTestLog((prev) => [
      ...prev,
      `${emoji} [${new Date().toLocaleTimeString()}] ${message}`,
    ]);
  };

  // Monitor streaming state
  useEffect(() => {
    if (!messages.length) return;

    const lastMessage = messages[messages.length - 1] as any;

    if (lastMessage && lastMessage.role === "assistant") {
      const messageText =
        lastMessage.text ||
        lastMessage.parts
          ?.filter((p: any) => p.type === "text")
          .map((p: any) => p.text)
          .join("") ||
        "";

      const messageAge = Date.now() - (lastMessage._creationTime || 0);
      const isStreaming =
        (lastMessage.status === "success" ||
          lastMessage.status === "pending") &&
        messageAge < 5000;

      // Si está streaming
      if (isStreaming && messageText.length > 0) {
        setStreamingState((prev) => {
          if (!prev.isStreaming) {
            addLog("🔄 Streaming started!", "info");
            return {
              isStreaming: true,
              startTime: Date.now(),
              charsReceived: messageText.length,
              lastUpdate: Date.now(),
            };
          } else {
            // Update streaming state
            return {
              ...prev,
              charsReceived: messageText.length,
              lastUpdate: Date.now(),
            };
          }
        });
      } else if (streamingState.isStreaming && !isStreaming) {
        // Streaming finished
        const duration = Date.now() - (streamingState.startTime || 0);
        const charsPerSec = (streamingState.charsReceived / duration) * 1000;

        addLog(
          `✅ Streaming completed: ${streamingState.charsReceived} chars in ${(duration / 1000).toFixed(1)}s (${charsPerSec.toFixed(1)} chars/sec)`,
          "success",
        );

        setStreamingState({
          isStreaming: false,
          startTime: null,
          charsReceived: 0,
          lastUpdate: null,
        });
      }
    }
  }, [
    messages,
    streamingState.isStreaming,
    streamingState.startTime,
    streamingState.charsReceived,
  ]);

  const testStreamingMessage = async () => {
    if (!threadId) {
      addLog("No thread selected", "error");
      return;
    }

    try {
      setTestLog([]);
      addLog("👤 Sending USER message...", "info");

      await hook.sendMessage(
        "Explicame en detalle qué es el derecho constitucional argentino",
      );

      addLog("✅ USER message sent", "success");
      addLog("⏳ Waiting for ASSISTANT response (streaming)...", "info");
    } catch (error) {
      addLog(`Error: ${error}`, "error");
    }
  };

  const testShortMessage = async () => {
    if (!threadId) {
      addLog("No thread selected", "error");
      return;
    }

    try {
      setTestLog([]);
      addLog("👤 Sending USER message: 'Hola'", "info");

      await hook.sendMessage("Hola");

      addLog("✅ USER message sent", "success");
      addLog("⏳ Waiting for ASSISTANT response...", "info");
    } catch (error) {
      addLog(`Error: ${error}`, "error");
    }
  };

  const testLongMessage = async () => {
    if (!threadId) {
      addLog("No thread selected", "error");
      return;
    }

    try {
      setTestLog([]);
      addLog("👤 Sending USER message (long)...", "info");

      await hook.sendMessage(
        "Dame un análisis completo y detallado sobre los derechos fundamentales en la constitución argentina, incluyendo ejemplos de jurisprudencia relevante y casos históricos importantes",
      );

      addLog("✅ USER message sent", "success");
      addLog("⏳ Waiting for ASSISTANT response (streaming)...", "info");
      addLog("📊 Monitor the 'Streaming Status' card above", "info");
    } catch (error) {
      addLog(`Error: ${error}`, "error");
    }
  };

  return (
    <div className="space-y-4">
      {/* Test Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Test Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Button
              onClick={testShortMessage}
              disabled={!threadId || hook.messagesLoading}
              className="w-full"
              variant="outline"
              size="sm"
            >
              Test Short Message (Hola)
            </Button>
            <p className="text-xs text-muted-foreground">
              Respuesta corta - streaming mínimo
            </p>
          </div>

          <div className="space-y-2">
            <Button
              onClick={testStreamingMessage}
              disabled={!threadId || hook.messagesLoading}
              className="w-full"
              variant="outline"
              size="sm"
            >
              Test Medium Message
            </Button>
            <p className="text-xs text-muted-foreground">
              Respuesta media - streaming moderado
            </p>
          </div>

          <div className="space-y-2">
            <Button
              onClick={testLongMessage}
              disabled={!threadId || hook.messagesLoading}
              className="w-full"
              variant="default"
              size="sm"
            >
              Test Long Message (Recommended)
            </Button>
            <p className="text-xs text-muted-foreground">
              Respuesta larga - streaming completo
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Messages - Con streaming */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Messages ({messages.length})</span>
            {isLoadingMessages && (
              <span className="text-blue-600 font-bold text-[10px] animate-pulse">
                🔄 LOADING...
              </span>
            )}
            {streamingState.isStreaming && (
              <span className="text-blue-600 font-bold text-[10px] animate-pulse">
                🔄 STREAMING
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto space-y-1 text-xs">
            {messages.length === 0 ? (
              <div className="text-muted-foreground">No messages</div>
            ) : (
              messages.map((msg: any, idx) => {
                // Extraer texto del mensaje
                const messageText =
                  msg.text ||
                  msg.parts
                    ?.filter((p: any) => p.type === "text")
                    .map((p: any) => p.text)
                    .join("") ||
                  "";

                // Detectar si está streameando
                const messageAge = Date.now() - (msg._creationTime || 0);
                const isRecentMessage = messageAge < 5000;
                const isAssistant = msg.role === "assistant";

                return (
                  <div
                    key={msg._id || msg.id || idx}
                    className="p-2 bg-muted rounded"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold">{msg.role}</span>
                      {isAssistant && isRecentMessage && (
                        <span className="text-blue-600 text-[10px] animate-pulse">
                          🔄
                        </span>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap">
                      {messageText || "..."}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
                      <span>{messageText.length} chars</span>
                      {msg.status && (
                        <span className="text-blue-600">• {msg.status}</span>
                      )}
                      {msg._creationTime && (
                        <span>
                          •{" "}
                          {messageAge < 1000
                            ? "just now"
                            : `${(messageAge / 1000).toFixed(0)}s ago`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Test Log */}
      {testLog.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Test Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-black text-green-400 font-mono text-[10px] p-3 rounded max-h-48 overflow-y-auto space-y-1">
              {testLog.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-sm">📝 Cómo testear streaming</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          <div>
            <strong>1.</strong> Asegúrate de tener un threadId seleccionado
            arriba
          </div>
          <div>
            <strong>2.</strong> Click en "Test Long Message" para mejor
            resultado
          </div>
          <div>
            <strong>3.</strong> Observa el "Streaming Status" en tiempo real
          </div>
          <div>
            <strong>4.</strong> Verifica que los caracteres aumenten
            gradualmente
          </div>
          <div>
            <strong>5.</strong> La velocidad debe ser ~50-100 chars/sec
          </div>
          <div className="pt-2 border-t border-blue-200 mt-2">
            <strong>✅ Streaming OK si:</strong> Ves caracteres aumentando
            gradualmente
          </div>
          <div>
            <strong>❌ Streaming FAIL si:</strong> Todo el texto aparece de
            golpe
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
