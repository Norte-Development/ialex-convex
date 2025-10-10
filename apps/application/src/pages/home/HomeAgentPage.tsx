/**
 * AIAgentPage - Página principal del agente legal general
 *
 * Ruta: /ai
 *
 * Muestra lista de conversaciones y permite crear nuevas.
 * Sin caso específico - agente general.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, CircleArrowUp } from "lucide-react";
import { useHomeThreads } from "@/components/HomeAgent/hooks/useHomeThreads";
import { HomeAgentLayout } from "@/components/HomeAgent/HomeAgentLayout";

export default function HomeAgentPage() {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const { createThread } = useHomeThreads();

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isCreating) return;

    const message = inputValue.trim();
    setIsCreating(true);

    try {
      // Crear thread Y enviar mensaje en una sola operación
      const threadId = await createThread(message);

      if (threadId) {
        // Navegar al thread (el mensaje ya fue enviado)
        navigate(`/ai/${threadId}`);
      }
    } catch (error) {
      console.error("Error creating thread:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleQuickPrompt = async (prompt: string) => {
    if (isCreating) return;

    setIsCreating(true);
    try {
      // Crear thread Y enviar mensaje en una sola operación
      const threadId = await createThread(prompt);

      if (threadId) {
        // Navegar al thread (el mensaje ya fue enviado)
        navigate(`/ai/${threadId}`);
      }
    } catch (error) {
      console.error("Error creating thread:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const quickPrompts = [
    {
      icon: "📋",
      title: "Contratos de alquiler",
      prompt: "Necesito información sobre contratos de alquiler en Argentina",
    },
    {
      icon: "⚖️",
      title: "Derecho laboral",
      prompt: "Explicame los derechos laborales básicos en Argentina",
    },
    {
      icon: "🏛️",
      title: "Derecho constitucional",
      prompt: "¿Qué es el derecho constitucional argentino?",
    },
    {
      icon: "📄",
      title: "Redactar documento",
      prompt: "Ayudame a redactar un documento legal",
    },
  ];

  return (
    <HomeAgentLayout>
      <div className="flex items-center justify-center h-full p-6 bg-transparent">
        <div className="w-full max-w-4xl space-y-8">
          {/* Welcome Section */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">
              <span className="text-primary">iAlex</span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              ¿En qué puedo ayudarte?
            </p>
          </div>

          {/* Input Card */}
          <Card className="shadow-lg bg-transparent">
            <CardContent className="p-2 bg-transparent relative">
              <div className="space-y-2">
                <Textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe tu consulta legal aquí... Por ejemplo: 'Necesito información sobre contratos de alquiler' o 'Explicame qué es el derecho constitucional argentino'"
                  className="min-h-[150px] text-base resize-none"
                  disabled={isCreating}
                />

                <Button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isCreating}
                  size="icon"
                  className="gap-2 absolute right-5 bottom-10"
                >
                  <CircleArrowUp size={15} />
                </Button>

                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Presiona{" "}
                    <kbd className="px-2 py-1 text-xs bg-muted rounded">
                      Ctrl
                    </kbd>{" "}
                    +{" "}
                    <kbd className="px-2 py-1 text-xs bg-muted rounded">
                      Enter
                    </kbd>{" "}
                    para enviar
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Prompts */}
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              O comienza con una de estas sugerencias:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {quickPrompts.map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickPrompt(item.prompt)}
                  disabled={isCreating}
                  className="group relative flex flex-col items-center gap-2 p-4 rounded-lg border bg-card hover:bg-accent hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="text-3xl">{item.icon}</div>
                  <p className="text-xs font-medium text-center line-clamp-2">
                    {item.title}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </HomeAgentLayout>
  );
}
