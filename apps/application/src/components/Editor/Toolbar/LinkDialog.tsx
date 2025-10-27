import { useState, useEffect } from "react";
import type { Editor } from "@tiptap/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LinkDialogProps {
  editor: Editor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LinkDialog({ editor, open, onOpenChange }: LinkDialogProps) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    if (open) {
      // Get current link if exists
      const previousUrl = editor.getAttributes("link").href || "";
      setUrl(previousUrl);

      // Get selected text or current link text
      const { from, to } = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(from, to, "");
      setText(selectedText);
    }
  }, [open, editor]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!url) {
      // If no URL, remove the link
      editor.chain().focus().unsetLink().run();
      onOpenChange(false);
      return;
    }

    // If there's selected text or text in the input
    if (text) {
      // If nothing is selected, insert new text with link
      const { from, to } = editor.state.selection;
      if (from === to) {
        editor
          .chain()
          .focus()
          .insertContent(`<a href="${url}">${text}</a>`)
          .run();
      } else {
        // Update existing selection
        editor.chain().focus().setLink({ href: url }).run();
      }
    } else {
      // Just set the link on current selection
      editor.chain().focus().setLink({ href: url }).run();
    }

    onOpenChange(false);
    setUrl("");
    setText("");
  };

  const handleRemoveLink = () => {
    editor.chain().focus().unsetLink().run();
    onOpenChange(false);
    setUrl("");
    setText("");
  };

  const isLinkActive = editor.isActive("link");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isLinkActive ? "Editar hipervínculo" : "Insertar hipervínculo"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="link-text">Texto</Label>
              <Input
                id="link-text"
                placeholder="Texto a mostrar"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                type="url"
                placeholder="https://ejemplo.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            {isLinkActive && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleRemoveLink}
              >
                Quitar vínculo
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit">
              {isLinkActive ? "Actualizar" : "Insertar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
