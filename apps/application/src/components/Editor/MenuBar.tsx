// components/editor/MenuBar.tsx
import { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
  Bold,
  Italic,
  UnderlineIcon,
  Strikethrough,
  Code,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Quote,
  // List, ListOrdered if you need them later
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface MenuBarProps {
  editor: Editor;
}

export function MenuBar({ editor }: MenuBarProps) {
  const editorState = useEditorState({
    editor,
    selector: (ctx) => ({
      isBold: ctx.editor.isActive("bold") ?? false,
      canBold: ctx.editor.can().toggleMark("bold") ?? false,
      isItalic: ctx.editor.isActive("italic") ?? false,
      canItalic: ctx.editor.can().toggleMark("italic") ?? false,
      isStrike: ctx.editor.isActive("strike") ?? false,
      canStrike: ctx.editor.can().toggleMark("strike") ?? false,
      isCode: ctx.editor.isActive("code") ?? false,
      canCode: ctx.editor.can().toggleMark("code") ?? false,
      isUnderline: ctx.editor.isActive("underline") ?? false,
      canUnderline: ctx.editor.can().chain().toggleUnderline?.().run() ?? false,
      isHeading1: ctx.editor.isActive("heading", { level: 1 }) ?? false,
      isHeading2: ctx.editor.isActive("heading", { level: 2 }) ?? false,
      isHeading3: ctx.editor.isActive("heading", { level: 3 }) ?? false,
      isBlockquote: ctx.editor.isActive("blockquote") ?? false,
      isCodeBlock: ctx.editor.isActive("codeBlock") ?? false,
      textAlignLeft: ctx.editor.isActive({ textAlign: "left" }) ?? false,
      textAlignCenter: ctx.editor.isActive({ textAlign: "center" }) ?? false,
      textAlignRight: ctx.editor.isActive({ textAlign: "right" }) ?? false,
      textAlignJustify: ctx.editor.isActive({ textAlign: "justify" }) ?? false,
    }),
  });

  return (
    <div className="border-b border-gray-200 bg-gray-50/50 px-4 py-3">
      <div className="flex items-center gap-1 flex-wrap">
        {/* Bold / Italic / Underline / Strike / Code */}
        <Button
          variant={editorState.isBold ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant={editorState.isItalic ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant={editorState.isUnderline ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline?.().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        <Button
          variant={editorState.isStrike ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </Button>
        <Button
          variant={editorState.isCode ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-2" />

        {/* Headings */}
        {["H1", "H2", "H3"].map((h, i) => (
          <Button
            key={h}
            variant={
              editorState[`isHeading${i + 1}` as keyof typeof editorState] ? "secondary" : "ghost"
            }
            size="sm"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: (i + 1) as 1 | 2 | 3 }).run()
            }
            className="h-8 px-2 text-xs font-bold"
          >
            {h}
          </Button>
        ))}

        <Separator orientation="vertical" className="h-6 mx-2" />

        {/* Alignment */}
        <Button
          variant={editorState.textAlignLeft ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          variant={editorState.textAlignCenter ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          variant={editorState.textAlignRight ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button
          variant={editorState.textAlignJustify ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        >
          <AlignJustify className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-2" />

        {/* Blocks */}
        <Button
          variant={editorState.isBlockquote ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          variant={editorState.isCodeBlock ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Code className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}