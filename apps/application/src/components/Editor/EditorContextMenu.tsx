// @ts-ignore - TypeScript cache issue with @tiptap/core types
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Scissors,
  Copy,
  Clipboard,
  MessageSquare,
} from "lucide-react";
import { chatSelectionBus } from "@/lib/chatSelectionBus";
import { useEscrito } from "@/context/EscritoContext";

interface EditorContextMenuProps {
  editor: Editor;
  readOnly?: boolean;
  children: React.ReactNode;
}

export function EditorContextMenu({
  editor,
  readOnly = false,
  children,
}: EditorContextMenuProps) {
  const { escritoId } = useEscrito();
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
      hasSelection: ctx.editor.state.selection.empty === false,
    }),
  });

  const canCut = !readOnly && editorState.hasSelection;
  const canCopy = editorState.hasSelection;
  const canPaste = !readOnly;
  const canAddToChat = editorState.hasSelection && escritoId;

  const handleCut = async () => {
    if (!readOnly && editorState.hasSelection) {
      try {
        const selectedText = editor.state.doc.textBetween(
          editor.state.selection.from,
          editor.state.selection.to
        );
        await navigator.clipboard.writeText(selectedText);
        editor.chain().focus().deleteSelection().run();
      } catch (error) {
        // Fallback to execCommand
        document.execCommand("cut");
      }
    }
  };

  const handleCopy = async () => {
    if (editorState.hasSelection) {
      try {
        const selectedText = editor.state.doc.textBetween(
          editor.state.selection.from,
          editor.state.selection.to
        );
        await navigator.clipboard.writeText(selectedText);
      } catch (error) {
        // Fallback to execCommand
        document.execCommand("copy");
      }
    }
  };

  const handlePaste = async () => {
    if (!readOnly) {
      editor.chain().focus().run();
      // Focus the editor - user can then paste with Ctrl+V or browser will handle it
      // For programmatic paste, we'd need clipboard API permissions which may not be available
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          editor.chain().insertContent(text).run();
        }
      } catch (error) {
        // Clipboard API not available or permission denied
        // Just focus the editor - user can paste manually
        editor.chain().focus().run();
      }
    }
  };

  const handleAddToChat = () => {
    if (!editorState.hasSelection || !escritoId) return;

    const { from, to } = editor.state.selection;
    const content = editor.state.doc.textBetween(from, to);
    
    // Calculate line and column from position
    const textBeforeSelection = editor.state.doc.textBetween(0, from);
    const lines = textBeforeSelection.split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;

    // Create preview (truncate if too long)
    const preview = content.length > 50 
      ? `${content.substring(0, 50)}...` 
      : content;

    // Publish selection to chat bus
    chatSelectionBus.publish({
      type: "selection",
      id: `${escritoId}-${from}-${to}`,
      name: preview,
      selection: {
        content,
        position: { line, column },
        range: { from, to },
        escritoId,
      },
    });
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {/* Clipboard operations */}
        {!readOnly && (
          <>
            <ContextMenuItem
              onClick={handleCut}
              disabled={!canCut}
              className="cursor-pointer"
            >
              <Scissors className="h-4 w-4" />
              <span>Cortar</span>
              <ContextMenuShortcut>⌘X</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}
        <ContextMenuItem
          onClick={handleCopy}
          disabled={!canCopy}
          className="cursor-pointer"
        >
          <Copy className="h-4 w-4" />
          <span>Copiar</span>
          <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        {!readOnly && (
          <ContextMenuItem
            onClick={handlePaste}
            disabled={!canPaste}
            className="cursor-pointer"
          >
            <Clipboard className="h-4 w-4" />
            <span>Pegar</span>
            <ContextMenuShortcut>⌘V</ContextMenuShortcut>
          </ContextMenuItem>
        )}

        <ContextMenuItem
          onClick={handleAddToChat}
          disabled={!canAddToChat}
          className="cursor-pointer"
        >
          <MessageSquare className="h-4 w-4" />
          <span>Agregar selección al chat</span>
        </ContextMenuItem>

        {!readOnly && (
          <>
            <ContextMenuSeparator />

            {/* Text formatting */}
            <ContextMenuCheckboxItem
              checked={editorState.isBold}
              onCheckedChange={() =>
                editor.chain().focus().toggleMark("bold").run()
              }
              className="cursor-pointer"
            >
              <Bold className="h-4 w-4" />
              <span>Negrita</span>
              <ContextMenuShortcut>⌘B</ContextMenuShortcut>
            </ContextMenuCheckboxItem>
            <ContextMenuCheckboxItem
              checked={editorState.isItalic}
              onCheckedChange={() =>
                editor.chain().focus().toggleMark("italic").run()
              }
              className="cursor-pointer"
            >
              <Italic className="h-4 w-4" />
              <span>Cursiva</span>
              <ContextMenuShortcut>⌘I</ContextMenuShortcut>
            </ContextMenuCheckboxItem>
            <ContextMenuCheckboxItem
              checked={editorState.isUnderline}
              onCheckedChange={() =>
                editor.chain().focus().toggleUnderline?.().run()
              }
              className="cursor-pointer"
            >
              <UnderlineIcon className="h-4 w-4" />
              <span>Subrayado</span>
              <ContextMenuShortcut>⌘U</ContextMenuShortcut>
            </ContextMenuCheckboxItem>
            <ContextMenuCheckboxItem
              checked={editorState.isStrike}
              onCheckedChange={() =>
                editor.chain().focus().toggleMark("strike").run()
              }
              className="cursor-pointer"
            >
              <Strikethrough className="h-4 w-4" />
              <span>Tachado</span>
            </ContextMenuCheckboxItem>

            <ContextMenuSeparator />

            {/* Text alignment */}
            <ContextMenuCheckboxItem
              checked={editorState.textAlignLeft}
              onCheckedChange={() =>
                editor.chain().focus().setTextAlign("left").run()
              }
              className="cursor-pointer"
            >
              <AlignLeft className="h-4 w-4" />
              <span>Alinear a la izquierda</span>
            </ContextMenuCheckboxItem>
            <ContextMenuCheckboxItem
              checked={editorState.textAlignCenter}
              onCheckedChange={() =>
                editor.chain().focus().setTextAlign("center").run()
              }
              className="cursor-pointer"
            >
              <AlignCenter className="h-4 w-4" />
              <span>Centrar</span>
            </ContextMenuCheckboxItem>
            <ContextMenuCheckboxItem
              checked={editorState.textAlignRight}
              onCheckedChange={() =>
                editor.chain().focus().setTextAlign("right").run()
              }
              className="cursor-pointer"
            >
              <AlignRight className="h-4 w-4" />
              <span>Alinear a la derecha</span>
            </ContextMenuCheckboxItem>
            <ContextMenuCheckboxItem
              checked={editorState.textAlignJustify}
              onCheckedChange={() =>
                editor.chain().focus().setTextAlign("justify").run()
              }
              className="cursor-pointer"
            >
              <AlignJustify className="h-4 w-4" />
              <span>Justificar</span>
            </ContextMenuCheckboxItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

