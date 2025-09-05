import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
} from "react";
import { useLocation } from "react-router-dom";

interface LayoutContextType {
  // isSidebarOpen: boolean;
  // toggleSidebar: () => void;
  isCaseSidebarOpen: boolean;
  toggleCaseSidebar: () => void;
  isEscritosOpen: boolean;
  toggleEscritos: () => void;
  isDocumentosOpen: boolean;
  toggleDocumentos: () => void;
  isHistorialOpen: boolean;
  toggleHistorial: () => void;
  isInCaseContext: boolean;
  setIsInCaseContext: (value: boolean) => void;
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

// Helper functions for localStorage
const getStoredBoolean = (key: string, defaultValue: boolean): boolean => {
  try {
    const stored = localStorage.getItem(key);
    return stored !== null ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const setStoredBoolean = (key: string, value: boolean): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore localStorage errors
  }
};

export const LayoutProvider: React.FC<LayoutProviderProps> = ({ children }) => {
  // const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isCaseSidebarOpen, setCaseSidebarOpen] = useState(() =>
    getStoredBoolean("case-sidebar-open", true),
  );
  const [isEscritosOpen, setEscritosOpen] = useState(() =>
    getStoredBoolean("escritos-open", false),
  );
  const [isDocumentosOpen, setDocumentosOpen] = useState(() =>
    getStoredBoolean("documentos-open", false),
  );
  const [isHistorialOpen, setHistorialOpen] = useState(() =>
    getStoredBoolean("historial-open", false),
  );
  const [isInCaseContext, setIsInCaseContextState] = useState(false);

  const location = useLocation();

  const setIsInCaseContext = (value: boolean) => {
    setIsInCaseContextState(value);
  };

  useEffect(() => {
    const isInCase = location.pathname.includes("/caso/");
    if (isInCase) {
      setIsInCaseContext(true);
    } else if (location.pathname === "/") {
      setIsInCaseContext(false);
    }
  }, [location.pathname]);

  // const toggleSidebar = () => {
  //   setSidebarOpen((prev) => !prev);
  // };

  const toggleCaseSidebar = () => {
    setCaseSidebarOpen((prev) => {
      const newValue = !prev;
      setStoredBoolean("case-sidebar-open", newValue);
      return newValue;
    });
  };

  const toggleEscritos = () => {
    setEscritosOpen((prev) => {
      const newValue = !prev;
      setStoredBoolean("escritos-open", newValue);
      return newValue;
    });
  };

  const toggleDocumentos = () => {
    setDocumentosOpen((prev) => {
      const newValue = !prev;
      setStoredBoolean("documentos-open", newValue);
      return newValue;
    });
  };

  const toggleHistorial = () => {
    setHistorialOpen((prev) => {
      const newValue = !prev;
      setStoredBoolean("historial-open", newValue);
      return newValue;
    });
  };

  return (
    <LayoutContext.Provider
      value={{
        // isSidebarOpen,
        // toggleSidebar,
        isCaseSidebarOpen,
        toggleCaseSidebar,
        isEscritosOpen,
        toggleEscritos,
        isDocumentosOpen,
        toggleDocumentos,
        isHistorialOpen,
        toggleHistorial,
        isInCaseContext,
        setIsInCaseContext,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
};
