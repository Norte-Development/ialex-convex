import { createContext, useContext, useState, ReactNode } from "react";

interface ChatbotContextType {
  isChatbotOpen: boolean;
  toggleChatbot: () => void;
  chatbotWidth: number;
  setChatbotWidth: (width: number) => void;
  pendingPrompt: string | null;
  setPendingPrompt: (prompt: string | null) => void;
  openChatbotWithPrompt: (prompt: string) => void;
  currentPrompt: string;
  setCurrentPrompt: (prompt: string) => void;
}

const ChatbotContext = createContext<ChatbotContextType | undefined>(undefined);

export function ChatbotProvider({ children }: { children: ReactNode }) {
  const [isChatbotOpen, setIsChatbotOpen] = useState(() => {
    // Check if there's a stored preference
    const stored = localStorage.getItem("chatbot-open");
    if (stored !== null) {
      try {
        return JSON.parse(stored);
      } catch {
        // If parsing fails, continue to default logic
      }
    }
    // Default: open on desktop (>= 768px), closed on mobile (< 768px)
    return window.innerWidth >= 768;
  });

  const [chatbotWidth, setChatbotWidth] = useState(() => {
    const savedWidth = localStorage.getItem("chatbot-width");
    return savedWidth ? Number.parseInt(savedWidth, 10) : 380;
  });

  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<string>("");

  const toggleChatbot = () => {
    setIsChatbotOpen((prev: boolean) => {
      const newValue = !prev;
      try {
        localStorage.setItem("chatbot-open", JSON.stringify(newValue));
      } catch {
        // Ignore localStorage errors
      }
      return newValue;
    });
  };

  const handleSetChatbotWidth = (width: number) => {
    setChatbotWidth(width);
    localStorage.setItem("chatbot-width", width.toString());
  };

  const openChatbotWithPrompt = (prompt: string) => {
    setPendingPrompt(prompt);
    if (!isChatbotOpen) {
      setIsChatbotOpen(true);
      try {
        localStorage.setItem("chatbot-open", JSON.stringify(true));
      } catch {
        // Ignore localStorage errors
      }
    }
  };

  return (
    <ChatbotContext.Provider
      value={{
        isChatbotOpen,
        toggleChatbot,
        chatbotWidth,
        setChatbotWidth: handleSetChatbotWidth,
        pendingPrompt,
        setPendingPrompt,
        openChatbotWithPrompt,
        currentPrompt,
        setCurrentPrompt,
      }}
    >
      {children}
    </ChatbotContext.Provider>
  );
}

export function useChatbot() {
  const context = useContext(ChatbotContext);
  if (context === undefined) {
    throw new Error("useChatbot must be used within a ChatbotProvider");
  }
  return context;
}
