import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { usePermissions } from "@/context/CasePermissionsContext";
import { useChatbot } from "@/context/ChatbotContext";
import { ACCESS_LEVELS } from "@/permissions/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CaseLayout from "@/components/Cases/CaseLayout";
import { toast } from "sonner";
import {
  PromptTable,
  PromptSearchBar,
  PromptPreviewDialog,
  CreateEditPromptDialog,
  DeletePromptDialog,
} from "@/components/Prompts";

export default function CasePromptsPage() {
  const { hasAccessLevel } = usePermissions();
  const { openChatbotWithPrompt } = useChatbot();
  const incrementUsage = useMutation(
    api.functions.prompts.incrementPromptUsage,
  );
  const [searchValue, setSearchValue] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [previewPromptId, setPreviewPromptId] = useState<Id<"prompts"> | null>(
    null,
  );
  const [createEditDialog, setCreateEditDialog] = useState<{
    isOpen: boolean;
    mode: "create" | "edit";
    promptId?: Id<"prompts"> | null;
  }>({
    isOpen: false,
    mode: "create",
    promptId: null,
  });
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    promptId: Id<"prompts"> | null;
    promptTitle?: string;
  }>({
    isOpen: false,
    promptId: null,
  });

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

  const handleUsePrompt = async (prompt: any) => {
    try {
      // Increment usage count
      await incrementUsage({ promptId: prompt._id });

      // Open chatbot with the prompt
      openChatbotWithPrompt(prompt.prompt);

      toast.success(`Prompt "${prompt.titulo}" enviado al chat`);
    } catch (error) {
      console.error("Error using prompt:", error);
      toast.error("Error al usar el prompt");
    }
  };

  const handleAddPrompt = () => {
    if (!hasAccessLevel(ACCESS_LEVELS.ADVANCED)) {
      toast.error("No tienes permisos para crear prompts personalizados");
      return;
    }
    setCreateEditDialog({
      isOpen: true,
      mode: "create",
      promptId: null,
    });
  };

  const handleEditPrompt = (promptId: Id<"prompts">) => {
    if (!hasAccessLevel(ACCESS_LEVELS.ADVANCED)) {
      toast.error("No tienes permisos para editar prompts");
      return;
    }
    setCreateEditDialog({
      isOpen: true,
      mode: "edit",
      promptId,
    });
  };

  const handleDeletePrompt = (promptId: Id<"prompts">) => {
    if (!hasAccessLevel(ACCESS_LEVELS.ADMIN)) {
      toast.error("No tienes permisos para eliminar prompts");
      return;
    }

    // Find the prompt to get its title
    const promptToDelete = allPrompts.find((p) => p._id === promptId);

    setDeleteDialog({
      isOpen: true,
      promptId,
      promptTitle: promptToDelete?.titulo,
    });
  };

  const handlePreviewDialogClose = () => {
    setPreviewPromptId(null);
  };

  const handleCloseCreateEditDialog = () => {
    setCreateEditDialog({
      isOpen: false,
      mode: "create",
      promptId: null,
    });
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialog({
      isOpen: false,
      promptId: null,
    });
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

      <CreateEditPromptDialog
        isOpen={createEditDialog.isOpen}
        mode={createEditDialog.mode}
        promptId={createEditDialog.promptId}
        onClose={handleCloseCreateEditDialog}
      />

      <DeletePromptDialog
        isOpen={deleteDialog.isOpen}
        promptId={deleteDialog.promptId}
        promptTitle={deleteDialog.promptTitle}
        onClose={handleCloseDeleteDialog}
      />
    </CaseLayout>
  );
}
