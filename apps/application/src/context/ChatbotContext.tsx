import { createContext, useContext, useState, ReactNode } from "react";

interface ChatbotContextType {
  isChatbotOpen: boolean;
  toggleChatbot: () => void;
  chatbotWidth: number;
  setChatbotWidth: (width: number) => void;
}

const ChatbotContext = createContext<ChatbotContextType | undefined>(undefined);

export function ChatbotProvider({ children }: { children: ReactNode }) {
  const [isChatbotOpen, setIsChatbotOpen] = useState(() => {
    try {
      const stored = localStorage.getItem("chatbot-open");
      return stored !== null ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  });

  const [chatbotWidth, setChatbotWidth] = useState(() => {
    const savedWidth = localStorage.getItem("chatbot-width");
    return savedWidth ? Number.parseInt(savedWidth, 10) : 380;
  });

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

  return (
    <ChatbotContext.Provider
      value={{
        isChatbotOpen,
        toggleChatbot,
        chatbotWidth,
        setChatbotWidth: handleSetChatbotWidth,
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
