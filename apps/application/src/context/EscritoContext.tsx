import React, { createContext, useContext, ReactNode, useState } from "react";

interface CursorPosition {
  line: number;
  column: number;
}

interface TextAroundCursor {
  before: string;
  after: string;
  currentLine: string;
}

interface EscritoContextType {
  escritoId: string | undefined;
  setEscritoId: (escritoId: string | undefined) => void;
  cursorPosition: CursorPosition | undefined;
  setCursorPosition: (position: CursorPosition | undefined) => void;
  textAroundCursor: TextAroundCursor | undefined;
  setTextAroundCursor: (text: TextAroundCursor | undefined) => void;
}

const EscritoContext = createContext<EscritoContextType | undefined>(undefined);

interface EscritoProviderProps {
  children: ReactNode;
}

export const EscritoProvider: React.FC<EscritoProviderProps> = ({ children }) => {
  const [escritoId, setEscritoId] = useState<string | undefined>(undefined);
  const [cursorPosition, setCursorPosition] = useState<CursorPosition | undefined>(undefined);
  const [textAroundCursor, setTextAroundCursor] = useState<TextAroundCursor | undefined>(undefined);

  const contextValue: EscritoContextType = {
    escritoId,
    setEscritoId,
    cursorPosition,
    setCursorPosition,
    textAroundCursor,
    setTextAroundCursor,
  };

  return (
    <EscritoContext.Provider value={contextValue}>{children}</EscritoContext.Provider>
  );
};

export const useEscrito = (): EscritoContextType => {
  const context = useContext(EscritoContext);
  if (context === undefined) {
    throw new Error("useEscrito must be used within an EscritoProvider");
  }
  return context;
};

export default EscritoContext;
