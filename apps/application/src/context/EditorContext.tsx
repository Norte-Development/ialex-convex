import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import type { Editor } from "@tiptap/core";

interface EditorContextType {
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

interface EditorProviderProps {
  children: ReactNode;
}

export function EditorProvider({ children }: EditorProviderProps) {
  const [editor, setEditorState] = useState<Editor | null>(null);

  // Memoize setEditor to prevent unnecessary re-renders
  const setEditor = useCallback((newEditor: Editor | null) => {
    console.log("🔄 EditorContext setEditor called with:", newEditor);
    setEditorState(newEditor);
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      editor,
      setEditor,
    }),
    [editor, setEditor],
  );

  return (
    <EditorContext.Provider value={contextValue}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditorContext(): EditorContextType {
  const context = useContext(EditorContext);
  if (context === undefined) {
    throw new Error("useEditorContext must be used within an EditorProvider");
  }
  return context;
}

export default EditorContext;
