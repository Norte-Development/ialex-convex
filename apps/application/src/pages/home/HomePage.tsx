import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import ExistingUserHome from "@/components/Home/ExistingUserHome";
import NewUserHome from "@/components/Home/NewUserHome";
import { CircleArrowUp } from "lucide-react";
import { useHomeThreads } from "@/components/HomeAgent/hooks/useHomeThreads";

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const { createThread } = useHomeThreads();

  // This component will only render when user is authenticated and loaded
  // Show new user experience if they're missing key info or just completed onboarding
  const isNewUserExperience = !user?.isOnboardingComplete;

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

  return (
    <section className="flex flex-col min-h-screen w-full overflow-y-hidden bg-white justify-center items-center relative pt-20">
      <div className="w-3/4 flex flex-col gap-8 items-center justify-center">
        <div className="flex flex-col gap-8 w-full justify-center items-center">
          <h1 className="font-poppins font-bold lg:text-4xl text-xl">
            ¡Buenos días, {user?.name}!
          </h1>
          <div className="relative w-full">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder=" ¿En qué trabajamos hoy?"
              className="min-h-[100px] max-h-[250px] overflow-y-auto bg-[#f7f7f7] pl-10"
              disabled={isCreating}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isCreating}
              size="icon"
              className="absolute right-3 bottom-3 bg-transparent hover:bg-transparent text-black"
            >
              <CircleArrowUp size={20} />
            </Button>
          </div>
        </div>
        {isNewUserExperience ? <NewUserHome /> : <ExistingUserHome />}
      </div>
    </section>
  );
}
