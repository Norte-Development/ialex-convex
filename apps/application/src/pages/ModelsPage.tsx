import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  TemplatePreviewDialog,
  TemplateSearchBar,
} from "@/components/Modelos";
import TemplateTableContainer from "@/components/Modelos/TemplateTableContainer";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useNavigate } from "react-router-dom";
import { useCase } from "@/context/CaseContext";
import { usePermissions } from "@/context/CasePermissionsContext";
import { useState } from "react";
import { toast } from "sonner";

export default function ModelsPage() {
  const navigate = useNavigate();
  const { currentCase } = useCase();
  const { can } = usePermissions();
  const [previewTemplateId, setPreviewTemplateId] =
    useState<Id<"modelos"> | null>(null);
  const [searchValue, setSearchValue] = useState("");

  const createEscrito = useMutation(api.functions.documents.createEscrito);

  const handleCreateFromTemplate = async (template: {
    _id: Id<"modelos">;
    name: string;
  }) => {
    if (!currentCase?._id) {
      toast.error("No hay un caso seleccionado");
      return;
    }

    if (!can.escritos.write) {
      toast.error("No tienes permisos para crear escritos");
      return;
    }

    try {
      const prosemirrorId = crypto.randomUUID();
      const result = await createEscrito({
        title: template.name,
        caseId: currentCase._id,
        prosemirrorId,
      });

      toast.success("Escrito creado desde plantilla");
      navigate(
        `/caso/${currentCase._id}/escritos/${result.escritoId}?templateId=${template._id}`,
      );
    } catch (error) {
      console.error("Error al crear escrito desde plantilla", error);
      toast.error("No se pudo crear el escrito");
    }
  };

  const handlePreviewTemplate = (templateId: Id<"modelos">) => {
    setPreviewTemplateId(templateId);
  };

  const handlePreviewDialogClose = () => {
    setPreviewTemplateId(null);
  };

  const handleAddTemplate = () => {
    // TODO: Implement add template functionality
    toast.info("Función de agregar plantilla próximamente");
  };

  return (
    <section className="w-[70%] h-full mt-20 min-h-screen flex">
      <Tabs
        className="w-full bg-white h-[95%] min-h-screen"
        defaultValue="Modelos"
      >
        <TabsList className="bg-white w-[50%] p-0 h-full">
          <div className="flex gap-4 p-2 w-full">
            <TabsTrigger value="Modelos" className="cursor-pointer w-fit">
              Modelos
            </TabsTrigger>
            <TabsTrigger value="Mis Modelos" className="cursor-pointer w-fit">
              Mis modelos
            </TabsTrigger>
          </div>
        </TabsList>
        <TemplateSearchBar
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          onAddTemplate={handleAddTemplate}
        />
        <TabsContent value="Modelos" className="min-w-[90%]">
          <TemplateTableContainer
            searchQuery={searchValue}
            pageSize={20}
            onPreview={handlePreviewTemplate}
            onCreateFromTemplate={handleCreateFromTemplate}
            canCreate={can.escritos.write}
            showPublicOnly={true}
          />
        </TabsContent>
        <TabsContent value="Mis Modelos" className="min-w-[90%]">
          <TemplateTableContainer
            searchQuery={searchValue}
            pageSize={20}
            onPreview={handlePreviewTemplate}
            onCreateFromTemplate={handleCreateFromTemplate}
            canCreate={can.escritos.write}
            showPublicOnly={false}
          />
        </TabsContent>
      </Tabs>

      <TemplatePreviewDialog
        templateId={previewTemplateId}
        isOpen={previewTemplateId !== null}
        onClose={handlePreviewDialogClose}
      />
    </section>
  );
}
