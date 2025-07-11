import React, { createContext, useState, useContext, ReactNode } from "react";

interface LayoutContextType {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  isCaseSidebarOpen: boolean;
  toggleCaseSidebar: () => void;
  isEscritosOpen: boolean;
  toggleEscritos: () => void;
  isDocumentosOpen: boolean;
  toggleDocumentos: () => void;
  isHistorialOpen: boolean;
  toggleHistorial: () => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const useLayout = () => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error("useLayout must be used within a LayoutProvider");
  }
  return context;
};

interface LayoutProviderProps {
  children: ReactNode;
}

export const LayoutProvider: React.FC<LayoutProviderProps> = ({ children }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isCaseSidebarOpen, setCaseSidebarOpen] = useState(true);
  const [isEscritosOpen, setEscritosOpen] = useState(false);
  const [isDocumentosOpen, setDocumentosOpen] = useState(false);
  const [isHistorialOpen, setHistorialOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  const toggleCaseSidebar = () => {
    setCaseSidebarOpen((prev) => !prev);
  };

  const toggleEscritos = () => {
    setEscritosOpen((prev) => !prev);
  };

  const toggleDocumentos = () => {
    setDocumentosOpen((prev) => !prev);
  };

  const toggleHistorial = () => {
    setHistorialOpen((prev) => !prev);
  };

  return (
    <LayoutContext.Provider
      value={{
        isSidebarOpen,
        toggleSidebar,
        isCaseSidebarOpen,
        toggleCaseSidebar,
        isEscritosOpen,
        toggleEscritos,
        isDocumentosOpen,
        toggleDocumentos,
        isHistorialOpen,
        toggleHistorial,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
};
