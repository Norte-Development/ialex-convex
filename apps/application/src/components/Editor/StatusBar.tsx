import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";

interface StatusBarProps {
  editor: Editor;
}

export function StatusBar({ editor }: StatusBarProps) {
  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      const { doc } = ctx.editor.state;
      const text = doc.textContent;
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      const characters = text.length;

      return { words, characters };
    },
  });

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span className="status-bar-item">Página 1 de 1</span>
        <span className="status-bar-separator">|</span>
        <span className="status-bar-item">
          Palabras: {editorState.words}
        </span>
        <span className="status-bar-separator">|</span>
        <span className="status-bar-item">
          Caracteres: {editorState.characters}
        </span>
      </div>
      <div className="status-bar-right">
        <span className="status-bar-item">Español (Argentina)</span>
        <span className="status-bar-separator">|</span>
        <span className="status-bar-item">100%</span>
      </div>
    </div>
  );
}

