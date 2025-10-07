import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useNavigate } from "react-router-dom";
import { useCase } from "@/context/CaseContext";
import { usePermissions } from "@/context/CasePermissionsContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CaseLayout from "@/components/Cases/CaseLayout";
import { toast } from "sonner";
import { 
  TemplateTable, 
  TemplatePreviewDialog, 
  TemplateSearchBar 
} from "@/components/Templates";

export default function CaseModelPage() {
  const navigate = useNavigate();
  const { currentCase } = useCase();
  const { can } = usePermissions();
  const [previewTemplateId, setPreviewTemplateId] = useState<Id<"modelos"> | null>(
    null,
  );
  const [searchValue, setSearchValue] = useState("");

  // Use search when there's a search term, otherwise use regular list
  const hasSearchTerm = searchValue.trim().length > 0;

  const searchResults = useQuery(
    api.functions.templates.searchModelos,
    hasSearchTerm
      ? {
          searchTerm: searchValue.trim(),
          paginationOpts: { numItems: 100, cursor: null }
        }
      : "skip",
  );

  const listResults = useQuery(
    api.functions.templates.getModelos,
    !hasSearchTerm
      ? {
          paginationOpts: { numItems: 100, cursor: null }
        }
      : "skip",
  );

  const templates = hasSearchTerm ? searchResults : listResults;
  const isLoadingTemplates = templates === undefined;
  const modelos = templates?.page ?? [];

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
    <CaseLayout>
      <section className="w-full h-full flex pt-5">
        <Tabs className="w-full bg-white h-[95%]" defaultValue="Modelos">
          <TabsList className="bg-white w-full p-0">
            <div className="flex gap-4 p-2">
              <TabsTrigger value="Modelos" className="cursor-pointer">
                Modelos
              </TabsTrigger>
              <TabsTrigger value="Mis Modelos" className="cursor-pointer">
                Mis modelos
              </TabsTrigger>
            </div>

            <div className="w-full h-full bg-[#f7f7f7]"> </div>
          </TabsList>
          <TemplateSearchBar
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            onAddTemplate={handleAddTemplate}
          />
          <TabsContent value="Modelos" className="min-w-[90%]">
            <TemplateTable
              templates={modelos}
              isLoading={isLoadingTemplates}
              onPreview={handlePreviewTemplate}
              onCreateFromTemplate={handleCreateFromTemplate}
              canCreate={can.escritos.write}
            />
          </TabsContent>
          <TabsContent value="Mis Modelos" className="min-w-[90%]">
            <TemplateTable
              templates={modelos.filter(t => !t.isPublic)}
              isLoading={isLoadingTemplates}
              onPreview={handlePreviewTemplate}
              onCreateFromTemplate={handleCreateFromTemplate}
              canCreate={can.escritos.write}
            />
          </TabsContent>
        </Tabs>
      </section>

      <TemplatePreviewDialog
        templateId={previewTemplateId}
        isOpen={previewTemplateId !== null}
        onClose={handlePreviewDialogClose}
      />
    </CaseLayout>
  );
}
