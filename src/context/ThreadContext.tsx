import React, { createContext, useContext, ReactNode, useState } from "react";
import { Thread } from "../../types/thread";

interface ThreadContextType {
  thread: Thread;
  setThread: (thread: Thread) => void;
  generateNewThreadId: () => string;
}

const ThreadContext = createContext<ThreadContextType | undefined>(undefined);

interface ThreadProviderProps {
  children: ReactNode;
}

export const ThreadProvider: React.FC<ThreadProviderProps> = ({ children }) => {
  // Generate a random UUID as the default thread ID
  const generateRandomUUID = () => crypto.randomUUID();
  
  const [thread, setThread] = useState<Thread>({
    _id: "",
    threadId: generateRandomUUID(),
    isActive: true,
  });

  const generateNewThreadId = () => {
    const newId = generateRandomUUID();
    setThread({
      _id: "",
      threadId: newId,
      isActive: true,
    });
    return newId;
  };

  const value = {
    thread,
    setThread,
    generateNewThreadId,
  };

  return <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>;
};

export const useThread = () => {
  const context = useContext(ThreadContext);
  if (context === undefined) {
    throw new Error("useThread debe ser usado dentro de un ThreadProvider");
  }
  return context;
};

export const useSetThread = () => {
  const context = useContext(ThreadContext);
  if (context === undefined) {
    throw new Error("useSetThread debe ser usado dentro de un ThreadProvider");
  }
  return context.setThread;
};

export const useGenerateNewThreadId = () => {
  const context = useContext(ThreadContext);
  if (context === undefined) {
    throw new Error("useGenerateNewThreadId debe ser usado dentro de un ThreadProvider");
  }
  return context.generateNewThreadId;
}; 