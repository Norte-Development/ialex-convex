import CaseLayout from "@/components/Cases/CaseLayout";
import { useCase } from "@/context/CaseContext";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { KanbanBoard } from "@/components/Tasks/Kanban/KanbanBoard";
import { KanbanEmptyState } from "@/components/Tasks/Kanban/KanbanEmptyState";
import { AddTaskDialog } from "@/components/Cases/AddTaskDialog";
import { GenerateChecklistDialog } from "@/components/Cases/GenerateChecklistDialog";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

export default function CaseTasksPage() {
  const { currentCase } = useCase();
  const { user } = useAuth();
  const getOrCreateTodoList = useMutation(
    api.functions.todos.getOrCreateCaseTodoList,
  );
  const [todoListId, setTodoListId] = useState<Id<"todoLists"> | null>(null);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);

  useEffect(() => {
    if (currentCase) {
      getOrCreateTodoList({
        title: `Plan de Trabajo - ${currentCase.title}`,
        caseId: currentCase._id,
        createdBy: currentCase.assignedLawyer,
      }).then(setTodoListId);
    }
  }, [currentCase, getOrCreateTodoList]);

  const tasks = useQuery(
    api.functions.todos.listTodoItemsByList,
    todoListId ? { listId: todoListId } : "skip",
  );

  if (!currentCase) {
    return (
      <CaseLayout>
        <div className="p-6">
          <p className="text-gray-500">Caso no encontrado</p>
        </div>
      </CaseLayout>
    );
  }

  if (!todoListId || !tasks) {
    return (
      <CaseLayout>
        <div className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
        </div>
      </CaseLayout>
    );
  }

  return (
    <CaseLayout>
      <div className="p-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-medium text-gray-900">Tareas</h1>
            <p className="text-sm text-gray-500">{currentCase.title}</p>
          </div>
          {tasks.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsGenerateOpen(true)}
                className="text-gray-500 hover:text-tertiary"
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                Regenerar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddTaskOpen(true)}
                className="border-tertiary text-tertiary hover:bg-tertiary/5"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Nueva tarea
              </Button>
            </div>
          )}
        </header>

        {tasks.length === 0 ? (
          <KanbanEmptyState caseId={currentCase._id} />
        ) : (
          <KanbanBoard todoListId={todoListId} />
        )}
      </div>

      {/* Dialogs */}
      <AddTaskDialog
        open={isAddTaskOpen}
        onOpenChange={setIsAddTaskOpen}
        caseId={currentCase._id}
        listId={todoListId}
        userId={user?._id as Id<"users"> | undefined}
      />
      <GenerateChecklistDialog
        open={isGenerateOpen}
        onOpenChange={setIsGenerateOpen}
        caseId={currentCase._id}
        userId={user?._id as Id<"users"> | undefined}
        hasExistingPlan={tasks.length > 0}
      />
    </CaseLayout>
  );
}
