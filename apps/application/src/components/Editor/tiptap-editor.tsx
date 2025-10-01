import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { useEffect } from "react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";
import {
  InlineChange,
  BlockChange,
  LineBreakChange,
} from "../../../../../packages/shared/src/tiptap/changeNodes";
import { TrackingExtension } from "./extensions/tracking";
import { PaginationPlus } from "tiptap-pagination-plus";
import "./editor-styles.css";
import { api } from "../../../convex/_generated/api";
import { useEscrito } from "@/context/EscritoContext";
import { SuggestionsMenu } from "./suggestions-menu";
import { RibbonBar } from "./Ribbon";
import { StatusBar } from "./StatusBar";

interface TiptapProps {
  documentId?: string;
  onReady?: (editor: Editor) => void;
  onDestroy?: () => void;
  readOnly?: boolean;
}

// Define empty document structure outside component to avoid recreating object
const EMPTY_DOC = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      attrs: { textAlign: null },
      content: [],
    },
  ],
};

export function Tiptap({
  documentId = "default-document",
  onReady,
  onDestroy,
  readOnly = false,
}: TiptapProps) {
  const sync = useTiptapSync(api.prosemirror, documentId);
  const { setCursorPosition, setTextAroundCursor, setEscritoId } = useEscrito();

  // Always call useEditor hook - don't make it conditional
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          horizontalRule: false,
        }),
        TextStyle,
        Color,
        InlineChange,
        BlockChange,
        LineBreakChange,
        TrackingExtension,
        TextAlign.configure({
          types: ["heading", "paragraph"],
        }),
        Underline,
        PaginationPlus.configure({
          pageHeight: 1100,        // Height of each page in pixels (approximately A4)
          pageGap: 20,             // Gap between pages
          pageBreakBackground: "#F3F4F6", // Light gray for page gaps
          pageHeaderHeight: 40,    // Header height
          pageFooterHeight: 40,    // Footer height
          footerLeft: "Página {page}", // Page number on left
          footerRight: "",         // Empty right footer
          headerLeft: "",          // Empty left header
          headerRight: "",         // Empty right header
          marginTop: 60,           // Top margin
          marginBottom: 60,        // Bottom margin
          marginLeft: 70,          // Left margin
          marginRight: 70,         // Right margin
        }),
        ...(sync.extension ? [sync.extension] : []),
      ],
      content: sync.initialContent,
      editable: !readOnly, // Make editor read-only based on permissions
      editorProps: {
        attributes: {
          class: `legal-editor-content prose prose-lg focus:outline-none px-12 py-8 min-h-screen ${readOnly ? "cursor-default select-text" : ""}`,
          "data-placeholder": readOnly
            ? ""
            : "Comience a escribir su documento legal...",
        },
      },
      onUpdate: ({ editor }) => {
        // Update cursor position and text around cursor when content changes
        updateCursorContext(editor);
      },
      onSelectionUpdate: ({ editor }) => {
        // Update cursor position and text around cursor when selection changes
        updateCursorContext(editor);
      },
    },
    [sync.initialContent, sync.extension],
  );

  const updateCursorContext = (editor: Editor) => {
    const { from, to } = editor.state.selection;

    // Get cursor position in terms of line and column
    const pos = editor.state.doc.resolve(from);
    const line = pos.parentOffset;
    const column = from - pos.start();

    // Set cursor position
    setCursorPosition({ line, column });

    // Get text around cursor
    const doc = editor.state.doc;
    const beforeText = doc.textBetween(Math.max(0, from - 100), from);
    const afterText = doc.textBetween(to, Math.min(doc.content.size, to + 100));

    // Get current line text
    const lineStart = pos.start();
    const lineEnd = pos.end();
    const currentLineText = doc.textBetween(lineStart, lineEnd);

    const textContext = {
      before: beforeText,
      after: afterText,
      currentLine: currentLineText,
    };

    setTextAroundCursor(textContext);

    // Debug logging
    console.log("Cursor context updated:", {
      position: { line, column },
      textContext,
    });
  };

  useEffect(() => {
    if (editor && onReady) {
      console.log("TipTap editor ready");
      onReady(editor);

      // Set the document ID as escritoId when editor is ready
      setEscritoId(documentId);

      // Initial cursor context update
      updateCursorContext(editor);
    }
  }, [editor, onReady, documentId, setEscritoId]);

  useEffect(() => {
    return () => {
      if (onDestroy) {
        console.log("TipTap component unmounting");
        onDestroy();
      }
    };
  }, [onDestroy]);

  // Ensure all hooks are called before any conditional returns
  useEffect(() => {
    if (sync.initialContent === null && !sync.isLoading && "create" in sync) {
      console.log("Auto-creating document with ID:", documentId);
      sync.create(EMPTY_DOC);
    }
  }, [sync, documentId]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly]);

  if (sync.isLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="text-gray-500">Cargando documento...</div>
      </div>
    );
  }


  if (sync.initialContent === null) {
    return (
      <div className="legal-editor-content prose prose-lg px-12 py-8 min-h-screen flex items-center justify-center">
        <p className="text-gray-500">
          {sync.initialContent === null
            ? "Creating document..."
            : "Loading document..."}
        </p>
      </div>
    );
  }

  // Editor not ready yet
  if (!editor) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="text-gray-500">Loading editor...</div>
      </div>
    );
  }

  // Editor is ready - render the full editor
  return (
    <div className="office-editor-container">
      {/* Ribbon - Only show if not readOnly */}
      {!readOnly && <RibbonBar editor={editor} />}

      {/* Read-only banner */}
      {readOnly && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
          <div className="flex items-center gap-2 text-amber-800 text-sm">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
            <span>
              Modo de solo lectura - No tienes permisos para editar este escrito
            </span>
          </div>
        </div>
      )}

      {/* Editor Content */}
      <div className="office-editor-content">
        <EditorContent
          editor={editor}
          className="legal-editor-content-wrapper w-full"
        />
      </div>

      {/* Status Bar */}
      <StatusBar editor={editor} />

      {/* Floating Suggestions Menu */}
      <SuggestionsMenu editor={editor} />
    </div>
  );
}
