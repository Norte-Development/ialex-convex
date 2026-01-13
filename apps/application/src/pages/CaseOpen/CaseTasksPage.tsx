import CaseLayout from "@/components/Cases/CaseLayout";
import { useCase } from "@/context/CaseContext";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { KanbanBoard } from "@/components/Tasks/Kanban/KanbanBoard";
import { KanbanEmptyState } from "@/components/Tasks/Kanban/KanbanEmptyState";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function CaseTasksPage() {
  const { currentCase } = useCase();
  const getOrCreateTodoList = useMutation(api.functions.todos.getOrCreateCaseTodoList);
  const [todoListId, setTodoListId] = useState<Id<"todoLists"> | null>(null);

  // Get or create the todo list when case is loaded
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
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </CaseLayout>
    );
  }

  return (
    <CaseLayout>
      <div className="p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Plan de Trabajo</h1>
          <p className="text-gray-600">{currentCase.title}</p>
        </header>

        {tasks.length === 0 ? (
          <KanbanEmptyState caseId={currentCase._id} />
        ) : (
          <KanbanBoard todoListId={todoListId} />
        )}
      </div>
    </CaseLayout>
  );
}
