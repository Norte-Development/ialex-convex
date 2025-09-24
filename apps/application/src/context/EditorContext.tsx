import { createContext, useContext, useState, ReactNode } from "react";
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
  const [editor, setEditor] = useState<Editor | null>(null);

  return (
    <EditorContext.Provider value={{ editor, setEditor }}>
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
