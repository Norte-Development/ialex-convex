import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { useEffect } from "react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";
import { UnderlineIcon } from "lucide-react";
import {
  InlineChange,
  BlockChange,
  LineBreakChange,
} from "../../../../../packages/shared/src/tiptap/changeNodes";
import { TrackingExtension } from "./extensions/tracking";
import "./editor-styles.css";
import {
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Quote,
  Code,
  Strikethrough,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { api } from "../../../convex/_generated/api";
import { useEscrito } from "@/context/EscritoContext";

interface TiptapProps {
  documentId?: string;
  onReady?: (editor: Editor) => void;
  onDestroy?: () => void;
  readOnly?: boolean;
}

function MenuBar({ editor }: { editor: Editor }) {
  // Read the current editor's state, and re-render the component when it changes
  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      return {
        isBold: ctx.editor.isActive("bold") ?? false,
        canBold: ctx.editor.can().toggleMark("bold") ?? false,
        isItalic: ctx.editor.isActive("italic") ?? false,
        canItalic: ctx.editor.can().toggleMark("italic") ?? false,
        isStrike: ctx.editor.isActive("strike") ?? false,
        canStrike: ctx.editor.can().toggleMark("strike") ?? false,
        isCode: ctx.editor.isActive("code") ?? false,
        canCode: ctx.editor.can().toggleMark("code") ?? false,
        isUnderline: ctx.editor.isActive("underline") ?? false,
        canUnderline:
          ctx.editor.can().chain().toggleUnderline?.().run() ?? false,
        isParagraph: ctx.editor.isActive("paragraph") ?? false,
        isHeading1: ctx.editor.isActive("heading", { level: 1 }) ?? false,
        isHeading2: ctx.editor.isActive("heading", { level: 2 }) ?? false,
        isHeading3: ctx.editor.isActive("heading", { level: 3 }) ?? false,
        isBulletList: ctx.editor.isActive("bulletList") ?? false,
        isOrderedList: ctx.editor.isActive("orderedList") ?? false,
        isCodeBlock: ctx.editor.isActive("codeBlock") ?? false,
        isBlockquote: ctx.editor.isActive("blockquote") ?? false,
        textAlignLeft: ctx.editor.isActive({ textAlign: "left" }) ?? false,
        textAlignCenter: ctx.editor.isActive({ textAlign: "center" }) ?? false,
        textAlignRight: ctx.editor.isActive({ textAlign: "right" }) ?? false,
        textAlignJustify:
          ctx.editor.isActive({ textAlign: "justify" }) ?? false,
        canUndo: true,
        canRedo: true,
      };
    },
  });

  return (
    <div className="border-b border-gray-200 bg-gray-50/50 px-4 py-3 ">
      <div className="flex items-center gap-1 flex-wrap">
        {/* Undo/Redo */}
        {/* <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().}
          disabled={!editorState.canUndo}
          className="h-8 w-8 p-0 hover:bg-gray-100 disabled:opacity-50"
        >
          <Undo className="h-4 w-4" />
        </Button> */}
        {/* <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editorState.canRedo}
          className="h-8 w-8 p-0 hover:bg-gray-100 disabled:opacity-50"
        >
          <Redo className="h-4 w-4" />
        </Button> */}

        <Separator orientation="vertical" className="h-6 mx-2" />

        {/* Text Formatting */}
        <Button
          variant={editorState.isBold ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleMark("bold").run()}
          disabled={!editorState.canBold}
          className="h-8 w-8 p-0 hover:bg-gray-100"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant={editorState.isItalic ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleMark("italic").run()}
          disabled={!editorState.canItalic}
          className="h-8 w-8 p-0 hover:bg-gray-100"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant={editorState.isUnderline ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline?.().run()}
          disabled={!editorState.canUnderline}
          className="h-8 w-8 p-0 hover:bg-gray-100"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        <Button
          variant={editorState.isStrike ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleMark("strike").run()}
          disabled={!editorState.canStrike}
          className="h-8 w-8 p-0 hover:bg-gray-100"
        >
          <Strikethrough className="h-4 w-4" />
        </Button>
        <Button
          variant={editorState.isCode ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleMark("code").run()}
          disabled={!editorState.canCode}
          className="h-8 w-8 p-0 hover:bg-gray-100"
        >
          <Code className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-2" />

        {/* Headings */}
        <Button
          variant={editorState.isHeading1 ? "secondary" : "ghost"}
          size="sm"
          onClick={() =>
            editor.chain().focus().toggleMark("heading", { level: 1 }).run()
          }
          className="h-8 px-2 hover:bg-gray-100 text-xs font-bold"
        >
          H1
        </Button>
        <Button
          variant={editorState.isHeading2 ? "secondary" : "ghost"}
          size="sm"
          onClick={() =>
            editor.chain().focus().toggleMark("heading", { level: 2 }).run()
          }
          className="h-8 px-2 hover:bg-gray-100 text-xs font-bold"
        >
          H2
        </Button>
        <Button
          variant={editorState.isHeading3 ? "secondary" : "ghost"}
          size="sm"
          onClick={() =>
            editor.chain().focus().toggleMark("heading", { level: 3 }).run()
          }
          className="h-8 px-2 hover:bg-gray-100 text-xs font-bold"
        >
          H3
        </Button>

        <Separator orientation="vertical" className="h-6 mx-2" />

        {/* Text Alignment */}
        <Button
          variant={editorState.textAlignLeft ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className="h-8 w-8 p-0 hover:bg-gray-100"
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          variant={editorState.textAlignCenter ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className="h-8 w-8 p-0 hover:bg-gray-100"
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          variant={editorState.textAlignRight ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className="h-8 w-8 p-0 hover:bg-gray-100"
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button
          variant={editorState.textAlignJustify ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          className="h-8 w-8 p-0 hover:bg-gray-100"
        >
          <AlignJustify className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-2" />

        {/* Lists and Blocks */}
        {/* <Button
          variant={editorState.isBulletList ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleList('bullet').run()}
          className="h-8 w-8 p-0 hover:bg-gray-100"
        >
          <List className="h-4 w-4" />
        </Button> */}
        {/* <Button
          variant={editorState.isOrderedList ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className="h-8 w-8 p-0 hover:bg-gray-100"
        > */}
        {/* <ListOrdered className="h-4 w-4" />
        </Button> */}
        <Button
          variant={editorState.isBlockquote ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleMark("blockquote").run()}
          className="h-8 w-8 p-0 hover:bg-gray-100"
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          variant={editorState.isCodeBlock ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleMark("codeBlock").run()}
          className="h-8 w-8 p-0 hover:bg-gray-100"
        >
          <Code className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-2" />

        {/* Additional formatting */}
        {/* <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="h-8 w-8 p-0 hover:bg-gray-100"
        >
          <Minus className="h-4 w-4" />
        </Button> */}
      </div>
    </div>
  );
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
        InlineChange,
        BlockChange,
        LineBreakChange,
        TrackingExtension,
        TextAlign.configure({
          types: ["heading", "paragraph"],
        }),
        Underline,
        ...(sync.extension ? [sync.extension] : []),
      ],
      content: sync.initialContent,
      editable: !readOnly, // Make editor read-only based on permissions
      editorProps: {
        attributes: {
          class: `legal-editor-content prose prose-lg focus:outline-none px-12 py-8 min-h-screen ${readOnly ? "cursor-default select-text" : ""}`,
          "data-placeholder": readOnly
            ? ""
            : "Start writing your legal document...",
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Toolbar - Only show if not readOnly */}
      {!readOnly && <MenuBar editor={editor} />}

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
      <div className="bg-white min-h-[600px] w-full">
        <EditorContent
          editor={editor}
          className="legal-editor-content-wrapper w-full"
        />
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-gray-50/50 px-4 py-2">
        <div className="text-xs text-gray-500 flex justify-between items-center">
          <span>
            Words: {editor.storage.characterCount?.words() || 0} | Characters:{" "}
            {editor.storage.characterCount?.characters() || 0}
          </span>
        </div>
      </div>
    </div>
  );
}
