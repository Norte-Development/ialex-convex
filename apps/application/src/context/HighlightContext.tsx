import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { Id } from "../../convex/_generated/dataModel";

type HighlightContextType = {
  highlightedFolder: Id<"folders"> | null;
  setHighlightedFolder: (folderId: Id<"folders">) => void;
};

const HighlightContext = createContext<HighlightContextType | undefined>(
  undefined,
);

export const HighlightProvider = ({ children }: { children: ReactNode }) => {
  const [highlightedFolder, setHighlightedFolderState] =
    useState<Id<"folders"> | null>(null);

  const setHighlightedFolder = useCallback((folderId: Id<"folders">) => {
    setHighlightedFolderState(folderId);
    setTimeout(() => {
      setHighlightedFolderState(null);
    }, 3000); // Highlight for 3 seconds
  }, []);

  return (
    <HighlightContext.Provider
      value={{ highlightedFolder, setHighlightedFolder }}
    >
      {children}
    </HighlightContext.Provider>
  );
};

export const useHighlight = () => {
  const context = useContext(HighlightContext);
  if (context === undefined) {
    throw new Error("useHighlight must be used within a HighlightProvider");
  }
  return context;
};
