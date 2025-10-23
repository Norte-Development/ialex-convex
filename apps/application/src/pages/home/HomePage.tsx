import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import ExistingUserHome from "@/components/Home/ExistingUserHome";
import NewUserHome from "@/components/Home/NewUserHome";
import { CircleArrowUp } from "lucide-react";
import { useHomeThreads } from "@/components/HomeAgent/hooks/useHomeThreads";
import { Loader } from "@/components/ai-elements/loader";

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const { sendMessage } = useHomeThreads();

  if (!user) {
    return null;
  }

  // Show new user experience if they're missing key info or just completed onboarding
  const isNewUserExperience = !user.isOnboardingComplete;

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
    <section className="flex flex-col min-h-screen w-full overflow-y-hidden bg-white justify-center items-center relative pt-20">
      <div className="w-3/4 flex flex-col gap-8 items-center justify-center">
        <div className="flex flex-col gap-8 w-full justify-center items-center">
          <h1 className="font-poppins font-[500] text-[#130261] justify-center items-center lg:text-[54px] text-xl flex flex-col ">
            ¡Buenos días, {user?.name}!<span>¿En qué trabajamos hoy?</span>
          </h1>
          <p className="text-[#666666] text-[20px] mt-10">
            Comience el día con ayuda de su asistente IA
          </p>
          <div className="relative w-full max-w-4xl h-fit mx-auto">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ej: prompt que muestre la mejor funcionalidad"
              className=" !h-[30px] max-h-[250px] pt-5 overflow-y-auto bg-[#f7f7f7] active:border-[#9ECBFB] border-[#9ECBFB] placeholder:text-[#5B738B] rounded-[17px] resize-none"
              style={{
                boxShadow:
                  "0px 4.27px 34.18px -4.27px rgba(99, 140, 243, 0.32)",
              }}
              disabled={isCreating}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isCreating}
              size="icon"
              className="absolute right-5 top-1/2 -translate-y-1/2 bg-transparent disabled:bg-transparent hover:bg-transparent text-black"
            >
              {isCreating ? <Loader size={20} /> : <CircleArrowUp size={20} />}
            </Button>
          </div>
        </div>
        {isNewUserExperience ? <NewUserHome /> : <ExistingUserHome />}
      </div>
    </section>
  );
}
