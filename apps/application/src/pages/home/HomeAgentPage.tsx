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
import { Textarea } from "@/components/ui/textarea";
import { CircleArrowUp } from "lucide-react";
import { useHomeThreads } from "@/components/HomeAgent/hooks/useHomeThreads";
import { HomeAgentLayout } from "@/components/HomeAgent/HomeAgentLayout";
import { Loader } from "@/components/ai-elements/loader";

export default function HomeAgentPage() {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const { sendMessage } = useHomeThreads();

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isCreating) return;

    const message = inputValue.trim();
    setIsCreating(true);

    try {
      // Send message (will create thread automatically with message as title)
      const result = await sendMessage(message);

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
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Listo cuando usted lo esté"
              className="min-h-[150px] max-h-[300px] pt-5 pb-12 px-6 overflow-y-auto bg-white border-2 border-[#E5E7EB] placeholder:text-[#9CA3AF] rounded-2xl resize-none focus:border-[#9ECBFB] focus:outline-none"
              style={{
                boxShadow:
                  "0px 4.27px 34.18px -4.27px rgba(99, 140, 243, 0.32)",
              }}
              disabled={isCreating}
            />

            {/* <div className="absolute bottom-4 left-6 flex items-center gap-3">
              <button
                onClick={() =>
                  console.log(
                    "Ask se desplegaria un selector de modo, cuando tengamos esa feature",
                  )
                }
                disabled={isCreating}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-50"
              >
                Ask
              </button>
              <button
                onClick={() => console.log("Opción 1")}
                disabled={isCreating}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                Opción 1
              </button>
              <button
                onClick={() => console.log("Opción 2")}
                disabled={isCreating}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                Opción 2
              </button>
            </div> */}

            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isCreating}
              size="icon"
              className="absolute right-5 bottom-4 bg-transparent disabled:bg-transparent hover:bg-transparent text-black"
            >
              {isCreating ? <Loader size={20} /> : <CircleArrowUp size={20} />}
            </Button>
          </div>
        </div>
      </div>
    </HomeAgentLayout>
  );
}
