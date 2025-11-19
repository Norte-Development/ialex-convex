// import { Button } from "@/components/ui/button";
import { Tiptap, TiptapRef } from "@/components/Editor/tiptap-editor";
import { usePermissions } from "@/context/CasePermissionsContext";
// import { useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
// import { EscritoToolsTester } from "@/components/Editor/EscritoToolsTester";
// import { ReadEscritoHelpersTester } from "@/components/Editor/ReadEscritoHelpersTester";
import EscritosLoadingState from "./EscritosLoadingState";
import { Button } from "../ui/button";
import { useRef, useState } from "react";
import { saveEscritoAsTemplate } from "@/components/Editor/template";
import { SaveTemplateModal } from "./save-template-modal";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { FileDown, FileText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { ChevronDown, Save } from "lucide-react";
import { exportToWord } from "@/components/Editor/utils/exportWord";
import { exportElementToPdf } from "@/components/Editor/utils/exportPdf";
import { EscritoStatusBadge } from "./EscritoStatusBadge";
export default function EscritoDetail({
  escrito,
  templateId,
}: {
  escrito: any;
  templateId?: Id<"modelos">;
}) {
  const { can } = usePermissions();
  const editorRef = useRef<TiptapRef>(null);
  const [openSaveTemplateModal, setOpenSaveTemplateModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const createTemplate = useMutation(api.functions.templates.createModelo);
  // const [showToolsTester, setShowToolsTester] = useState(false);
  // const [showReadHelpersTester, setShowReadHelpersTester] = useState(false);

  const handleExportToWord = async () => {
    if (editorRef.current?.hasPendingSuggestions?.()) {
      toast.error(
        "No puedes exportar mientras hay sugerencias pendientes. Acepta o rechaza todos los cambios.",
      );
      return;
    }

    const content = editorRef.current?.getContent();
    console.log("📄 Contenido del editor:", content);

    if (!content) {
      toast.error("No hay contenido para exportar");
      return;
    }

    setIsExporting(true);
    try {
      await exportToWord(content, {
        title: escrito.title,
        courtName: escrito.courtName,
        expedientNumber: escrito.expedientNumber,
        presentationDate: escrito.presentationDate,
      });
      toast.success("Documento Word descargado correctamente");
    } catch (error) {
      console.error("❌ Error al exportar:", error);
      toast.error("Error al exportar el documento");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportToPdf = async () => {
    if (editorRef.current?.hasPendingSuggestions?.()) {
      toast.error(
        "No puedes exportar mientras hay sugerencias pendientes. Acepta o rechaza todos los cambios.",
      );
      return;
    }

    setIsExporting(true);
    try {
      const filename = `${(escrito?.title || "escrito").replace(/\s+/g, "_")}.pdf`;
      await exportElementToPdf({
        element: ".legal-editor-content",
        filename,
        format: "a4",
        orientation: "p",
        marginMm: 10,
        scale: 2,
      });
      toast.success("PDF descargado correctamente");
    } catch (error) {
      console.error("❌ Error al exportar PDF:", error);
      toast.error("Error al exportar el PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveAsTemplate = async (
    title: string,
    category: string,
    isPublic: boolean,
    tags: string[],
  ) => {
    if (editorRef.current?.hasPendingSuggestions?.()) {
      toast.error(
        "No puedes guardar como modelo con sugerencias pendientes. Acepta o rechaza todos los cambios.",
      );
      return;
    }

    const content = editorRef.current?.getContent();
    console.log("content", content);
    if (content) {
      const templateId = await saveEscritoAsTemplate({
        name: title,
        category: category,
        content: content,
        isPublic: isPublic,
        tags: tags,
        createTemplate: createTemplate,
      });
      if (templateId) {
        setOpenSaveTemplateModal(false);
      } else {
        toast.error("Error al guardar el modelo");
      }
    } else {
      toast.error("Error al guardar el modelo. El escrito no tiene contenido.");
    }
  };

  if (escrito === undefined) {
    return <EscritosLoadingState />;
  }

  return (
    <>
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{escrito?.title}</h1>
          <EscritoStatusBadge
            escritoId={escrito._id}
            currentStatus={escrito.status}
          />
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center"
                disabled={isExporting}
              >
                <Save className="h-4 w-4 mr-2" />
                Exportar
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleExportToWord}>
                <FileText className="h-4 w-4 mr-2" />
                Word
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportToPdf}>
                <FileDown className="h-4 w-4 mr-2" />
                PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setOpenSaveTemplateModal(true)}>
                <Save className="h-4 w-4 mr-2" />
                Guardar como modelo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <SaveTemplateModal
          open={openSaveTemplateModal}
          onOpenChange={setOpenSaveTemplateModal}
          onSave={handleSaveAsTemplate}
          defaultValues={{
            title: escrito.title,
            category: escrito.category,
            isPublic: escrito.isPublic,
            tags: escrito.tags,
          }}
        />
        {/* {can.escritos.write && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowToolsTester(!showToolsTester)}
            >
              <FileText className="h-4 w-4 mr-2" />
              {showToolsTester ? "Hide" : "Show"} Tools
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReadHelpersTester(!showReadHelpersTester)}
            >
              <FileText className="h-4 w-4 mr-2" />
              {showReadHelpersTester ? "Hide" : "Show"} Helpers
            </Button>
          </div>
        )} */}
      </div>

      <div className="p-6">
        <div className="flex gap-6">
          <div className="flex-1">
            <Tiptap
              documentId={escrito?.prosemirrorId}
              templateId={templateId}
              readOnly={!can.escritos.write}
              escritoId={escrito?._id}
              caseId={escrito?.caseId}
              ref={editorRef}
            />
          </div>

          {/* {showToolsTester && (
            <div className="w-80 flex-shrink-0">
              <EscritoToolsTester />
            </div>
          )}
          
          {showReadHelpersTester && (
            <div className="w-80 flex-shrink-0">
              <ReadEscritoHelpersTester />
            </div>
          )} */}
        </div>
      </div>
    </>
  );
}
