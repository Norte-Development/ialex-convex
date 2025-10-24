// import { Button } from "@/components/ui/button";
// import { FileText } from "lucide-react";
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
import { FileDown } from "lucide-react";
import { exportToWord } from "@/utils/exportWord";
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

  const handleSaveAsTemplate = async (
    title: string,
    category: string,
    isPublic: boolean,
    tags: string[],
  ) => {
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
        <div>
          <h1 className="text-2xl font-semibold">{escrito?.title}</h1>
          {/* metadata */}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportToWord}
            disabled={isExporting}
          >
            <FileDown className="h-4 w-4 mr-2" />
            {isExporting ? "Exportando..." : "Exportar a Word"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpenSaveTemplateModal(true)}
          >
            Guardar como modelo
          </Button>
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
