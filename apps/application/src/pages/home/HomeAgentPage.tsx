/**
 * AIAgentPage - Página principal del agente legal general
 *
 * Ruta: /ai
 *
 * Muestra lista de conversaciones y permite crear nuevas.
 * Sin caso específico - agente general.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputSubmit,
  PromptInputButton,
} from "@/components/ai-elements/prompt-input";
import { Globe, AlertTriangle } from "lucide-react";
import { useHomeThreads } from "@/components/HomeAgent/hooks/useHomeThreads";
import { HomeAgentLayout } from "@/components/HomeAgent/HomeAgentLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export default function HomeAgentPage() {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("homeAgentWebSearchEnabled");
      return saved === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("homeAgentWebSearchEnabled", String(webSearchEnabled));
  }, [webSearchEnabled]);

  const { sendMessage } = useHomeThreads();

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isCreating) return;

    const message = inputValue.trim();
    setIsCreating(true);

    try {
      // Send message (will create thread automatically with message as title)
      const result = await sendMessage(message, webSearchEnabled);

      if (result.threadId) {
        // Navigate to the new thread
        navigate(`/ai/${result.threadId}`);
      }
    } catch (error) {
      console.error("Error creating thread:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <HomeAgentLayout>
      <div className="flex items-center justify-center h-full p-6 bg-transparent pt-15">
        <div className="w-full max-w-4xl space-y-8">
          {/* Welcome Section */}
          <div className="text-center space-y-4">
            <h1 className="font-poppins font-[500] text-[#130261] justify-center items-center lg:text-[54px] text-xl flex flex-col ">
              ¡Hola! Soy iAlex<span>¿En qué puedo ayudarte?</span>
            </h1>
            <p className="text-[#666666] text-[20px] mt-10">
              Puede preguntarme y pedirme lo que quiera
            </p>
          </div>

          <div className="relative w-full max-w-4xl h-fit mx-auto">
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

            <PromptInput onSubmit={handleSendMessage} className="border-2 border-[#E5E7EB] shadow-[0px_4.27px_34.18px_-4.27px_rgba(99,140,243,0.32)] rounded-2xl">
              <PromptInputTextarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Listo cuando usted lo esté"
                className="min-h-[150px] max-h-[300px] px-6 py-5 bg-white placeholder:text-[#9CA3AF] resize-none focus:outline-none text-base"
                disabled={isCreating}
              />
              <PromptInputToolbar className="px-6 pb-4 bg-white">
                <div className="flex items-center gap-2">
                  <PromptInputButton
                    onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                    className={cn(
                      "rounded-full transition-all h-8 w-8",
                      webSearchEnabled && "bg-blue-100 text-blue-600 hover:bg-blue-200"
                    )}
                    title={webSearchEnabled ? "Búsqueda web activada" : "Activar búsqueda web"}
                    type="button"
                  >
                    <Globe className="size-4" />
                    <span className="sr-only">Toggle Web Search</span>
                  </PromptInputButton>
                </div>
                <div className="flex-1" />
                <PromptInputSubmit
                  onClick={() => handleSendMessage()}
                  disabled={!inputValue.trim() || isCreating}
                  className="bg-transparent hover:bg-transparent text-black"
                  size="icon"
                />
              </PromptInputToolbar>
            </PromptInput>
          </div>
        </div>
      </div>
    </HomeAgentLayout>
  );
}
