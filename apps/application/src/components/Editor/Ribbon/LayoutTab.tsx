import type { Editor } from "@tiptap/core";
import { Button } from "@/components/ui/button";
import { FileText, Columns, Ruler } from "lucide-react";

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
    </div>
  );
}

