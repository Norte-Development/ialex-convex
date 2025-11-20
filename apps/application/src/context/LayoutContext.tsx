import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
} from "react";
import { useLocation } from "react-router-dom";
import { Id } from "../../convex/_generated/dataModel";

interface LayoutContextType {
  // isSidebarOpen: boolean;
  // toggleSidebar: () => void;
  isCaseSidebarOpen: boolean;
  toggleCaseSidebar: () => void;
  isHomeAgentSidebarOpen: boolean;
  toggleHomeAgentSidebar: () => void;
  isEscritosOpen: boolean;
  toggleEscritos: () => void;
  isDocumentosOpen: boolean;
  toggleDocumentos: () => void;
  isHistorialOpen: boolean;
  toggleHistorial: () => void;
  isInCaseContext: boolean;
  setIsInCaseContext: (value: boolean) => void;
  // FolderTree persistence
  isFolderOpen: (folderId: Id<"folders">) => boolean;
  toggleFolder: (folderId: Id<"folders">) => void;
  setFolderOpen: (folderId: Id<"folders">, open: boolean) => void;
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

// Helper functions for folder state management
const getFolderOpenStates = (): Record<string, boolean> => {
  try {
    const stored = localStorage.getItem("folder-open-states");
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const setFolderOpenStates = (states: Record<string, boolean>): void => {
  try {
    localStorage.setItem("folder-open-states", JSON.stringify(states));
  } catch {
    // Ignore localStorage errors
  }
};

export const LayoutProvider: React.FC<LayoutProviderProps> = ({ children }) => {
  // const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isCaseSidebarOpen, setCaseSidebarOpen] = useState(() => {
    // Check if there's a stored preference
    const stored = localStorage.getItem("case-sidebar-open");
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
  const [isHomeAgentSidebarOpen, setHomeAgentSidebarOpen] = useState(() =>
    getStoredBoolean("home-agent-sidebar-open", true),
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

  // Centralized folder states
  const [folderOpenStates, setFolderOpenStatesState] = useState<
    Record<string, boolean>
  >(() => getFolderOpenStates());

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

  const toggleHomeAgentSidebar = () => {
    setHomeAgentSidebarOpen((prev) => {
      const newValue = !prev;
      setStoredBoolean("home-agent-sidebar-open", newValue);
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

  // Folder management functions
  const isFolderOpen = (folderId: Id<"folders">): boolean => {
    return folderOpenStates[folderId as string] || false;
  };

  const setFolderOpen = (folderId: Id<"folders">, open: boolean): void => {
    setFolderOpenStatesState((prev) => {
      const newStates = { ...prev, [folderId as string]: open };
      setFolderOpenStates(newStates);
      return newStates;
    });
  };

  const toggleFolder = (folderId: Id<"folders">): void => {
    const currentState = isFolderOpen(folderId);
    setFolderOpen(folderId, !currentState);
  };

  return (
    <LayoutContext.Provider
      value={{
        // isSidebarOpen,
        // toggleSidebar,
        isCaseSidebarOpen,
        toggleCaseSidebar,
        isHomeAgentSidebarOpen,
        toggleHomeAgentSidebar,
        isEscritosOpen,
        toggleEscritos,
        isDocumentosOpen,
        toggleDocumentos,
        isHistorialOpen,
        toggleHistorial,
        isInCaseContext,
        setIsInCaseContext,
        // FolderTree functions
        isFolderOpen,
        toggleFolder,
        setFolderOpen,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
};
