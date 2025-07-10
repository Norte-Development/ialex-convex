import React, { createContext, useState, useContext, ReactNode } from "react";

interface LayoutContextType {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  isCaseSidebarOpen: boolean;
  toggleCaseSidebar: () => void;
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

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  const toggleCaseSidebar = () => {
    setCaseSidebarOpen((prev) => !prev);
  };

  return (
    <LayoutContext.Provider
      value={{
        isSidebarOpen,
        toggleSidebar,
        isCaseSidebarOpen,
        toggleCaseSidebar,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
};
