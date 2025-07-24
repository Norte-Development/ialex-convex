"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { useEffect } from "react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";
import { Underline as UnderlineIcon } from "lucide-react";
import {
  InlineChange,
  BlockChange,
  LineBreakChange,
} from "./extensions/changeNode";
import { TrackingExtension } from "./extensions/tracking";
import {
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { api } from "../../../convex/_generated/api";

interface TiptapProps {
  documentId?: string;
  onReady?: (editor: Editor) => void;
  onDestroy?: () => void;
}

export function Tiptap({
  documentId = "default-document",
  onReady,
  onDestroy,
}: TiptapProps) {
  const sync = useTiptapSync(api.prosemirror, documentId);

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
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
      content:
        sync.initialContent ||
        `
      <h1>LEGAL DOCUMENT</h1>
      <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
      <p><strong>Matter:</strong> [Case/Matter Reference]</p>
      <br>
      <p>Begin drafting your legal document here...</p>
    `,
      editorProps: {
        attributes: {
          class: "legal-editor-content",
        },
      },
    },
    [sync.initialContent, sync.extension],
  );

  // Handle editor ready callback
  useEffect(() => {
    if (editor && onReady) {
      console.log("TipTap editor ready");
      onReady(editor);
    }
  }, [editor, onReady]);

  // Handle cleanup
  useEffect(() => {
    return () => {
      if (onDestroy) {
        console.log("TipTap component unmounting");
        onDestroy();
      }
    };
  }, [onDestroy]);

  if (sync.isLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50">
        <div className="text-gray-500">Loading document...</div>
      </div>
    );
  }

  if (sync.initialContent === null) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-gray-50 gap-4">
        <div className="text-gray-500">No document found</div>
        <Button onClick={() => sync.create({ type: "doc", content: [] })}>
          Create document
        </Button>
      </div>
    );
  }

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50">
        <div className="text-gray-500">Loading editor...</div>
      </div>
    );
  }

  return (
    <div className="legal-editor-container">
      {/* Header */}
      <div className="legal-editor-header">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-6 w-6 text-blue-900" />
          <h2 className="text-xl font-semibold text-gray-800">
            Legal Document Editor
          </h2>
        </div>

        {/* Toolbar */}
        <div className="legal-editor-toolbar">
          <div className="toolbar-group">
            <Button
              variant={editor.isActive("bold") ? "default" : "ghost"}
              size="sm"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className="toolbar-button"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              variant={editor.isActive("italic") ? "default" : "ghost"}
              size="sm"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className="toolbar-button"
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleUnderline?.().run()}
              className="toolbar-button"
            >
              <UnderlineIcon className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <div className="toolbar-group">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().setTextAlign("left").run()}
              className="toolbar-button"
            >
              <AlignLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                editor.chain().focus().setTextAlign("center").run()
              }
              className="toolbar-button"
            >
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().setTextAlign("right").run()}
              className="toolbar-button"
            >
              <AlignRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                editor.chain().focus().setTextAlign("justify").run()
              }
              className="toolbar-button"
            >
              <AlignJustify className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <div className="toolbar-group">
            <Button
              variant={editor.isActive("bulletList") ? "default" : "ghost"}
              size="sm"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className="toolbar-button"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={editor.isActive("orderedList") ? "default" : "ghost"}
              size="sm"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className="toolbar-button"
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
            <Button
              variant={editor.isActive("blockquote") ? "default" : "ghost"}
              size="sm"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className="toolbar-button"
            >
              <Quote className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <div className="toolbar-group">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className="toolbar-button"
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className="toolbar-button"
            >
              <Redo className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Document Container */}
      <div className="legal-document-container">
        <div className="legal-document-page">
          <EditorContent
            editor={editor}
            className="legal-editor-content-wrapper"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="legal-editor-footer">
        <div className="text-sm text-gray-500">
          Words: {editor.storage.characterCount?.words() || 0} | Characters:{" "}
          {editor.storage.characterCount?.characters() || 0}
        </div>
      </div>
    </div>
  );
}
