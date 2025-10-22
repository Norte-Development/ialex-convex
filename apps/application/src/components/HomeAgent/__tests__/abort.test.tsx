/**
 * Abort Functionality Tests
 *
 * Tests para validar la funcionalidad de abort del agente home.
 */

import { useState } from "react";
import { useUIMessages } from "@convex-dev/agent/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useHomeThreads } from "../hooks/useHomeThreads";

interface AbortTestProps {
  threadId?: string;
}

export function AbortTest({ threadId }: AbortTestProps) {
  const [testLog, setTestLog] = useState<string[]>([]);
  const [isAborting, setIsAborting] = useState(false);

  // Hook para enviar mensajes
  const { sendMessage, messagesLoading } = useHomeThreads({ threadId });

  // Hook para abortar streams
  const abortStreamByOrder = useMutation(
    api.agents.home.streaming.abortStreamByOrder,
  );

  // Hook de Convex con streaming habilitado
  const {
    results: messages,
    status,
  } = useUIMessages(
    api.agents.home.streaming.listMessages,
    threadId ? { threadId } : "skip",
    { initialNumItems: 10, stream: true },
  );

  // Simple streaming detection
  const isStreaming = messages?.some((m: any) => m.status === "streaming") ?? false;

  const addLog = (message: string) => {
    setTestLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const handleSendMessage = async () => {
    if (!threadId) return;
    
    addLog("Enviando mensaje de prueba...");
    try {
      await sendMessage("Genera una respuesta larga sobre derecho civil");
      addLog("Mensaje enviado, esperando respuesta...");
    } catch (error) {
      addLog(`Error enviando mensaje: ${error}`);
    }
  };

  const handleAbortStream = async () => {
    if (!threadId || !isStreaming) return;
    
    setIsAborting(true);
    addLog("Intentando abortar stream...");
    
    try {
      const order = messages?.find((m) => m.status === "streaming")?.order ?? 0;
      const result = await abortStreamByOrder({ threadId, order });
      
      if (result.success) {
        addLog("✅ Stream abortado exitosamente");
      } else {
        addLog(`❌ Error abortando stream: ${result.message}`);
      }
    } catch (error) {
      addLog(`❌ Error en abort: ${error}`);
    } finally {
      setIsAborting(false);
    }
  };

  const clearLog = () => {
    setTestLog([]);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Home Agent Abort Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={handleSendMessage}
              disabled={!threadId || isStreaming || messagesLoading}
            >
              Enviar Mensaje Largo
            </Button>
            <Button 
              onClick={handleAbortStream}
              disabled={!isStreaming || isAborting}
              variant={isStreaming ? "destructive" : "outline"}
            >
              {isAborting ? "Abortando..." : "Abortar Stream"}
            </Button>
            <Button onClick={clearLog} variant="outline">
              Limpiar Log
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Estado:</h4>
            <div className="text-sm space-y-1">
              <div>Thread ID: {threadId || "No thread"}</div>
              <div>Streaming: {isStreaming ? "✅ Sí" : "❌ No"}</div>
              <div>Loading: {messagesLoading ? "✅ Sí" : "❌ No"}</div>
              <div>Messages: {messages?.length || 0}</div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Test Log:</h4>
            <div className="bg-gray-100 p-3 rounded-md max-h-40 overflow-y-auto">
              {testLog.length === 0 ? (
                <div className="text-gray-500 text-sm">No hay logs aún...</div>
              ) : (
                <div className="space-y-1">
                  {testLog.map((log, index) => (
                    <div key={index} className="text-xs font-mono">
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
