import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { usePermissions } from "@/context/CasePermissionsContext";
import { ACCESS_LEVELS } from "@/permissions/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CaseLayout from "@/components/Cases/CaseLayout";
import { toast } from "sonner";
import {
  PromptTable,
  PromptSearchBar,
  PromptPreviewDialog,
} from "@/components/Prompts";

export default function CasePromptsPage() {
  const { hasAccessLevel } = usePermissions();
  const [searchValue, setSearchValue] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [previewPromptId, setPreviewPromptId] = useState<Id<"prompts"> | null>(
    null,
  );

  // Query for categories
  const categories = useQuery(api.functions.prompts.getPromptCategories);

  // Use search when there's a search term, otherwise use regular list
  const hasSearchTerm = searchValue.trim().length > 0;

  const searchResults = useQuery(
    api.functions.prompts.searchPrompts,
    hasSearchTerm
      ? {
          searchTerm: searchValue.trim(),
          paginationOpts: { numItems: 100, cursor: null },
          category: selectedCategory !== "all" ? selectedCategory : undefined,
        }
      : "skip",
  );

  const listResults = useQuery(
    api.functions.prompts.getPrompts,
    !hasSearchTerm
      ? {
          paginationOpts: { numItems: 100, cursor: null },
          category: selectedCategory !== "all" ? selectedCategory : undefined,
        }
      : "skip",
  );

  const prompts = hasSearchTerm ? searchResults : listResults;
  const isLoadingPrompts = prompts === undefined || categories === undefined;
  const allPrompts = prompts?.page ?? [];

  // Filter prompts by public/private for tabs
  const publicPrompts = allPrompts.filter((p) => p.isPublic);
  const customPrompts = allPrompts.filter((p) => !p.isPublic);

  const handlePreviewPrompt = (promptId: Id<"prompts">) => {
    setPreviewPromptId(promptId);
  };

  const handleUsePrompt = (prompt: any) => {
    // TODO: Implement use prompt functionality (e.g., open chat with prompt)
    toast.success(`Usando prompt: ${prompt.titulo}`);
    console.log("Using prompt:", prompt);
  };

  const handleAddPrompt = () => {
    if (!hasAccessLevel(ACCESS_LEVELS.ADVANCED)) {
      toast.error("No tienes permisos para crear prompts personalizados");
      return;
    }
    // TODO: Implement add prompt functionality
    toast.info("Función de agregar prompt próximamente");
  };

  const handleEditPrompt = (_promptId: Id<"prompts">) => {
    if (!hasAccessLevel(ACCESS_LEVELS.ADVANCED)) {
      toast.error("No tienes permisos para editar prompts");
      return;
    }
    // TODO: Implement edit prompt functionality
    toast.info("Función de editar prompt próximamente");
  };

  const handleDeletePrompt = (_promptId: Id<"prompts">) => {
    if (!hasAccessLevel(ACCESS_LEVELS.ADMIN)) {
      toast.error("No tienes permisos para eliminar prompts");
      return;
    }
    // TODO: Implement delete prompt functionality
    toast.info("Función de eliminar prompt próximamente");
  };

  const handlePreviewDialogClose = () => {
    setPreviewPromptId(null);
  };

  return (
    <CaseLayout>
      <section className="w-full h-full flex pt-5">
        <Tabs className="w-full bg-white h-[95%]" defaultValue="library">
          <TabsList className="bg-white w-full p-0">
            <div className="flex gap-4 p-2">
              <TabsTrigger value="library" className="cursor-pointer">
                Biblioteca de Prompts
              </TabsTrigger>
              <TabsTrigger value="custom" className="cursor-pointer">
                Mis Prompts
              </TabsTrigger>
            </div>

            <div className="w-full h-full bg-[#f7f7f7]"> </div>
          </TabsList>

          <PromptSearchBar
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            onAddPrompt={handleAddPrompt}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            categories={categories ?? []}
          />

          <TabsContent value="library" className="min-w-[90%] mt-0">
            <PromptTable
              prompts={publicPrompts}
              isLoading={isLoadingPrompts}
              onPreview={handlePreviewPrompt}
              onUsePrompt={handleUsePrompt}
              canEdit={false}
            />
          </TabsContent>

          <TabsContent value="custom" className="min-w-[90%] mt-0">
            <PromptTable
              prompts={customPrompts}
              isLoading={isLoadingPrompts}
              onPreview={handlePreviewPrompt}
              onUsePrompt={handleUsePrompt}
              onEdit={handleEditPrompt}
              onDelete={handleDeletePrompt}
              canEdit={hasAccessLevel(ACCESS_LEVELS.ADVANCED)}
            />
          </TabsContent>
        </Tabs>
      </section>

      <PromptPreviewDialog
        promptId={previewPromptId}
        isOpen={previewPromptId !== null}
        onClose={handlePreviewDialogClose}
      />
    </CaseLayout>
  );
}
