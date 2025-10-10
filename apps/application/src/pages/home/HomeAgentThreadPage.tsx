/**
 * AIAgentChatPage - Página de conversación con el agente
 *
 * Ruta: /ai/:threadId
 *
 * Muestra el chat completo con streaming en tiempo real.
 */

import { useParams } from "react-router-dom";
import { HomeAgentChat } from "@/components/HomeAgent/HomeAgentChat";
import { useHomeThreads } from "@/components/HomeAgent/hooks/useHomeThreads";
import { HomeAgentLayout } from "@/components/HomeAgent/HomeAgentLayout";

export default function HomeAgentThreadPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const { isLoading } = useHomeThreads({ threadId });

  if (isLoading) {
    return (
      <HomeAgentLayout currentThreadId={threadId}>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </HomeAgentLayout>
    );
  }

  if (!threadId) {
    return (
      <HomeAgentLayout>
        <div className="flex flex-col items-center justify-center h-full">
          <h2 className="text-xl font-semibold mb-2">Thread no especificado</h2>
          <p className="text-muted-foreground">
            No se pudo cargar la conversación
          </p>
        </div>
      </HomeAgentLayout>
    );
  }

  return (
    <HomeAgentLayout currentThreadId={threadId}>
      <div className="flex justify-center pt-10 h-full overflow-hidden">
        <HomeAgentChat threadId={threadId} />
      </div>
    </HomeAgentLayout>
  );
}
