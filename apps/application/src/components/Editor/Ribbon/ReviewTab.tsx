import type { Editor } from "@tiptap/core";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle } from "lucide-react";
// Imports comentados para futuras versiones: FileCheck, MessageSquare
import { useCallback } from "react";

interface ReviewTabProps {
  editor: Editor;
}

export function ReviewTab({ editor }: ReviewTabProps) {
  // Accept all changes function
  const acceptAllChanges = useCallback(() => {
    if (!editor || !editor.state || !editor.view) return;

    const tr = editor.state.tr;
    const nodesToProcess: Array<{ node: any; pos: number }> = [];

    editor.state.doc.descendants((node, pos) => {
      if (
        node.type.name === "inlineChange" ||
        node.type.name === "blockChange" ||
        node.type.name === "lineBreakChange"
      ) {
        nodesToProcess.push({ node, pos });
      }
    });

    nodesToProcess.reverse().forEach(({ node, pos }) => {
      if (node.attrs.changeType === "added") {
        tr.replaceWith(pos, pos + node.nodeSize, node.content);
      } else if (node.attrs.changeType === "deleted") {
        tr.delete(pos, pos + node.nodeSize);
      }
    });

    editor.view.dispatch(tr);
  }, [editor]);

  // Reject all changes function
  const rejectAllChanges = useCallback(() => {
    if (!editor || !editor.state || !editor.view) return;

    const tr = editor.state.tr;
    const nodesToProcess: Array<{ node: any; pos: number }> = [];

    editor.state.doc.descendants((node, pos) => {
      if (
        node.type.name === "inlineChange" ||
        node.type.name === "blockChange" ||
        node.type.name === "lineBreakChange"
      ) {
        nodesToProcess.push({ node, pos });
      }
    });

    nodesToProcess.reverse().forEach(({ node, pos }) => {
      if (node.attrs.changeType === "added") {
        tr.delete(pos, pos + node.nodeSize);
      } else if (node.attrs.changeType === "deleted") {
        tr.replaceWith(pos, pos + node.nodeSize, node.content);
      }
    });

    editor.view.dispatch(tr);
  }, [editor]);

  return (
    <div className="ribbon-tab-content">
      {/* Tracking Group */}
      {/* NOTA: Funcionalidad de control de cambios comentada para v1.0 - implementar en futuras versiones */}
      {/* <div className="ribbon-group">
        <div className="ribbon-group-label">Control de cambios</div>
        <div className="ribbon-group-content">
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-2 px-3 hover:bg-office-hover"
            title="Control de cambios"
          >
            <FileCheck className="h-6 w-6" />
            <span className="text-xs">Control de cambios</span>
          </Button>
        </div>
      </div> */}

      {/* <div className="ribbon-separator" /> */}

      {/* Changes Group */}
      <div className="ribbon-group">
        <div className="ribbon-group-label">Cambios del Agente</div>
        <div className="ribbon-group-content flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={acceptAllChanges}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3 hover:bg-office-hover"
            title="Aceptar todos los cambios sugeridos por el agente"
          >
            <CheckCircle className="h-6 w-6 text-green-600" />
            <span className="text-xs">Aceptar todos</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={rejectAllChanges}
            className="flex flex-col items-center gap-1 h-auto py-2 px-3 hover:bg-office-hover"
            title="Rechazar todos los cambios sugeridos por el agente"
          >
            <XCircle className="h-6 w-6 text-red-600" />
            <span className="text-xs">Rechazar todos</span>
          </Button>
        </div>
      </div>

      {/* <div className="ribbon-separator" /> */}

      {/* Comments Group */}
      {/* NOTA: Funcionalidad de comentarios comentada para v1.0 - implementar en futuras versiones */}
      {/* <div className="ribbon-group">
        <div className="ribbon-group-label">Comentarios</div>
        <div className="ribbon-group-content">
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-2 px-3 hover:bg-office-hover"
            title="Nuevo comentario"
          >
            <MessageSquare className="h-6 w-6" />
            <span className="text-xs">Comentario</span>
          </Button>
        </div>
      </div> */}
    </div>
  );
}
