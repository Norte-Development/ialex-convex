import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckSquare, Sparkles, Plus } from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";
import { GenerateChecklistDialog } from "@/components/Cases/GenerateChecklistDialog";
import { AddTaskDialog } from "@/components/Cases/AddTaskDialog";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

interface KanbanEmptyStateProps {
  caseId: Id<"cases">;
}

export function KanbanEmptyState({ caseId }: KanbanEmptyStateProps) {
  const { user } = useAuth();
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false);

  // Get the todo list for this case
  const lists = useQuery(api.functions.todos.listTodoListsByCase, { caseId });
  const primaryList = lists?.[0];

  return (
    <>
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="bg-gray-100 p-6 rounded-full mb-6">
          <CheckSquare className="h-12 w-12 text-gray-400" />
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          No hay tareas en este caso
        </h3>

        <p className="text-gray-500 text-center mb-8 max-w-md">
          Comienza a organizar el trabajo creando tareas manualmente o generando
          un plan con IA.
        </p>

        <div className="flex gap-4">
          <Button
            onClick={() => setIsGenerateDialogOpen(true)}
            variant="outline"
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Generar plan con IA
          </Button>

          <Button
            onClick={() => setIsAddTaskDialogOpen(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Crear tarea manualmente
          </Button>
        </div>
      </div>

      {/* Dialogs */}
      <GenerateChecklistDialog
        open={isGenerateDialogOpen}
        onOpenChange={setIsGenerateDialogOpen}
        caseId={caseId}
        userId={user?._id as Id<"users"> | undefined}
        hasExistingPlan={!!primaryList}
      />

      <AddTaskDialog
        open={isAddTaskDialogOpen}
        onOpenChange={setIsAddTaskDialogOpen}
        caseId={caseId}
        listId={primaryList?._id}
        userId={user?._id as Id<"users"> | undefined}
      />
    </>
  );
}
