import type { Editor } from "@tiptap/core";
import { Button } from "@/components/ui/button";
import { Table, Image, Link, FileText } from "lucide-react";
import { useState } from "react";
import { LinkDialog } from "../Toolbar/LinkDialog";

interface InsertTabProps {
  editor: Editor;
}

export function InsertTab({ editor }: InsertTabProps) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  return (
    <div className="ribbon-tab-content">
      {/* Tables Group */}
      <div className="ribbon-group">
        <div className="ribbon-group-label">Tablas</div>
        <div className="ribbon-group-content">
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-2 px-3 hover:bg-office-hover"
            title="Insertar tabla 3x3"
            onClick={() => {
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run();
            }}
          >
            <Table className="h-6 w-6" />
            <span className="text-xs">Tabla</span>
          </Button>
        </div>
      </div>

      <div className="ribbon-separator" />

      {/* Illustrations Group */}
      <div className="ribbon-group">
        <div className="ribbon-group-label">Ilustraciones</div>
        <div className="ribbon-group-content flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-2 px-3 hover:bg-office-hover"
            title="Insertar imagen"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.onchange = (e: Event) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const base64 = event.target?.result as string;
                    editor.chain().focus().setImage({ src: base64 }).run();
                  };
                  reader.readAsDataURL(file);
                }
              };
              input.click();
            }}
          >
            <Image className="h-6 w-6" />
            <span className="text-xs">Imagen</span>
          </Button>
        </div>
      </div>

      <div className="ribbon-separator" />

      {/* Links Group */}
      <div className="ribbon-group">
        <div className="ribbon-group-label">Vínculos</div>
        <div className="ribbon-group-content">
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-2 px-3 hover:bg-office-hover"
            title="Insertar hipervínculo"
            onClick={() => setLinkDialogOpen(true)}
          >
            <Link className="h-6 w-6" />
            <span className="text-xs">Vínculo</span>
          </Button>
        </div>
      </div>

      <div className="ribbon-separator" />

      {/* Page Group */}
      <div className="ribbon-group">
        <div className="ribbon-group-label">Páginas</div>
        <div className="ribbon-group-content">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Insert page break
              editor.chain().focus().setHardBreak().run();
            }}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3 hover:bg-office-hover"
            title="Salto de página"
          >
            <FileText className="h-6 w-6" />
            <span className="text-xs">Salto de página</span>
          </Button>
        </div>
      </div>

      <LinkDialog
        editor={editor}
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
      />
    </div>
  );
}
