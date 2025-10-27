import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from "lucide-react";
import { FontPicker } from "../Toolbar/FontPicker";
import { FontSizePicker } from "../Toolbar/FontSizePicker";
import { ColorPicker } from "../Toolbar/ColorPicker";
import { LineHeightPicker } from "../Toolbar/LineHeightPicker";
import { cn } from "@/lib/utils";

interface HomeTabProps {
  editor: Editor;
}

export function HomeTab({ editor }: HomeTabProps) {
  const editorState = useEditorState({
    editor,
    selector: (ctx) => ({
      isBold: ctx.editor.isActive("bold") ?? false,
      isItalic: ctx.editor.isActive("italic") ?? false,
      isUnderline: ctx.editor.isActive("underline") ?? false,
      isStrike: ctx.editor.isActive("strike") ?? false,
      textAlignLeft: ctx.editor.isActive({ textAlign: "left" }) ?? false,
      textAlignCenter: ctx.editor.isActive({ textAlign: "center" }) ?? false,
      textAlignRight: ctx.editor.isActive({ textAlign: "right" }) ?? false,
      textAlignJustify: ctx.editor.isActive({ textAlign: "justify" }) ?? false,
    }),
  });

  return (
    <div className="ribbon-tab-content">
      {/* Font Group */}
      <div className="ribbon-group">
        <div className="ribbon-group-label">Fuente</div>
        <div className="ribbon-group-content">
          <div className="flex flex-col gap-1">
            {/* Font Family and Size Row */}
            <div className="flex gap-1">
              <FontPicker editor={editor} />
              <FontSizePicker editor={editor} />
            </div>

            {/* Formatting Buttons Row */}
            <div className="flex gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleMark("bold").run()}
                className={cn(
                  "h-7 w-7 p-0 hover:bg-office-hover",
                  editorState.isBold && "bg-office-active",
                )}
                title="Negrita (Ctrl+B)"
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  editor.chain().focus().toggleMark("italic").run()
                }
                className={cn(
                  "h-7 w-7 p-0 hover:bg-office-hover",
                  editorState.isItalic && "bg-office-active",
                )}
                title="Cursiva (Ctrl+I)"
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleUnderline?.().run()}
                className={cn(
                  "h-7 w-7 p-0 hover:bg-office-hover",
                  editorState.isUnderline && "bg-office-active",
                )}
                title="Subrayado (Ctrl+U)"
              >
                <UnderlineIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  editor.chain().focus().toggleMark("strike").run()
                }
                className={cn(
                  "h-7 w-7 p-0 hover:bg-office-hover",
                  editorState.isStrike && "bg-office-active",
                )}
                title="Tachado"
              >
                <Strikethrough className="h-4 w-4" />
              </Button>
              <div className="w-px h-6 bg-gray-300 mx-1 self-center" />
              <ColorPicker editor={editor} />
            </div>
          </div>
        </div>
      </div>

      <div className="ribbon-separator" />

      {/* Paragraph Group */}
      <div className="ribbon-group">
        <div className="ribbon-group-label">Párrafo</div>
        <div className="ribbon-group-content">
          <div className="flex flex-col gap-1">
            {/* Alignment buttons */}
            <div className="flex gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  editor.chain().focus().setTextAlign("left").run()
                }
                className={cn(
                  "h-7 w-7 p-0 hover:bg-office-hover",
                  editorState.textAlignLeft && "bg-office-active",
                )}
                title="Alinear a la izquierda (Ctrl+L)"
              >
                <AlignLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  editor.chain().focus().setTextAlign("center").run()
                }
                className={cn(
                  "h-7 w-7 p-0 hover:bg-office-hover",
                  editorState.textAlignCenter && "bg-office-active",
                )}
                title="Centrar (Ctrl+E)"
              >
                <AlignCenter className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  editor.chain().focus().setTextAlign("right").run()
                }
                className={cn(
                  "h-7 w-7 p-0 hover:bg-office-hover",
                  editorState.textAlignRight && "bg-office-active",
                )}
                title="Alinear a la derecha (Ctrl+R)"
              >
                <AlignRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  editor.chain().focus().setTextAlign("justify").run()
                }
                className={cn(
                  "h-7 w-7 p-0 hover:bg-office-hover",
                  editorState.textAlignJustify && "bg-office-active",
                )}
                title="Justificar (Ctrl+J)"
              >
                <AlignJustify className="h-4 w-4" />
              </Button>
            </div>

            {/* Line height picker */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-600">Interlineado:</span>
              <LineHeightPicker editor={editor} />
            </div>
          </div>
        </div>
      </div>

      <div className="ribbon-separator" />

      {/* Styles Group */}
      <div className="ribbon-group">
        <div className="ribbon-group-label">Estilos</div>
        <div className="ribbon-group-content">
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().setParagraph().run()}
              className="h-7 px-3 text-xs hover:bg-office-hover"
            >
              Normal
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 1 }).run()
              }
              className="h-7 px-3 text-xs font-bold hover:bg-office-hover"
            >
              Título 1
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
              className="h-7 px-3 text-xs font-bold hover:bg-office-hover"
            >
              Título 2
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
