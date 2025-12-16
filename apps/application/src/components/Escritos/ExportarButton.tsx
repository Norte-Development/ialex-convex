import { useState } from "react";
import { Button } from "../ui/button";
import { FileDown, FileText, ChevronDown, Save } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { toast } from "sonner";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { exportToWord } from "@/components/Editor/utils/exportWord";
import { exportToPdfReact } from "@/components/Editor/utils/exportPdfReact";
import { saveEscritoAsTemplate } from "@/components/Editor/template";
import { SaveTemplateModal } from "./save-template-modal";
import type { TiptapRef } from "@/components/Editor/tiptap-editor";
import { generateHTML } from "@tiptap/html";
import { extensions } from "../Editor/extensions";
import { useCase } from "@/context/CaseContext";
import type { Id } from "../../../convex/_generated/dataModel";
interface ExportarButtonProps {
  escrito: {
    _id: string;
    title: string;
    courtName?: string;
    expedientNumber?: string;
    presentationDate?: string;
    category?: string;
    isPublic?: boolean;
    tags?: string[];
  };
  editorRef: React.RefObject<TiptapRef>;
}

export function ExportarButton({ escrito, editorRef }: ExportarButtonProps) {
  const [openSaveTemplateModal, setOpenSaveTemplateModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const createTemplate = useMutation(api.functions.templates.createModelo);
  const exportToGoogleDocs = useAction(api.functions.documentManagement.escritosExports.exportEscritoToGoogleDocs);
  const { currentCase } = useCase();
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
        presentationDate: escrito.presentationDate ? new Date(escrito.presentationDate).getTime() : undefined,
      });
      toast.success("Documento Word descargado correctamente");
    } catch (error) {
      console.error("❌ Error al exportar:", error);
      toast.error("Error al exportar el documento");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportToGoogleDocs = async () => {
    if (editorRef.current?.hasPendingSuggestions?.()) {
      toast.error(
        "No puedes exportar mientras hay sugerencias pendientes. Acepta o rechaza todos los cambios.",
      );
      return;
    }

    const content = editorRef.current?.getContent();
    if (!content) {
      toast.error("No hay contenido para exportar");
      return;
    }

    const htmlContent = generateHTML(content, extensions);

    const doc = await exportToGoogleDocs({
      escritoId: escrito._id as Id<"escritos">,
      caseId: currentCase?._id as Id<"cases">,
      html: htmlContent,
    });
    
    if (doc) {
      toast.success("Documento exportado correctamente a Google Docs");
      window.open(doc.docUrl, "_blank");
    } else {
      toast.error("Error al exportar el documento a Google Docs");
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
      const content = editorRef.current?.getContent();

      if (!content) {
        toast.error("No hay contenido para exportar");
        return;
      }

      await exportToPdfReact(content, {
        title: escrito.title,
        courtName: escrito.courtName,
        expedientNumber: escrito.expedientNumber,
        presentationDate: escrito.presentationDate ? new Date(escrito.presentationDate).getTime() : undefined,
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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center  sm:flex-initial"
            disabled={isExporting}
          >
            <Save className="h-4 w-4 sm:mr-2" />
            <span className="">Exportar</span>
            <ChevronDown className="ml-auto sm:ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExportToWord}>
            <FileText className="h-4 w-4 mr-2" />
            Word
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleExportToGoogleDocs}>
            <FileDown className="h-4 w-4 mr-2" />
            Google Docs
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
    </>
  );
}
