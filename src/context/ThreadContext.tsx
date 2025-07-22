import React, { createContext, useContext, ReactNode, useState } from "react";

interface ThreadContextType {
  threadId: string;
  setThreadId: (id: string) => void;
  generateNewThreadId: () => string;
}

const ThreadContext = createContext<ThreadContextType | undefined>(undefined);

interface ThreadProviderProps {
  children: ReactNode;
}

export const ThreadProvider: React.FC<ThreadProviderProps> = ({ children }) => {
  // Generate a random UUID as the default thread ID
  const generateRandomUUID = () => crypto.randomUUID();
  
  const [threadId, setThreadId] = useState<string>(generateRandomUUID());

  const generateNewThreadId = () => {
    const newId = generateRandomUUID();
    setThreadId(newId);
    return newId;
  };

  const value = {
    threadId,
    setThreadId,
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