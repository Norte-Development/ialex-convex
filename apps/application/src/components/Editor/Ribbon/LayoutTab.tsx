import type { Editor } from "@tiptap/core";
import { Button } from "@/components/ui/button";
import { FileText, Columns, Ruler, Plus, Minus, Trash2 } from "lucide-react";

interface LayoutTabProps {
  editor: Editor;
}

export function LayoutTab({ editor }: LayoutTabProps) {
  return (
    <div className="ribbon-tab-content">
      {/* Page Setup Group */}
      <div className="ribbon-group">
        <div className="ribbon-group-label">Configurar página</div>
        <div className="ribbon-group-content flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-2 px-3 hover:bg-office-hover"
            title="Márgenes"
          >
            <Ruler className="h-6 w-6" />
            <span className="text-xs">Márgenes</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-2 px-3 hover:bg-office-hover"
            title="Orientación"
          >
            <FileText className="h-6 w-6" />
            <span className="text-xs">Orientación</span>
          </Button>
        </div>
      </div>

      <div className="ribbon-separator" />

      {/* Paragraph Group */}
      <div className="ribbon-group">
        <div className="ribbon-group-label">Párrafo</div>
        <div className="ribbon-group-content">
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-2 px-3 hover:bg-office-hover"
            title="Columnas"
          >
            <Columns className="h-6 w-6" />
            <span className="text-xs">Columnas</span>
          </Button>
        </div>
      </div>

      <div className="ribbon-separator" />

      {/* Table Tools Group - Only show when in a table */}
      {editor.isActive("table") && (
        <div className="ribbon-group">
          <div className="ribbon-group-label">Herramientas de tabla</div>
          <div className="ribbon-group-content flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="flex flex-col items-center gap-1 h-auto py-2 px-3 hover:bg-office-hover"
              title="Agregar columna antes"
              onClick={() => editor.chain().focus().addColumnBefore().run()}
            >
              <Plus className="h-4 w-4" />
              <span className="text-xs">+ Col</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex flex-col items-center gap-1 h-auto py-2 px-3 hover:bg-office-hover"
              title="Agregar fila antes"
              onClick={() => editor.chain().focus().addRowBefore().run()}
            >
              <Plus className="h-4 w-4" />
              <span className="text-xs">+ Fila</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex flex-col items-center gap-1 h-auto py-2 px-3 hover:bg-office-hover"
              title="Eliminar columna"
              onClick={() => editor.chain().focus().deleteColumn().run()}
            >
              <Minus className="h-4 w-4" />
              <span className="text-xs">- Col</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex flex-col items-center gap-1 h-auto py-2 px-3 hover:bg-office-hover"
              title="Eliminar fila"
              onClick={() => editor.chain().focus().deleteRow().run()}
            >
              <Minus className="h-4 w-4" />
              <span className="text-xs">- Fila</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex flex-col items-center gap-1 h-auto py-2 px-3 hover:bg-office-hover"
              title="Eliminar tabla"
              onClick={() => editor.chain().focus().deleteTable().run()}
            >
              <Trash2 className="h-4 w-4" />
              <span className="text-xs">Eliminar</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
